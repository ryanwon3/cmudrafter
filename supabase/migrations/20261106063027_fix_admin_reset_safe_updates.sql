-- PostgREST enables safeupdate: every UPDATE and DELETE needs row criteria.
-- Only replace the function; applying this migration does not reset event data.
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
  update draft set phase='lobby',pick_index=0,picks_per_team=4,started_at=null,announcement='',updated_at=now() where id=1;
end $$;

revoke execute on function public.admin_reset(boolean) from public,anon,authenticated;
grant execute on function public.admin_reset(boolean) to service_role;
