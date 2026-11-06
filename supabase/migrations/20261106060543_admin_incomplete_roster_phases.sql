-- Admins may advance phases even when attendance or team rosters are incomplete.
-- Attendance eligibility and the normal 32-pick limit remain unchanged.
create or replace function public.admin_force_start() returns void
language plpgsql set search_path = public as $$
declare d draft;
begin
  select * into d from draft where id=1 for update;
  if d.phase <> 'lobby' then raise exception 'The draft has already started'; end if;
  update draft set phase='drafting',pick_index=0,picks_per_team=4,started_at=now(),updated_at=now() where id=1;
end $$;

create or replace function public.admin_finish_draft() returns void
language plpgsql set search_path = public as $$
declare d draft;
begin
  select * into d from draft where id=1 for update;
  if d.phase <> 'drafting' then raise exception 'The draft is not running'; end if;
  update draft set phase='review',updated_at=now() where id=1;
end $$;

revoke execute on function public.admin_force_start(),public.admin_finish_draft() from public,anon,authenticated;
grant execute on function public.admin_force_start(),public.admin_finish_draft() to service_role;
