import type { BracketMatchId, Captain, DraftState, TournamentBracket } from './types';

export const MATCH_IDS: BracketMatchId[] = ['qf1','qf2','qf3','qf4','sf1','sf2','final'];
export const MATCH_DESCENDANTS: Record<BracketMatchId, BracketMatchId[]> = {
  qf1:['sf1','final'],qf2:['sf1','final'],qf3:['sf2','final'],qf4:['sf2','final'],
  sf1:['final'],sf2:['final'],final:[],
};
export interface BracketMatch {
  id: BracketMatchId;
  label: string;
  round: 'Quarterfinals' | 'Semifinals' | 'Final';
  teamIds: [number | null, number | null];
  winnerId: number | null;
}
export function defaultBracket(captains: Captain[]): TournamentBracket {
  return {
    seeds: [1,8,4,5,2,7,3,6].map(slot => captains.find(c=>c.slot===slot)!.id),
    winners: {},
  };
}
export function effectiveBracket(state: DraftState): TournamentBracket {
  return state.draft.bracket ?? defaultBracket(state.captains);
}
export function bracketMatches(bracket: TournamentBracket): BracketMatch[] {
  const {seeds,winners}=bracket;
  const match=(id:BracketMatchId,label:string,round:BracketMatch['round'],a:number|null,b:number|null):BracketMatch =>
    ({id,label,round,teamIds:[a,b],winnerId:winners[id]??null});
  return [
    ...(['qf1','qf2','qf3','qf4'] as const).map((id,i)=>match(id,`Quarterfinal ${i+1}`,'Quarterfinals',seeds[i*2]??null,seeds[i*2+1]??null)),
    match('sf1','Semifinal 1','Semifinals',winners.qf1??null,winners.qf2??null),
    match('sf2','Semifinal 2','Semifinals',winners.qf3??null,winners.qf4??null),
    match('final','Final','Final',winners.sf1??null,winners.sf2??null),
  ];
}
