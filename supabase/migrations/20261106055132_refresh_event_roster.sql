-- Import the organizer-confirmed roster without transferring another person's session.
-- One atomic statement; fail safely if drafting has started.
do $refresh_roster$
begin
  perform 1 from public.draft where id=1 for update;
  if not found or exists(select 1 from public.draft where id=1 and (phase <> 'lobby' or pick_index <> 0))
     or exists(select 1 from public.players where team_captain_id is not null or pick_number is not null) then
    raise exception 'Roster refresh requires an unused lobby with no picks';
  end if;

  create temporary table roster_next_captains (
    id int primary key,slot int unique,display_name text,riot_id text unique,
    opgg_url text,peak_rank text,rank_score numeric
  ) on commit drop;
  insert into pg_temp.roster_next_captains(id,slot,display_name,riot_id,opgg_url,peak_rank,rank_score) values
  (1, 1, 'Chomania', 'Thechomania2#SION', 'https://op.gg/lol/summoners/na/Thechomania2-SION', 'Diamond 4', 24),
  (2, 2, 'Admirality', 'Admirality#Death', 'https://op.gg/lol/summoners/na/Admirality-Death', 'Emerald 2', 22),
  (4, 3, 'Kyle', 'Ezhister#NA1', 'https://op.gg/lol/summoners/na/Ezhister-NA1', 'Diamond 1', 27),
  (5, 4, 'Allen', 'CatGPT#YouMe', 'https://op.gg/lol/summoners/na/CatGPT-YouMe', 'Master 2 LP', 28.02),
  (6, 5, 'Brian (Holiday)', 'holiday#001', 'https://op.gg/lol/summoners/na/holiday-001', 'Master 415 LP', 32.15),
  (7, 6, 'Envy', 'foryoutoenvy#astro', 'https://op.gg/lol/summoners/na/foryoutoenvy-astro', 'Master 330 LP', 31.3),
  (8, 7, 'Ethan', 'UPMC Kassadin#CMU', 'https://op.gg/lol/summoners/na/UPMC%20Kassadin-CMU', 'Master 594 LP', 33.94),
  (9, 8, 'Nelson', 'rakwillsuk#uwu', 'https://op.gg/lol/summoners/na/rakwillsuk-uwu', 'Master 1041 LP', 38.41);

  create temporary table roster_next_players (
    display_name text,riot_id text unique,opgg_url text,peak_rank text,rank_score numeric
  ) on commit drop;
  insert into pg_temp.roster_next_players(display_name,riot_id,opgg_url,peak_rank,rank_score) values
  ('Caden', 'GamerNamer#NA1', 'https://op.gg/lol/summoners/na/GamerNamer-NA1', 'Master 551 LP (S2026)', 33.51),
  ('Muffintopper66 (Nick Crosson)', 'Muffintopper66#NA1', 'https://op.gg/lol/summoners/na/Muffintopper66-NA1', 'Master 409 LP (S2026)', 32.09),
  ('victor', 'Xeuhktal#NA1', 'https://op.gg/lol/summoners/na/Xeuhktal-NA1', 'Master 326 LP (S2026)', 31.26),
  ('Ulysses', 'westieyy#3uu', 'https://op.gg/lol/summoners/na/westieyy-3uu', 'Master 300 LP (S2023 S1)', 31.0),
  ('Wythe89#SEXY', 'Wythe89#SEXY', 'https://op.gg/lol/summoners/na/Wythe89-SEXY', 'Master 175 LP (S2026)', 29.75),
  ('Jenesis / Jacob', 'jenesis#oguri', 'https://op.gg/lol/summoners/na/jenesis-oguri', 'Master 171 LP (S2026)', 29.71),
  ('dragonguy168 / David', 'Curse Of Dragons#NA1', 'https://op.gg/lol/summoners/na/Curse%20Of%20Dragons-NA1', 'Master 147 LP (S2026)', 29.47),
  ('Mizrah/Zach', 'Mizrah#NA1', 'https://op.gg/lol/summoners/na/Mizrah-NA1', 'Master 139 LP (S2026)', 29.39),
  ('Drock/Derek', 'Drock#2000', 'https://op.gg/lol/summoners/na/Drock-2000', 'Master 132 LP (S2026)', 29.32),
  ('Alex/Rukasuk', 'Rukasuk#000', 'https://op.gg/lol/summoners/na/Rukasuk-000', 'Master 130 LP (S2023 S2)', 29.3),
  ('Jubilatory | Jamie', 'Jubilatory#that', 'https://op.gg/lol/summoners/na/Jubilatory-that', 'Master 90 LP (S2026)', 28.9),
  ('ethers#000', 'ethers#000', 'https://op.gg/lol/summoners/na/ethers-000', 'Master 16 LP (S2026)', 28.16),
  ('greyswag', 'GreySwag#6877', 'https://op.gg/lol/summoners/na/GreySwag-6877', 'Diamond 1 (S2026)', 27),
  ('wa_ge314', 'WaGe#314', 'https://op.gg/lol/summoners/na/WaGe-314', 'Diamond 1 (S2026)', 27),
  ('boomsiru', 'boomsiru#NA1', 'https://op.gg/lol/summoners/na/boomsiru-NA1', 'Diamond 2 (S2026)', 26),
  ('Yazurak', 'Yazurak#000', 'https://op.gg/lol/summoners/na/Yazurak-000', 'Diamond 3 (S2026)', 25),
  ('Alex', 'Azenkora#na2', 'https://op.gg/lol/summoners/na/Azenkora-na2', 'Diamond 4 (S2026)', 24),
  ('mrbbone / Bryce', 'mrbbone#NA1', 'https://op.gg/lol/summoners/na/mrbbone-NA1', 'Diamond 4 (S2026)', 24),
  ('physiX / Phy', 'physiX#TPX', 'https://op.gg/lol/summoners/na/physiX-TPX', 'Diamond 4 (S2026)', 24),
  ('Sparkeyz / Austin', 'Sparkeyz#NA1', 'https://op.gg/lol/summoners/na/Sparkeyz-NA1', 'Diamond 4 (S2026)', 24),
  ('Roswaalu / Ros or Josh', 'Roswaalu#0000', 'https://op.gg/lol/summoners/na/Roswaalu-0000', 'Emerald 1 (S2026)', 23),
  ('Seven', 'seven#0715', 'https://op.gg/lol/summoners/na/seven-0715', 'Emerald 1 (S2026)', 23),
  ('adocado', 'TPX adocado1024#TPX', 'https://op.gg/lol/summoners/na/TPX%20adocado1024-TPX', 'Emerald 2 (S2026)', 22),
  ('Charlie- SquigglyLine', 'SquigglyLine#Fart', 'https://op.gg/lol/summoners/na/SquigglyLine-Fart', 'Emerald 2 (S2026)', 22),
  ('luffydoc777/Peter', 'luffydoc777#Unc', 'https://op.gg/lol/summoners/na/luffydoc777-Unc', 'Emerald 2 (S2026)', 22),
  ('Sid', 'Dark#zhang', 'https://op.gg/lol/summoners/na/Dark-zhang', 'Emerald 2 (S2026)', 22),
  ('billiam', 'owlCrest#268', 'https://op.gg/lol/summoners/na/owlCrest-268', 'Emerald 3 (S2026)', 21),
  ('Jade', 'HinYok#777', 'https://op.gg/lol/summoners/na/HinYok-777', 'Emerald 3 (S2024 S2)', 21),
  ('小E长官#0722', '小E长官#0722', 'https://op.gg/lol/summoners/na/%E5%B0%8FE%E9%95%BF%E5%AE%98-0722', 'Emerald 3 (S2024 S1)', 21),
  ('Doh', 'Doh#9054', 'https://op.gg/lol/summoners/na/Doh-9054', 'Emerald 4 (S2026)', 20),
  ('Gato', 'Gato#Fato', 'https://op.gg/lol/summoners/na/Gato-Fato', 'Emerald 4 (S2026)', 20),
  ('moon', 'moon#90849', 'https://op.gg/lol/summoners/na/moon-90849', 'Emerald 4 (S2026)', 20),
  ('Cat', 'Catheon#2nd', 'https://op.gg/lol/summoners/na/Catheon-2nd', 'Platinum 1 (S2025)', 19),
  ('Ironscoutb/Khalid', 'ironscoutb#7420', 'https://op.gg/lol/summoners/na/ironscoutb-7420', 'Platinum 2 (S2026)', 18),
  ('Psychopomp333', 'Psychopomp333#NA1', 'https://op.gg/lol/summoners/na/Psychopomp333-NA1', 'Platinum 2 (S2026)', 18),
  ('SonionEmperor', 'Insulated Window#toot', 'https://op.gg/lol/summoners/na/Insulated%20Window-toot', 'Platinum 2 (S2026)', 18),
  ('ChessDouDou', 'ChessDouDou#2383', 'https://op.gg/lol/summoners/na/ChessDouDou-2383', 'Platinum 4 (S2026)', 16),
  ('Ethan', 'lil E955#NA1', 'https://op.gg/lol/summoners/na/lil%20E955-NA1', 'Platinum 4 (S2026)', 16),
  ('Koral / Andrew', 'BorkenBlender347#kor4l', 'https://op.gg/lol/summoners/na/BorkenBlender347-kor4l', 'Gold 1 (S2026)', 15),
  ('gostmeaper', 'Gost#5757', 'https://op.gg/lol/summoners/na/Gost-5757', 'Gold 2 (S2026)', 14),
  ('Mitosis/Max', 'Mitosis#143', 'https://op.gg/lol/summoners/na/Mitosis-143', 'Gold 3 (S2026)', 13),
  ('qtrf', 'mymelody#428', 'https://op.gg/lol/summoners/na/mymelody-428', 'Gold 4 (S2026)', 12),
  ('Noah - Sumeguy whatever works', '诺音和#FtFF', 'https://op.gg/lol/summoners/na/%E8%AF%BA%E9%9F%B3%E5%92%8C-FtFF', 'Silver 3 (S2026)', 9);

  -- Never recycle a former captain ID for a different person: an old browser
  -- confirmation can still submit that numerical ID after the roster refresh.
  if exists(select 1 from public.captains c join pg_temp.roster_next_captains n on n.id=c.id where lower(n.riot_id)<>lower(c.riot_id))
     or exists(select 1 from public.captains c join pg_temp.roster_next_captains n on lower(n.riot_id)=lower(c.riot_id) where n.id<>c.id) then
    raise exception 'Roster refresh must preserve existing captain IDs';
  end if;

  -- All captain/player mutations acquire the same draft lock. Preserve sessions
  -- by Riot ID, never by the old numerical slot, before replacing captain rows.
  create temporary table roster_saved_claims on commit drop as
    select lower(c.riot_id) as identity,c.claimed,c.ready,t.token_hash
    from public.captains c left join public.captain_tokens t on t.captain_id=c.id;

  delete from public.captain_tokens;
  delete from public.captains;
  insert into public.captains(id,slot,display_name,riot_id,opgg_url,peak_rank,rank_score,claimed,ready)
    select n.id,n.slot,n.display_name,n.riot_id,n.opgg_url,n.peak_rank,n.rank_score,
      coalesce(s.claimed and s.token_hash is not null,false),
      coalesce(s.ready and s.claimed and s.token_hash is not null,false)
    from pg_temp.roster_next_captains n
    left join pg_temp.roster_saved_claims s on s.identity=lower(n.riot_id);
  insert into public.captain_tokens(captain_id,token_hash)
    select n.id,s.token_hash from pg_temp.roster_next_captains n
    join pg_temp.roster_saved_claims s on s.identity=lower(n.riot_id)
    where s.claimed and s.token_hash is not null;

  -- Keep matching player IDs, attendance and private check-in tokens.
  update public.players p set display_name=n.display_name,riot_id=n.riot_id,
    opgg_url=n.opgg_url,peak_rank=n.peak_rank,rank_score=n.rank_score
    from pg_temp.roster_next_players n where lower(p.riot_id)=lower(n.riot_id);
  -- Removed players and promoted captains lose only their old player token.
  delete from public.players p where not exists
    (select 1 from pg_temp.roster_next_players n where lower(n.riot_id)=lower(p.riot_id));
  insert into public.players(display_name,riot_id,opgg_url,peak_rank,rank_score)
    select n.display_name,n.riot_id,n.opgg_url,n.peak_rank,n.rank_score
    from pg_temp.roster_next_players n where not exists
      (select 1 from public.players p where lower(p.riot_id)=lower(n.riot_id))
    order by n.rank_score desc,n.display_name;
  perform public.touch_draft();
end $refresh_roster$;
