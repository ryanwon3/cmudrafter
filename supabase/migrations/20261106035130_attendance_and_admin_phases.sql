-- Non-destructive upgrade: preserve event data and private captain claims.
do $$ begin
  perform 1 from public.draft where id=1 for update;
  if exists(select 1 from public.draft where phase <> 'lobby') then
    raise exception 'Attendance upgrade requires the event to be in the lobby';
  end if;
end $$;
alter table public.players add column if not exists present boolean not null default false;
alter table public.draft add column if not exists announcement text not null default '';
alter table public.draft drop constraint if exists draft_phase_check;
alter table public.draft add constraint draft_phase_check check (phase in ('lobby','drafting','review','complete'));
update public.draft set picks_per_team=4 where id=1;
alter table public.draft drop constraint if exists draft_picks_per_team_check;
alter table public.draft add constraint draft_picks_per_team_check check (picks_per_team=4);

create table if not exists public.player_tokens (
  player_id int primary key references public.players(id) on delete cascade,
  token_hash text not null unique
);
alter table public.player_tokens enable row level security;
revoke all on public.player_tokens from anon, authenticated;
grant all on public.player_tokens to service_role;

create or replace function public.player_for_token(p_token_hash text) returns int
language sql stable set search_path = public as $$
  select player_id from player_tokens where token_hash = p_token_hash
$$;

create or replace function public.check_in_player(p_player_id int, p_token_hash text) returns void
language plpgsql set search_path = public as $$
declare d draft; p players;
begin
  select * into d from draft where id=1 for update;
  if d.phase <> 'lobby' then raise exception 'Attendance can only change in the lobby'; end if;
  select * into p from players where id=p_player_id for update;
  if not found then raise exception 'That player doesn''t exist'; end if;
  if p.present then raise exception 'That player is already checked in'; end if;
  if exists(select 1 from player_tokens where token_hash=p_token_hash) then raise exception 'This attendance token is already in use'; end if;
  delete from player_tokens where player_id=p_player_id;
  insert into player_tokens(player_id, token_hash) values(p_player_id,p_token_hash);
  update players set present=true where id=p_player_id;
  perform touch_draft();
end $$;

create or replace function public.release_player(p_token_hash text) returns void
language plpgsql set search_path = public as $$
declare d draft; pid int;
begin
  select * into d from draft where id=1 for update;
  if d.phase <> 'lobby' then raise exception 'Attendance can only change in the lobby'; end if;
  pid := player_for_token(p_token_hash);
  if pid is null then raise exception 'You are not checked in'; end if;
  delete from player_tokens where player_id=pid;
  update players set present=false where id=pid;
  perform touch_draft();
end $$;

create or replace function public.admin_set_attendance(p_player_id int, p_present boolean) returns void
language plpgsql set search_path = public as $$
declare d draft;
begin
  select * into d from draft where id=1 for update;
  if d.phase <> 'lobby' then raise exception 'Attendance can only change in the lobby'; end if;
  if p_present is null then raise exception 'present must be true or false'; end if;
  update players set present=p_present where id=p_player_id;
  if not found then raise exception 'That player doesn''t exist'; end if;
  if not p_present then delete from player_tokens where player_id=p_player_id; end if;
  perform touch_draft();
end $$;

-- Ready is advisory; the organizer explicitly confirms the next phase.
create or replace function public.set_ready(p_token_hash text, p_ready boolean) returns json
language plpgsql set search_path = public as $$
declare d draft; cid int;
begin
  select * into d from draft where id=1 for update;
  cid := captain_for_token(p_token_hash);
  if cid is null then raise exception 'You are not a captain'; end if;
  if d.phase <> 'lobby' then raise exception 'The draft has already started'; end if;
  update captains set ready=p_ready where id=cid;
  perform touch_draft();
  return json_build_object('started',false);
end $$;

create or replace function public.admin_force_start() returns void
language plpgsql set search_path = public as $$
declare d draft;
begin
  select * into d from draft where id=1 for update;
  if d.phase <> 'lobby' then raise exception 'The draft has already started'; end if;
  if (select count(*) from players where present) < 32 then
    raise exception 'At least 32 players must be marked present before starting';
  end if;
  update draft set phase='drafting',pick_index=0,picks_per_team=4,started_at=now(),updated_at=now() where id=1;
end $$;

create or replace function public.do_pick(p_captain_id int,p_player_id int,p_expected_pick_index int default null) returns json
language plpgsql set search_path = public as $$
declare d draft; on_clock captains; p players;
begin
  select * into d from draft where id=1 for update;
  if d.phase <> 'drafting' then raise exception 'The draft is not running'; end if;
  if p_expected_pick_index is not null and p_expected_pick_index <> d.pick_index then raise exception 'The board changed. Try again.'; end if;
  select * into on_clock from captains where slot=slot_on_clock(d.pick_index);
  if p_captain_id is not null and p_captain_id <> on_clock.id then raise exception 'It''s %''s pick',on_clock.display_name; end if;
  select * into p from players where id=p_player_id for update;
  if not found then raise exception 'That player doesn''t exist'; end if;
  if p.team_captain_id is not null then raise exception '% was already drafted',p.display_name; end if;
  if not p.present then raise exception '% is not marked present',p.display_name; end if;
  update players set team_captain_id=on_clock.id,pick_number=d.pick_index+1 where id=p_player_id;
  update draft set pick_index=d.pick_index+1,phase=case when d.pick_index+1>=32 then 'review' else 'drafting' end,updated_at=now() where id=1;
  return json_build_object('pick',d.pick_index+1,'captain',on_clock.display_name,'player',p.display_name);
end $$;

create or replace function public.admin_set_picks_per_team(p_picks int) returns void
language plpgsql set search_path = public as $$
declare d draft;
begin
  select * into d from draft where id=1 for update;
  if d.phase <> 'lobby' then raise exception 'Picks per team can only change in the lobby'; end if;
  if p_picks is null or p_picks <> 4 then raise exception 'This event uses four picks per captain'; end if;
  update draft set picks_per_team=4,updated_at=now() where id=1;
end $$;

create or replace function public.admin_announcement(p_message text) returns void
language plpgsql set search_path = public as $$
begin
  perform 1 from draft where id=1 for update;
  if p_message is null or length(p_message)>500 then raise exception 'Announcement must be 500 characters or fewer'; end if;
  update draft set announcement=btrim(p_message),updated_at=now() where id=1;
end $$;

create or replace function public.admin_publish_results() returns void
language plpgsql set search_path = public as $$
declare d draft;
begin
  select * into d from draft where id=1 for update;
  if d.phase <> 'review' then raise exception 'Results can only be published after draft review'; end if;
  update draft set phase='complete',updated_at=now() where id=1;
end $$;

create or replace function public.admin_reset(p_full boolean) returns void
language plpgsql set search_path = public as $$
begin
  perform 1 from draft where id=1 for update;
  update players set team_captain_id=null,pick_number=null;
  update captains set ready=false;
  if p_full then
    delete from captain_tokens;
    delete from player_tokens;
    update captains set claimed=false;
    update players set present=false;
  end if;
  update draft set phase='lobby',pick_index=0,picks_per_team=4,started_at=null,announcement='',updated_at=now() where id=1;
end $$;

revoke execute on function player_for_token(text),check_in_player(int,text),release_player(text),admin_set_attendance(int,boolean),admin_announcement(text),admin_publish_results() from public,anon,authenticated;
grant execute on function player_for_token(text),check_in_player(int,text),release_player(text),admin_set_attendance(int,boolean),admin_announcement(text),admin_publish_results() to service_role;
