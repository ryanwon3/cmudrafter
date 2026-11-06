-- Tournament bracket upgrade: preserve the event, its picks and private sessions.
alter table public.draft add column if not exists bracket jsonb;
alter table public.draft add column if not exists bracket_revision int not null default 0;

-- Pair slots 1-8, 4-5, 2-7 and 3-6 using the existing captain IDs.
create or replace function public.default_bracket() returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'seeds', coalesce(jsonb_agg(c.id order by array_position(array[1,8,4,5,2,7,3,6],c.slot)), '[]'::jsonb),
    'winners', '{}'::jsonb
  ) from captains c
$$;

create or replace function public.admin_bracket_seeds(p_captain_ids int[],p_expected_revision int) returns void
language plpgsql set search_path = public as $$
declare d draft;
begin
  select * into d from draft where id=1 for update;
  if d.phase <> 'complete' then raise exception 'Bracket edits require published results'; end if;
  if p_expected_revision is null or p_expected_revision <> d.bracket_revision then
    raise exception 'The bracket changed. Refresh and try again.';
  end if;
  if p_captain_ids is null or array_ndims(p_captain_ids) is distinct from 1
     or cardinality(p_captain_ids) <> 8
     or (select count(distinct cid) from unnest(p_captain_ids) as seeds(cid)) <> 8
     or exists(select 1 from unnest(p_captain_ids) as seeds(cid)
       where not exists(select 1 from captains c where c.id=seeds.cid)) then
    raise exception 'Seeds must contain all eight captains exactly once';
  end if;
  if d.bracket is not null and d.bracket->'seeds' = to_jsonb(p_captain_ids) then return; end if;
  update draft set bracket=jsonb_build_object('seeds',to_jsonb(p_captain_ids),'winners','{}'::jsonb),
    bracket_revision=d.bracket_revision+1,updated_at=now() where id=1;
end $$;

create or replace function public.admin_bracket_result(p_match text,p_winner int,p_expected_revision int) returns void
language plpgsql set search_path = public as $$
declare d draft; b jsonb; winners jsonb; participant_a int; participant_b int; seed_offset int;
begin
  select * into d from draft where id=1 for update;
  if d.phase <> 'complete' then raise exception 'Bracket edits require published results'; end if;
  if p_expected_revision is null or p_expected_revision <> d.bracket_revision then
    raise exception 'The bracket changed. Refresh and try again.';
  end if;
  if p_match is null or p_match not in ('qf1','qf2','qf3','qf4','sf1','sf2','final') then
    raise exception 'That bracket match does not exist';
  end if;
  b := coalesce(d.bracket,default_bracket());
  winners := b->'winners';
  if p_winner is not null then
    if p_match in ('qf1','qf2','qf3','qf4') then
      seed_offset := case p_match when 'qf1' then 0 when 'qf2' then 2 when 'qf3' then 4 else 6 end;
      participant_a := (b->'seeds'->>seed_offset)::int;
      participant_b := (b->'seeds'->>(seed_offset+1))::int;
    elsif p_match='sf1' then
      participant_a := (winners->>'qf1')::int;
      participant_b := (winners->>'qf2')::int;
    elsif p_match='sf2' then
      participant_a := (winners->>'qf3')::int;
      participant_b := (winners->>'qf4')::int;
    else
      participant_a := (winners->>'sf1')::int;
      participant_b := (winners->>'sf2')::int;
    end if;
    if participant_a is null or participant_b is null then
      raise exception 'Both match participants must be determined first';
    end if;
    if p_winner not in (participant_a,participant_b) then
      raise exception 'The winner must be a participant in this match';
    end if;
  end if;
  if (winners->>p_match)::int is not distinct from p_winner then return; end if;
  winners := winners-p_match;
  if p_winner is not null then
    winners := jsonb_set(winners,array[p_match],to_jsonb(p_winner),true);
  end if;
  if p_match in ('qf1','qf2') then
    winners := winners-array['sf1','final'];
  elsif p_match in ('qf3','qf4') then
    winners := winners-array['sf2','final'];
  elsif p_match in ('sf1','sf2') then
    winners := winners-'final';
  end if;
  update draft set bracket=jsonb_set(b,'{winners}',winners,true),
    bracket_revision=d.bracket_revision+1,updated_at=now() where id=1;
end $$;

-- Keep the reset's explicit row predicates for PostgREST's safeupdate extension.
create or replace function public.admin_reset(p_full boolean) returns void
language plpgsql set search_path = public as $$
begin
  perform 1 from draft where id=1 for update;
  update players set team_captain_id=null,pick_number=null
    where team_captain_id is not null or pick_number is not null;
  update captains set ready=false where ready;
  if p_full then
    delete from captain_tokens where captain_id in (select id from captains);
    delete from player_tokens where player_id in (select id from players);
    update captains set claimed=false where claimed;
    update players set present=false where present;
  end if;
  update draft set phase='lobby',pick_index=0,picks_per_team=4,started_at=null,announcement='',
    bracket=null,bracket_revision=bracket_revision+1,updated_at=now() where id=1;
end $$;

create or replace function public.admin_undo() returns json
language plpgsql set search_path = public as $$
declare d draft; p players;
begin
  select * into d from draft where id=1 for update;
  if d.pick_index=0 or d.phase='lobby' then raise exception 'No picks to undo'; end if;
  select * into p from players where pick_number=d.pick_index;
  update players set team_captain_id=null,pick_number=null where pick_number=d.pick_index;
  update draft set pick_index=d.pick_index-1,phase='drafting',bracket=null,
    bracket_revision=d.bracket_revision+1,updated_at=now() where id=1;
  return json_build_object('pick',d.pick_index,'player',p.display_name);
end $$;

revoke execute on function public.default_bracket(),public.admin_bracket_seeds(int[],int),
  public.admin_bracket_result(text,int,int),public.admin_reset(boolean),public.admin_undo()
  from public,anon,authenticated;
grant execute on function public.default_bracket(),public.admin_bracket_seeds(int[],int),
  public.admin_bracket_result(text,int,int),public.admin_reset(boolean),public.admin_undo()
  to service_role;
