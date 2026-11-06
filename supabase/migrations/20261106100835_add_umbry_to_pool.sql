-- Add the organizer's player without changing existing check-ins or seats.
do $$
begin
  perform 1 from public.draft where id=1 for update;
  if not found or exists(select 1 from public.draft where id=1 and phase <> 'lobby') then
    raise exception 'Adding a player requires the lobby to be open';
  end if;
  insert into public.players(display_name,riot_id,opgg_url,peak_rank,rank_score)
    select 'Umbry','elfaria#wand','https://op.gg/lol/summoners/na/elfaria-wand','Not provided',0
    where not exists(select 1 from public.players where lower(riot_id)='elfaria#wand')
      and not exists(select 1 from public.captains where lower(riot_id)='elfaria#wand');
end $$;
