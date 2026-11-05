-- CMU x PITT in-house draft: tables, functions, row-level security.
-- Run this first in the Supabase SQL editor, then seed.sql.
-- Safe to re-run: it drops and recreates everything.

drop table if exists captain_tokens cascade;
drop table if exists players cascade;
drop table if exists captains cascade;
drop table if exists draft cascade;
drop function if exists do_pick(int, int);
drop function if exists do_pick(int, int, int);
drop function if exists make_pick(text, int);
drop function if exists make_pick(text, int, int);
drop function if exists admin_pick(int);
drop function if exists admin_pick(int, int);

create table draft (
  id             int primary key default 1 check (id = 1),
  phase          text not null default 'lobby' check (phase in ('lobby', 'drafting', 'complete')),
  pick_index     int  not null default 0,
  picks_per_team int  not null default 4 check (picks_per_team between 1 and 10),
  started_at     timestamptz,
  updated_at     timestamptz not null default now()
);

create table captains (
  id           int primary key,
  slot         int  not null unique check (slot between 1 and 8),
  display_name text not null,
  riot_id      text not null,
  opgg_url     text not null,
  peak_rank    text not null,
  rank_score   numeric not null,
  claimed      boolean not null default false,
  ready        boolean not null default false
);

create table captain_tokens (
  captain_id int primary key references captains(id) on delete cascade,
  token_hash text not null unique
);

create table players (
  id              serial primary key,
  display_name    text not null,
  riot_id         text not null,
  opgg_url        text not null,
  peak_rank       text not null,
  rank_score      numeric not null,
  team_captain_id int references captains(id),
  pick_number     int unique
);

-- Row-level security: the public role can read the 3 state tables, nothing else.
alter table draft          enable row level security;
alter table captains       enable row level security;
alter table players        enable row level security;
alter table captain_tokens enable row level security;

create policy "public read draft"    on draft    for select to anon, authenticated using (true);
create policy "public read captains" on captains for select to anon, authenticated using (true);
create policy "public read players"  on players  for select to anon, authenticated using (true);
-- captain_tokens has no policies, so anon/authenticated can't see it.

grant select on draft, captains, players to anon, authenticated;
revoke insert, update, delete on draft, captains, players from anon, authenticated;
revoke all on captain_tokens from anon, authenticated;
grant all on draft, captains, players, captain_tokens to service_role;
grant usage on sequence players_id_seq to service_role;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Captain slot on the clock for 0-based pick index k (snake order).
create or replace function slot_on_clock(k int, n int default 8) returns int
language sql immutable as $$
  select case when (k / n) % 2 = 0 then (k % n) + 1 else n - (k % n) end
$$;

create or replace function touch_draft() returns void
language sql as $$ update draft set updated_at = now() where id = 1 $$;

create or replace function captain_for_token(p_token_hash text) returns int
language sql stable as $$
  select captain_id from captain_tokens where token_hash = p_token_hash
$$;

-- Saves a pick for the captain on the clock. Caller must hold the draft row lock.
create or replace function do_pick(p_captain_id int, p_player_id int, p_expected_pick_index int default null) returns json
language plpgsql as $$
declare
  d draft;
  on_clock captains;
  p players;
  total int;
begin
  select * into d from draft where id = 1 for update;
  if d.phase <> 'drafting' then
    raise exception 'The draft is not running';
  end if;
  if p_expected_pick_index is not null and p_expected_pick_index <> d.pick_index then
    raise exception 'The board changed. Try again.';
  end if;

  select * into on_clock from captains where slot = slot_on_clock(d.pick_index);
  if p_captain_id is not null and p_captain_id <> on_clock.id then
    raise exception 'It''s %''s pick', on_clock.display_name;
  end if;

  select * into p from players where id = p_player_id for update;
  if not found then
    raise exception 'That player doesn''t exist';
  end if;
  if p.team_captain_id is not null then
    raise exception '% was already drafted', p.display_name;
  end if;

  update players
     set team_captain_id = on_clock.id, pick_number = d.pick_index + 1
   where id = p_player_id;

  total := 8 * d.picks_per_team;
  update draft
     set pick_index = d.pick_index + 1,
         phase = case when d.pick_index + 1 >= total then 'complete' else 'drafting' end,
         updated_at = now()
   where id = 1;

  return json_build_object('pick', d.pick_index + 1, 'captain', on_clock.display_name, 'player', p.display_name);
end $$;

-- ---------------------------------------------------------------------------
-- Captain actions (called by the Next.js server with the secret key)
-- ---------------------------------------------------------------------------

create or replace function claim_captain(p_captain_id int, p_token_hash text) returns json
language plpgsql as $$
declare
  d draft;
  c captains;
begin
  select * into d from draft where id = 1 for update;
  if d.phase = 'complete' then
    raise exception 'The draft is over';
  end if;

  update captains set claimed = true, ready = false
   where id = p_captain_id and claimed = false
   returning * into c;
  if not found then
    if not exists (select 1 from captains where id = p_captain_id) then
      raise exception 'That captain doesn''t exist';
    end if;
    raise exception 'Already taken';
  end if;

  delete from captain_tokens where captain_id = p_captain_id;
  insert into captain_tokens (captain_id, token_hash) values (p_captain_id, p_token_hash);
  perform touch_draft();
  return json_build_object('captainId', c.id, 'displayName', c.display_name);
end $$;

create or replace function release_captain(p_token_hash text) returns void
language plpgsql as $$
declare
  d draft;
  cid int;
