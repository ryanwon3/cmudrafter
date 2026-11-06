// Roster from the linked signup sheet, refreshed November 6, 2026.
// Captain order and Ethan/Nelson aliases were confirmed by the organizer.
// Solo/duo peaks audited against live OP.GG profiles on November 6, 2026.
// Mirror of supabase/seed.sql; see docs/peak-rank-audit-2026-11-06.md.
import type { Captain, Player } from '../types';
type CaptainSeed = Omit<Captain, 'claimed' | 'ready'>;
type PlayerSeed = Omit<Player, 'id' | 'team_captain_id' | 'pick_number' | 'present'>;
const opgg = (riotId: string) => 'https://op.gg/lol/summoners/na/' + encodeURIComponent(riotId).replace('%23', '-');
const c = (id: number, slot: number, display_name: string, riot_id: string, peak_rank: string, rank_score: number): CaptainSeed => ({ id, slot, display_name, riot_id, opgg_url: opgg(riot_id), peak_rank, rank_score });
const p = (display_name: string, riot_id: string, peak_rank: string, rank_score: number): PlayerSeed => ({ display_name, riot_id, opgg_url: opgg(riot_id), peak_rank, rank_score });
export const CAPTAINS: CaptainSeed[] = [
  c(1, 1, "Chomania", "Thechomania2#SION", "Diamond 3 56 LP (S2026)", 25.56),
  c(2, 2, "Admirality", "Admirality#Death", "Diamond 4 38 LP (S2025)", 24.38),
  c(4, 3, "Kyle", "Ezhister#NA1", "Diamond 1 58 LP (S2026)", 27.58),
  c(5, 4, "Allen", "CatGPT#YouMe", "Master 2 LP (S2026)", 28.02),
  c(6, 5, "Brian (Holiday)", "holiday#001", "Master 415 LP (S2026)", 32.15),
  c(7, 6, "Envy", "foryoutoenvy#astro", "Master 330 LP (S2026)", 31.3),
  c(8, 7, "Ethan", "UPMC Kassadin#CMU", "Master 717 LP (S2026)", 35.17),
  c(9, 8, "Nelson", "rakwillsuk#uwu", "Master 1041 LP (S2026)", 38.41),
];
export const PLAYERS: PlayerSeed[] = [
  p("Umbry", "elfaria#wand", "Master 817 LP (S2026)", 36.17),
  p("Caden", "GamerNamer#NA1", "Master 551 LP (S2026)", 33.51),
  p("Muffintopper66 (Nick Crosson)", "Muffintopper66#NA1", "Master 409 LP (S2026)", 32.09),
  p("victor", "Xeuhktal#NA1", "Master 326 LP (S2026)", 31.26),
  p("Ulysses", "westieyy#3uu", "Master 300 LP (S2023 S1)", 31.0),
  p("Wythe89#SEXY", "Wythe89#SEXY", "Master 175 LP (S2026)", 29.75),
  p("Jenesis / Jacob", "jenesis#oguri", "Master 171 LP (S2026)", 29.71),
  p("dragonguy168 / David", "Curse Of Dragons#NA1", "Master 147 LP (S2026)", 29.47),
  p("Mizrah/Zach", "Mizrah#NA1", "Master 139 LP (S2026)", 29.39),
  p("Drock/Derek", "Drock#2000", "Master 132 LP (S2026)", 29.32),
  p("Alex/Rukasuk", "Rukasuk#000", "Master 130 LP (S2023 S2)", 29.3),
  p("Jubilatory | Jamie", "Jubilatory#that", "Master 90 LP (S2026)", 28.9),
  p("ethers#000", "ethers#000", "Master 16 LP (S2026)", 28.16),
  p("wa_ge314", "WaGe#314", "Diamond 1 16 LP (S2026)", 27.16),
  p("greyswag", "GreySwag#6877", "Diamond 1 2 LP (S2026)", 27.02),
  p("boomsiru", "boomsiru#NA1", "Diamond 2 64 LP (S2025)", 26.64),
  p("Yazurak", "Yazurak#000", "Diamond 2 31 LP (S2026)", 26.31),
  p("Seven", "seven#0715", "Diamond 2 12 LP (S2026)", 26.12),
  p("physiX / Phy", "physiX#TPX", "Diamond 4 95 LP (S2026)", 24.95),
  p("Sparkeyz / Austin", "Sparkeyz#NA1", "Diamond 4 62 LP (S2026)", 24.62),
  p("mrbbone / Bryce", "mrbbone#NA1", "Diamond 4 55 LP (S2026)", 24.55),
  p("Alex", "Azenkora#na2", "Diamond 4 14 LP (S2026)", 24.14),
  p("Roswaalu / Ros or Josh", "Roswaalu#0000", "Emerald 1 80 LP (S2026)", 23.8),
  p("Sid", "Dark#zhang", "Emerald 2 92 LP (S2026)", 22.92),
  p("Charlie- SquigglyLine", "SquigglyLine#Fart", "Emerald 2 75 LP (S2026)", 22.75),
  p("adocado", "TPX adocado1024#TPX", "Emerald 2 57 LP (S2026)", 22.57),
  p("luffydoc777/Peter", "luffydoc777#Unc", "Emerald 2 21 LP (S2026)", 22.21),
  p("Jade", "HinYok#777", "Emerald 3 98 LP (S2023 S2)", 21.98),
  p("billiam", "owlCrest#268", "Emerald 3 24 LP (S2026)", 21.24),
  p("Gato", "Gato#Fato", "Emerald 3 8 LP (S2026)", 21.08),
  p("小E长官#0722", "小E长官#0722", "Emerald 3 0 LP (S2024 S1)", 21.0),
  p("moon", "moon#90849", "Emerald 4 62 LP (S2026)", 20.62),
  p("Psychopomp333", "Psychopomp333#NA1", "Emerald 4 60 LP (S2026)", 20.6),
  p("Cat", "Catheon#2nd", "Emerald 4 17 LP (S2025)", 20.17),
  p("Doh", "Doh#9054", "Emerald 4 8 LP (S2026)", 20.08),
  p("SonionEmperor", "Insulated Window#toot", "Platinum 2 73 LP (S2026)", 18.73),
  p("Ironscoutb/Khalid", "ironscoutb#7420", "Platinum 2 27 LP (S2026)", 18.27),
  p("Ethan", "lil E955#NA1", "Platinum 4 87 LP (S2026)", 16.87),
  p("ChessDouDou", "ChessDouDou#2383", "Platinum 4 55 LP (S2026)", 16.55),
  p("Koral / Andrew", "BorkenBlender347#kor4l", "Gold 1 70 LP (S2026)", 15.7),
  p("gostmeaper", "Gost#5757", "Gold 2 1 LP (S2026)", 14.01),
  p("Mitosis/Max", "Mitosis#143", "Gold 3 79 LP (S2026)", 13.79),
  p("qtrf", "mymelody#428", "Gold 4 55 LP (S2026)", 12.55),
  p("Noah - Sumeguy whatever works", "诺音和#FtFF", "Silver 3 25 LP (S2026)", 9.25),
];
