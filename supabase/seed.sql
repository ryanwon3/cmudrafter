-- Seed data: run after schema.sql.
-- rank_score: Iron 4 = 0, +1 per division (Diamond 1 = 27), Master = 28 + LP/100.

insert into draft (id, phase, pick_index, picks_per_team) values (1, 'lobby', 0, 4);

insert into captains (id, slot, display_name, riot_id, opgg_url, peak_rank, rank_score) values
  (1, 1, 'Chomania',               'Thechomania2#SION',  'https://op.gg/lol/summoners/na/Thechomania2-SION',     'Diamond 4',     24),
  (2, 2, 'Admirality',             'Admirality#Death',   'https://op.gg/lol/summoners/na/Admirality-Death',      'Emerald 2',     22),
  (3, 3, 'Ethers',                 'ethers#000',         'https://op.gg/lol/summoners/na/ethers-000',            'Master 16 LP',  28.16),
  (4, 4, 'Kyle',                   'Ezhister#NA1',       'https://op.gg/lol/summoners/na/Ezhister-NA1',          'Diamond 1',     27),
  (5, 5, 'Allen',                  'CatGPT#YouMe',       'https://op.gg/lol/summoners/na/CatGPT-YouMe',          'Master 2 LP',   28.02),
  (6, 6, 'Brian (Holiday)',        'holiday#001',        'https://op.gg/lol/summoners/na/holiday-001',           'Master 415 LP', 32.15),
  (7, 7, 'Envy',                   'foryoutoenvy#astro', 'https://op.gg/lol/summoners/na/foryoutoenvy-astro',    'Master 330 LP', 31.30),
  (8, 8, 'Ethan (UPMC Kassadin)',  'UPMC Kassadin#CMU',  'https://op.gg/lol/summoners/na/UPMC%20Kassadin-CMU',   'Master 594 LP', 33.94);