begin
  select * into d from draft where id = 1 for update;
  cid := captain_for_token(p_token_hash);
  if cid is null then
    raise exception 'You are not a captain';
  end if;
  if d.phase <> 'lobby' then
    raise exception 'Names can only be released in the lobby. Ask the admin.';
  end if;
  delete from captain_tokens where captain_id = cid;
  update captains set claimed = false, ready = false where id = cid;
  perform touch_draft();
end $$;

create or replace function set_ready(p_token_hash text, p_ready boolean) returns json
language plpgsql as $$
declare
  d draft;
  cid int;
  n_ready int;
begin
  select * into d from draft where id = 1 for update;
  cid := captain_for_token(p_token_hash);
  if cid is null then
    raise exception 'You are not a captain';
  end if;
  if d.phase <> 'lobby' then
    raise exception 'The draft has already started';
  end if;

  update captains set ready = p_ready where id = cid;

  select count(*) into n_ready from captains where claimed and ready;
  if n_ready = 8 then
    update draft set phase = 'drafting', pick_index = 0, started_at = now(), updated_at = now() where id = 1;
    return json_build_object('started', true);
  end if;
  perform touch_draft();
  return json_build_object('started', false);
end $$;

create or replace function make_pick(p_token_hash text, p_player_id int, p_expected_pick_index int default null) returns json
language plpgsql as $$
declare
  cid int;
begin
  -- Serialize with admin_release before resolving authorization. A token
  -- revoked while this request was queued must not retain its old captain ID.
  perform 1 from draft where id = 1 for update;
  cid := captain_for_token(p_token_hash);
  if cid is null then
    raise exception 'You are not a captain';
  end if;
  return do_pick(cid, p_player_id, p_expected_pick_index);
end $$;

-- ---------------------------------------------------------------------------
-- Admin actions (the server checks ADMIN_KEY before calling these)
-- ---------------------------------------------------------------------------

create or replace function admin_release(p_captain_id int) returns void
language plpgsql as $$
begin
  perform 1 from draft where id = 1 for update;
  delete from captain_tokens where captain_id = p_captain_id;
  update captains set claimed = false, ready = false where id = p_captain_id;
  perform touch_draft();
end $$;

create or replace function admin_force_start() returns void
language plpgsql as $$
declare
  d draft;
begin
  select * into d from draft where id = 1 for update;
  if d.phase <> 'lobby' then
    raise exception 'The draft has already started';
  end if;
  update draft set phase = 'drafting', pick_index = 0, started_at = now(), updated_at = now() where id = 1;
end $$;

create or replace function admin_pick(p_player_id int, p_expected_pick_index int default null) returns json
language sql as $$ select do_pick(null, p_player_id, p_expected_pick_index) $$;

create or replace function admin_undo() returns json
language plpgsql as $$
declare
  d draft;
  p players;
begin
  select * into d from draft where id = 1 for update;
  if d.pick_index = 0 or d.phase = 'lobby' then
    raise exception 'No picks to undo';
  end if;
  select * into p from players where pick_number = d.pick_index;
  update players set team_captain_id = null, pick_number = null where pick_number = d.pick_index;
  update draft set pick_index = d.pick_index - 1, phase = 'drafting', updated_at = now() where id = 1;
  return json_build_object('pick', d.pick_index, 'player', p.display_name);
end $$;

create or replace function admin_set_picks_per_team(p_picks int) returns void
language plpgsql as $$
declare
  d draft;
  n_players int;
begin
  select * into d from draft where id = 1 for update;
  if d.phase <> 'lobby' then
    raise exception 'Picks per team can only change in the lobby';
  end if;
  select count(*) into n_players from players;
  if p_picks < 1 or p_picks * 8 > n_players then
    raise exception 'Picks per team must be between 1 and %', n_players / 8;
  end if;
  update draft set picks_per_team = p_picks, updated_at = now() where id = 1;
end $$;

-- p_full = false: clear picks and Ready, keep claims. p_full = true: also clear claims.
create or replace function admin_reset(p_full boolean) returns void
language plpgsql as $$
begin
  perform 1 from draft where id = 1 for update;
  update players set team_captain_id = null, pick_number = null where team_captain_id is not null;
  update captains set ready = false where true;
  if p_full then
    delete from captain_tokens where true;
    update captains set claimed = false where true;
  end if;
  update draft set phase = 'lobby', pick_index = 0, started_at = null, updated_at = now() where id = 1;
end $$;

-- One consistent snapshot of the whole board, in a single statement.
create or replace function get_state() returns json
language sql stable as $$
  select json_build_object(
    'draft',    (select row_to_json(d) from draft d where id = 1),
    'captains', coalesce((select json_agg(c order by c.slot) from captains c), '[]'::json),
    'players',  coalesce((select json_agg(p order by p.rank_score desc, p.id) from players p), '[]'::json)
  )
$$;

-- Only the server (service_role) may call the action functions.
revoke execute on function
  slot_on_clock(int,int), touch_draft(), captain_for_token(text),
  do_pick(int,int,int), claim_captain(int,text), release_captain(text),
  set_ready(text,boolean), make_pick(text,int,int), admin_release(int),
  admin_force_start(), admin_pick(int,int), admin_undo(),
  admin_set_picks_per_team(int), admin_reset(boolean), get_state()
from public, anon, authenticated;
grant execute on function
  slot_on_clock(int,int), touch_draft(), captain_for_token(text),
  do_pick(int,int,int), claim_captain(int,text), release_captain(text),
  set_ready(text,boolean), make_pick(text,int,int), admin_release(int),
  admin_force_start(), admin_pick(int,int), admin_undo(),
  admin_set_picks_per_team(int), admin_reset(boolean), get_state()
to service_role;

-- Realtime: broadcast changes on the 3 state tables.
alter publication supabase_realtime add table draft, captains, players;
