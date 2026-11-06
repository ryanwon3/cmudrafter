import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalStore} from '../src/lib/server/local-store';
import {bracketMatches,effectiveBracket} from '../src/lib/bracket';

async function published() {
  const store=new LocalStore();
  await store.adminStart();
  await store.adminFinish();
  await store.adminPublish();
  return store;
}

test('default bracket uses draft slots and exposes unresolved later matches', async()=>{
  const state=await (await published()).getState();
  const matches=bracketMatches(effectiveBracket(state));
  assert.deepEqual(matches.map(m=>m.teamIds),[[1,9],[5,6],[2,8],[4,7],[null,null],[null,null],[null,null]]);
});

test('admin can initialize default seeded matchups using stable captain IDs', async()=>{
  const store=await published();
  const state=await store.getState();
  assert.equal(state.draft.bracket_revision,0);
  await store.adminBracketSeeds([1,9,5,6,2,8,4,7],0);
  const after=await store.getState();
  assert.deepEqual(after.draft.bracket?.seeds,[1,9,5,6,2,8,4,7]);
  assert.deepEqual(after.draft.bracket?.winners,{});
});

test('bracket editing requires published results and unique valid teams', async()=>{
  const store=new LocalStore();
  await assert.rejects(store.adminBracketSeeds([1,9,5,6,2,8,4,7],0),/published/);
  await store.adminStart(); await store.adminFinish(); await store.adminPublish();
  for(const ids of [[1,1,5,6,2,8,4,7],[1,9,5,6,2,8,4,3],[1,9]]) {
    await assert.rejects(store.adminBracketSeeds(ids,0),/eight|8/);
  }
  await assert.rejects(store.adminBracketResult('bad',1,0),/match/i);
  await assert.rejects(store.adminBracketResult('sf1',1,0),/participants|ready|determined/);
  await assert.rejects(store.adminBracketResult('qf1',5,0),/match|participant/);
});

test('seven match results advance teams to a champion and reject stale edits', async()=>{
  const store=await published();
  const results:[string,number][]=[['qf1',1],['qf2',5],['qf3',2],['qf4',4],['sf1',1],['sf2',2],['final',2]];
  for(let i=0;i<results.length;i++) await store.adminBracketResult(...results[i],i);
  const state=await store.getState();
  assert.equal(state.draft.bracket?.winners.final,2);
  assert.equal(state.draft.bracket_revision,7);
  await assert.rejects(store.adminBracketResult('final',1,6),/changed|refresh|stale/i);
  assert.equal((await store.getState()).draft.bracket?.winners.final,2);
});

test('correcting or clearing an earlier winner invalidates only descendants', async()=>{
  const store=await published();
  for(const [match,winner] of [['qf1',1],['qf2',5],['qf3',2],['qf4',4],['sf1',1],['sf2',2],['final',2]] as const) {
    await store.adminBracketResult(match,winner,(await store.getState()).draft.bracket_revision);
  }
  await store.adminBracketResult('qf1',9,7);
  assert.deepEqual((await store.getState()).draft.bracket?.winners,{qf1:9,qf2:5,qf3:2,qf4:4,sf2:2});
  await store.adminBracketResult('qf3',null,8);
  assert.deepEqual((await store.getState()).draft.bracket?.winners,{qf1:9,qf2:5,qf4:4});
});

test('reseeding clears results and reset invalidates stale bracket revisions', async()=>{
  const store=await published();
  await store.adminBracketResult('qf1',1,0);
  await store.adminBracketSeeds([9,1,5,6,2,8,4,7],1);
  assert.deepEqual((await store.getState()).draft.bracket?.winners,{});
  await store.adminReset(false);
  assert.equal((await store.getState()).draft.bracket,null);
  assert.equal((await store.getState()).draft.bracket_revision,3);
  await store.adminStart(); await store.adminFinish(); await store.adminPublish();
  await assert.rejects(store.adminBracketResult('qf1',1,2),/changed|refresh|stale/i);
});

test('reselecting a winner keeps later results and undo invalidates the tournament', async()=>{
  const store=new LocalStore();
  await store.checkIn(1,'player'); await store.adminStart(); await store.adminPick(1,0); await store.adminFinish(); await store.adminPublish();
  await store.adminBracketResult('qf1',1,0);
  await store.adminBracketResult('qf2',5,1);
  await store.adminBracketResult('sf1',1,2);
  await store.adminBracketResult('qf1',1,3);
  assert.equal((await store.getState()).draft.bracket?.winners.sf1,1);
  assert.equal((await store.getState()).draft.bracket_revision,3);
  await store.adminUndo();
  const state=await store.getState();
  assert.equal(state.draft.phase,'drafting'); assert.equal(state.draft.bracket,null); assert.equal(state.draft.bracket_revision,4);
});