insert into players (display_name, riot_id, opgg_url, peak_rank, rank_score) values
  ('ruk',                           'rakwillsuk#uwu',          'https://op.gg/lol/summoners/na/rakwillsuk-uwu',             'Master 1041 LP (S2026)',  38.41),
  ('Caden',                         'GamerNamer#NA1',          'https://op.gg/lol/summoners/na/GamerNamer-NA1',             'Master 551 LP (S2026)',   33.51),
  ('victor',                        'Xeuhktal#NA1',            'https://op.gg/lol/summoners/na/Xeuhktal-NA1',               'Master 326 LP (S2026)',   31.26),
  ('Ulysses',                       'westieyy#3uu',            'https://op.gg/lol/summoners/na/westieyy-3uu',               'Master 300 LP (S2023 S1)', 31),
  ('Jenesis / Jacob',               'jenesis#oguri',           'https://op.gg/lol/summoners/na/jenesis-oguri',              'Master 171 LP (S2026)',   29.71),
  ('dragonguy168 / David',          'Curse Of Dragons#NA1',    'https://op.gg/lol/summoners/na/Curse%20Of%20Dragons-NA1',   'Master 147 LP (S2026)',   29.47),
  ('Drock/Derek',                   'Drock#2000',              'https://op.gg/lol/summoners/na/Drock-2000',                 'Master 132 LP (S2026)',   29.32),
  ('Alex/Rukasuk',                  'Rukasuk#000',             'https://op.gg/lol/summoners/na/Rukasuk-000',                'Master 130 LP (S2023 S2)', 29.3),
  ('wa_ge314',                      'WaGe#314',                'https://op.gg/lol/summoners/na/WaGe-314',                   'Diamond 1 (S2026)',       27),
  ('greyswag',                      'GreySwag#6877',           'https://op.gg/lol/summoners/na/GreySwag-6877',              'Diamond 1 (S2026)',       27),
  ('boomsiru',                      'boomsiru#NA1',            'https://op.gg/lol/summoners/na/boomsiru-NA1',               'Diamond 2 (S2026)',       26),
  ('Yazurak',                       'Yazurak#000',             'https://op.gg/lol/summoners/na/Yazurak-000',                'Diamond 3 (S2026)',       25),
  ('Alex',                          'Azenkora#na2',            'https://op.gg/lol/summoners/na/Azenkora-na2',               'Diamond 4 (S2026)',       24),
  ('Sparkeyz / Austin',             'Sparkeyz#NA1',            'https://op.gg/lol/summoners/na/Sparkeyz-NA1',               'Diamond 4 (S2026)',       24),
  ('physiX / Phy',                  'physiX#TPX',              'https://op.gg/lol/summoners/na/physiX-TPX',                 'Diamond 4 (S2026)',       24),
  ('luffydoc777/Peter',             'luffydoc777#Unc',         'https://op.gg/lol/summoners/na/luffydoc777-Unc',            'Emerald 2 (S2026)',       22),
  ('adocado',                       'TPX adocado1024#TPX',     'https://op.gg/lol/summoners/na/TPX%20adocado1024-TPX',      'Emerald 2 (S2026)',       22),
  ('Charlie-SquigglyLine',          'SquigglyLine#Fart',       'https://op.gg/lol/summoners/na/SquigglyLine-Fart',          'Emerald 2 (S2026)',       22),
  ('Sid',                           'Dark#zhang',              'https://op.gg/lol/summoners/na/Dark-zhang',                 'Emerald 2 (S2026)',       22),
  ('billiam',                       'owlCrest#268',            'https://op.gg/lol/summoners/na/owlCrest-268',               'Emerald 3 (S2026)',       21),
  ('Flammable Tea / Rohan',         'Flammable Tea#NA1',       'https://op.gg/lol/summoners/na/Flammable%20Tea-NA1',        'Emerald 3 (S2026)',       21),
  ('Jade',                          'HinYok#777',              'https://op.gg/lol/summoners/na/HinYok-777',                 'Emerald 3 (S2024 S2)',    21),
  ('Doh',                           'Doh#9054',                'https://op.gg/lol/summoners/na/Doh-9054',                   'Emerald 4 (S2026)',       20),
  ('adctonio',                      'adctonio#adc',            'https://op.gg/lol/summoners/na/adctonio-adc',               'Emerald 4 (S2024 S1)',    20),
  ('Gato',                          'Gato#Fato',               'https://op.gg/lol/summoners/na/Gato-Fato',                  'Emerald 4 (S2026)',       20),
  ('moon',                          'moon#90849',              'https://op.gg/lol/summoners/na/moon-90849',                 'Emerald 4 (S2026)',       20),
  ('Cat',                           'Catheon#2nd',             'https://op.gg/lol/summoners/na/Catheon-2nd',                'Platinum 1 (S2025)',      19),
  ('SonionEmperor',                 'Insulated Window#toot',   'https://op.gg/lol/summoners/na/Insulated%20Window-toot',    'Platinum 2 (S2026)',      18),
  ('Psychopomp333',                 'Psychopomp333#NA1',       'https://op.gg/lol/summoners/na/Psychopomp333-NA1',          'Platinum 2 (S2026)',      18),
  ('ChessDouDou',                   'ChessDouDou#2383',        'https://op.gg/lol/summoners/na/ChessDouDou-2383',           'Platinum 4 (S2026)',      16),
  ('Koral / Andrew',                'BorkenBlender347#kor4l',  'https://op.gg/lol/summoners/na/BorkenBlender347-kor4l',     'Gold 1 (S2026)',          15),
  ('gostmeaper',                    'Gost#5757',               'https://op.gg/lol/summoners/na/Gost-5757',                  'Gold 2 (S2026)',          14),
  ('Mitosis/Max',                   'Mitosis#143',             'https://op.gg/lol/summoners/na/Mitosis-143',                'Gold 3 (S2026)',          13),
  ('qtrf',                          'mymelody#428',            'https://op.gg/lol/summoners/na/mymelody-428',               'Gold 4 (S2026)',          12),
  ('Noah - Sumeguy whatever works', '诺音和#FtFF',             'https://op.gg/lol/summoners/na/%E8%AF%BA%E9%9F%B3%E5%92%8C-FtFF', 'Silver 3 (S2026)',  9);
