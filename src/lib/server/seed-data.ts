// Roster from the linked signup sheet, refreshed November 6, 2026.
// Captain order and Ethan/Nelson aliases were confirmed by the organizer.
// Mirror of supabase/seed.sql; hosted upgrades use the tracked roster migration.
import type { Captain, Player } from '../types';
type CaptainSeed = Omit<Captain, 'claimed' | 'ready'>;
type PlayerSeed = Omit<Player, 'id' | 'team_captain_id' | 'pick_number' | 'present'>;
const opgg = (riotId: string) => 'https://op.gg/lol/summoners/na/' + encodeURIComponent(riotId).replace('%23', '-');
const c = (id: number, slot: number, display_name: string, riot_id: string, peak_rank: string, rank_score: number): CaptainSeed => ({ id, slot, display_name, riot_id, opgg_url: opgg(riot_id), peak_rank, rank_score });
const p = (display_name: string, riot_id: string, peak_rank: string, rank_score: number): PlayerSeed => ({ display_name, riot_id, opgg_url: opgg(riot_id), peak_rank, rank_score });
export const CAPTAINS: CaptainSeed[] = [
  c(1, 1, "Chomania", "Thechomania2#SION", "Diamond 4", 24),
  c(2, 2, "Admirality", "Admirality#Death", "Emerald 2", 22),
  c(4, 3, "Kyle", "Ezhister#NA1", "Diamond 1", 27),
  c(5, 4, "Allen", "CatGPT#YouMe", "Master 2 LP", 28.02),
  c(6, 5, "Brian (Holiday)", "holiday#001", "Master 415 LP", 32.15),
  c(7, 6, "Envy", "foryoutoenvy#astro", "Master 330 LP", 31.3),
  c(8, 7, "Ethan", "UPMC Kassadin#CMU", "Master 594 LP", 33.94),
  c(9, 8, "Nelson", "rakwillsuk#uwu", "Master 1041 LP", 38.41),
];
export const PLAYERS: PlayerSeed[] = [
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
  p("greyswag", "GreySwag#6877", "Diamond 1 (S2026)", 27),
  p("wa_ge314", "WaGe#314", "Diamond 1 (S2026)", 27),
  p("boomsiru", "boomsiru#NA1", "Diamond 2 (S2026)", 26),
  p("Yazurak", "Yazurak#000", "Diamond 3 (S2026)", 25),
  p("Alex", "Azenkora#na2", "Diamond 4 (S2026)", 24),
  p("mrbbone / Bryce", "mrbbone#NA1", "Diamond 4 (S2026)", 24),
  p("physiX / Phy", "physiX#TPX", "Diamond 4 (S2026)", 24),
  p("Sparkeyz / Austin", "Sparkeyz#NA1", "Diamond 4 (S2026)", 24),
  p("Roswaalu / Ros or Josh", "Roswaalu#0000", "Emerald 1 (S2026)", 23),
  p("Seven", "seven#0715", "Emerald 1 (S2026)", 23),
  p("adocado", "TPX adocado1024#TPX", "Emerald 2 (S2026)", 22),
  p("Charlie- SquigglyLine", "SquigglyLine#Fart", "Emerald 2 (S2026)", 22),
  p("luffydoc777/Peter", "luffydoc777#Unc", "Emerald 2 (S2026)", 22),
  p("Sid", "Dark#zhang", "Emerald 2 (S2026)", 22),
  p("billiam", "owlCrest#268", "Emerald 3 (S2026)", 21),
  p("Jade", "HinYok#777", "Emerald 3 (S2024 S2)", 21),
  p("小E长官#0722", "小E长官#0722", "Emerald 3 (S2024 S1)", 21),
  p("Doh", "Doh#9054", "Emerald 4 (S2026)", 20),
  p("Gato", "Gato#Fato", "Emerald 4 (S2026)", 20),
  p("moon", "moon#90849", "Emerald 4 (S2026)", 20),
  p("Cat", "Catheon#2nd", "Platinum 1 (S2025)", 19),
  p("Ironscoutb/Khalid", "ironscoutb#7420", "Platinum 2 (S2026)", 18),
  p("Psychopomp333", "Psychopomp333#NA1", "Platinum 2 (S2026)", 18),
  p("SonionEmperor", "Insulated Window#toot", "Platinum 2 (S2026)", 18),
  p("ChessDouDou", "ChessDouDou#2383", "Platinum 4 (S2026)", 16),
  p("Ethan", "lil E955#NA1", "Platinum 4 (S2026)", 16),
  p("Koral / Andrew", "BorkenBlender347#kor4l", "Gold 1 (S2026)", 15),
  p("gostmeaper", "Gost#5757", "Gold 2 (S2026)", 14),
  p("Mitosis/Max", "Mitosis#143", "Gold 3 (S2026)", 13),
  p("qtrf", "mymelody#428", "Gold 4 (S2026)", 12),
  p("Noah - Sumeguy whatever works", "诺音和#FtFF", "Silver 3 (S2026)", 9),
];
