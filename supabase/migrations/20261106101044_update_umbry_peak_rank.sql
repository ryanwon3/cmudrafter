-- Profile correction only: preserve Umbry's player ID, attendance and picks.
do $$
begin
  perform 1 from public.draft where id=1 for update;
  update public.players set peak_rank='Master 817 LP',rank_score=36.17
    where lower(riot_id)='elfaria#wand';
  if not found then raise exception 'Umbry is missing from the player pool'; end if;
end $$;
