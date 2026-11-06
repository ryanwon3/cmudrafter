-- Highest recorded solo/duo ranks available on the 52 OP.GG profiles, November 6, 2026.
-- Evidence and coverage limits: docs/peak-rank-audit-2026-11-06.md and .json.
-- Metadata only: preserve IDs, slots, attendance, tokens, picks and tournament state.
do $$
declare
  entry record;
  affected integer;
begin
  perform 1 from public.draft where id=1 for update;
  if not found then raise exception 'Rank audit requires the draft singleton'; end if;
  for entry in
    select * from jsonb_to_recordset($ranks$
[
  {
    "kind": "captain",
    "riot_id": "Thechomania2#SION",
    "peak_rank": "Diamond 3 56 LP (S2026)",
    "rank_score": 25.56
  },
  {
    "kind": "captain",
    "riot_id": "Admirality#Death",
    "peak_rank": "Diamond 4 38 LP (S2025)",
    "rank_score": 24.38
  },
  {
    "kind": "captain",
    "riot_id": "Ezhister#NA1",
    "peak_rank": "Diamond 1 58 LP (S2026)",
    "rank_score": 27.58
  },
  {
    "kind": "captain",
    "riot_id": "CatGPT#YouMe",
    "peak_rank": "Master 2 LP (S2026)",
    "rank_score": 28.02
  },
  {
    "kind": "captain",
    "riot_id": "holiday#001",
    "peak_rank": "Master 415 LP (S2026)",
    "rank_score": 32.15
  },
  {
    "kind": "captain",
    "riot_id": "foryoutoenvy#astro",
    "peak_rank": "Master 330 LP (S2026)",
    "rank_score": 31.3
  },
  {
    "kind": "captain",
    "riot_id": "UPMC Kassadin#CMU",
    "peak_rank": "Master 717 LP (S2026)",
    "rank_score": 35.17
  },
  {
    "kind": "captain",
    "riot_id": "rakwillsuk#uwu",
    "peak_rank": "Master 1041 LP (S2026)",
    "rank_score": 38.41
  },
  {
    "kind": "player",
    "riot_id": "elfaria#wand",
    "peak_rank": "Master 817 LP (S2026)",
    "rank_score": 36.17
  },
  {
    "kind": "player",
    "riot_id": "GamerNamer#NA1",
    "peak_rank": "Master 551 LP (S2026)",
    "rank_score": 33.51
  },
  {
    "kind": "player",
    "riot_id": "Muffintopper66#NA1",
    "peak_rank": "Master 409 LP (S2026)",
    "rank_score": 32.09
  },
  {
    "kind": "player",
    "riot_id": "Xeuhktal#NA1",
    "peak_rank": "Master 326 LP (S2026)",
    "rank_score": 31.26
  },
  {
    "kind": "player",
    "riot_id": "westieyy#3uu",
    "peak_rank": "Master 300 LP (S2023 S1)",
    "rank_score": 31.0
  },
  {
    "kind": "player",
    "riot_id": "Wythe89#SEXY",
    "peak_rank": "Master 175 LP (S2026)",
    "rank_score": 29.75
  },
  {
    "kind": "player",
    "riot_id": "jenesis#oguri",
    "peak_rank": "Master 171 LP (S2026)",
    "rank_score": 29.71
  },
  {
    "kind": "player",
    "riot_id": "Curse Of Dragons#NA1",
    "peak_rank": "Master 147 LP (S2026)",
    "rank_score": 29.47
  },
  {
    "kind": "player",
    "riot_id": "Mizrah#NA1",
    "peak_rank": "Master 139 LP (S2026)",
    "rank_score": 29.39
  },
  {
    "kind": "player",
    "riot_id": "Drock#2000",
    "peak_rank": "Master 132 LP (S2026)",
    "rank_score": 29.32
  },
  {
    "kind": "player",
    "riot_id": "Rukasuk#000",
    "peak_rank": "Master 130 LP (S2023 S2)",
    "rank_score": 29.3
  },
  {
    "kind": "player",
    "riot_id": "Jubilatory#that",
    "peak_rank": "Master 90 LP (S2026)",
    "rank_score": 28.9
  },
  {
    "kind": "player",
    "riot_id": "ethers#000",
    "peak_rank": "Master 16 LP (S2026)",
    "rank_score": 28.16
  },
  {
    "kind": "player",
    "riot_id": "GreySwag#6877",
    "peak_rank": "Diamond 1 2 LP (S2026)",
    "rank_score": 27.02
  },
  {
    "kind": "player",
    "riot_id": "WaGe#314",
    "peak_rank": "Diamond 1 16 LP (S2026)",
    "rank_score": 27.16
  },
  {
    "kind": "player",
    "riot_id": "boomsiru#NA1",
    "peak_rank": "Diamond 2 64 LP (S2025)",
    "rank_score": 26.64
  },
  {
    "kind": "player",
    "riot_id": "Yazurak#000",
    "peak_rank": "Diamond 2 31 LP (S2026)",
    "rank_score": 26.31
  },
  {
    "kind": "player",
    "riot_id": "Azenkora#na2",
    "peak_rank": "Diamond 4 14 LP (S2026)",
    "rank_score": 24.14
  },
  {
    "kind": "player",
    "riot_id": "mrbbone#NA1",
    "peak_rank": "Diamond 4 55 LP (S2026)",
    "rank_score": 24.55
  },
  {
    "kind": "player",
    "riot_id": "physiX#TPX",
    "peak_rank": "Diamond 4 95 LP (S2026)",
    "rank_score": 24.95
  },
  {
    "kind": "player",
    "riot_id": "Sparkeyz#NA1",
    "peak_rank": "Diamond 4 62 LP (S2026)",
    "rank_score": 24.62
  },
  {
    "kind": "player",
    "riot_id": "Roswaalu#0000",
    "peak_rank": "Emerald 1 80 LP (S2026)",
    "rank_score": 23.8
  },
  {
    "kind": "player",
    "riot_id": "seven#0715",
    "peak_rank": "Diamond 2 12 LP (S2026)",
    "rank_score": 26.12
  },
  {
    "kind": "player",
    "riot_id": "TPX adocado1024#TPX",
    "peak_rank": "Emerald 2 57 LP (S2026)",
    "rank_score": 22.57
  },
  {
    "kind": "player",
    "riot_id": "SquigglyLine#Fart",
    "peak_rank": "Emerald 2 75 LP (S2026)",
    "rank_score": 22.75
  },
  {
    "kind": "player",
    "riot_id": "luffydoc777#Unc",
    "peak_rank": "Emerald 2 21 LP (S2026)",
    "rank_score": 22.21
  },
  {
    "kind": "player",
    "riot_id": "Dark#zhang",
    "peak_rank": "Emerald 2 92 LP (S2026)",
    "rank_score": 22.92
  },
  {
    "kind": "player",
    "riot_id": "owlCrest#268",
    "peak_rank": "Emerald 3 24 LP (S2026)",
    "rank_score": 21.24
  },
  {
    "kind": "player",
    "riot_id": "HinYok#777",
    "peak_rank": "Emerald 3 98 LP (S2023 S2)",
    "rank_score": 21.98
  },
  {
    "kind": "player",
    "riot_id": "小E长官#0722",
    "peak_rank": "Emerald 3 0 LP (S2024 S1)",
    "rank_score": 21.0
  },
  {
    "kind": "player",
    "riot_id": "Doh#9054",
    "peak_rank": "Emerald 4 8 LP (S2026)",
    "rank_score": 20.08
  },
  {
    "kind": "player",
    "riot_id": "Gato#Fato",
    "peak_rank": "Emerald 3 8 LP (S2026)",
    "rank_score": 21.08
  },
  {
    "kind": "player",
    "riot_id": "moon#90849",
    "peak_rank": "Emerald 4 62 LP (S2026)",
    "rank_score": 20.62
  },
  {
    "kind": "player",
    "riot_id": "Catheon#2nd",
    "peak_rank": "Emerald 4 17 LP (S2025)",
    "rank_score": 20.17
  },
  {
    "kind": "player",
    "riot_id": "ironscoutb#7420",
    "peak_rank": "Platinum 2 27 LP (S2026)",
    "rank_score": 18.27
  },
  {
    "kind": "player",
    "riot_id": "Psychopomp333#NA1",
    "peak_rank": "Emerald 4 60 LP (S2026)",
    "rank_score": 20.6
  },
  {
    "kind": "player",
    "riot_id": "Insulated Window#toot",
    "peak_rank": "Platinum 2 73 LP (S2026)",
    "rank_score": 18.73
  },
  {
    "kind": "player",
    "riot_id": "ChessDouDou#2383",
    "peak_rank": "Platinum 4 55 LP (S2026)",
    "rank_score": 16.55
  },
  {
    "kind": "player",
    "riot_id": "lil E955#NA1",
    "peak_rank": "Platinum 4 87 LP (S2026)",
    "rank_score": 16.87
  },
  {
    "kind": "player",
    "riot_id": "BorkenBlender347#kor4l",
    "peak_rank": "Gold 1 70 LP (S2026)",
    "rank_score": 15.7
  },
  {
    "kind": "player",
    "riot_id": "Gost#5757",
    "peak_rank": "Gold 2 1 LP (S2026)",
    "rank_score": 14.01
  },
  {
    "kind": "player",
    "riot_id": "Mitosis#143",
    "peak_rank": "Gold 3 79 LP (S2026)",
    "rank_score": 13.79
  },
  {
    "kind": "player",
    "riot_id": "mymelody#428",
    "peak_rank": "Gold 4 55 LP (S2026)",
    "rank_score": 12.55
  },
  {
    "kind": "player",
    "riot_id": "诺音和#FtFF",
    "peak_rank": "Silver 3 25 LP (S2026)",
    "rank_score": 9.25
  }
]
$ranks$::jsonb) as r(kind text, riot_id text, peak_rank text, rank_score numeric)
  loop
    if entry.kind='captain' then
      update public.captains c set peak_rank=entry.peak_rank,rank_score=entry.rank_score
        where lower(c.riot_id)=lower(entry.riot_id);
    else
      update public.players p set peak_rank=entry.peak_rank,rank_score=entry.rank_score
        where lower(p.riot_id)=lower(entry.riot_id);
    end if;
    get diagnostics affected = row_count;
    if affected <> 1 then
      raise exception 'Rank audit identity mismatch for % (% matches)',entry.riot_id,affected;
    end if;
  end loop;
end $$;
