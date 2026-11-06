import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const migration=()=>readFileSync('supabase/migrations/20261106055132_refresh_event_roster.sql','utf8');
async function oldDatabase() {
  const db=new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create publication supabase_realtime;');
  await db.exec(readFileSync('supabase/migrations/20261105203908_initialize_inhouse_draft.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/20261106035130_attendance_and_admin_phases.sql','utf8'));
  return db;
}

test('roster replacement preserves identities across captain slot changes and player promotion', async()=>{
  const db=await oldDatabase();
  try {
    await db.exec("select claim_captain(4,'kyle-token'); select set_ready('kyle-token',true); select claim_captain(3,'ethers-token'); select claim_captain(8,'ethan-token'); select check_in_player(26,'moon-token'); select check_in_player(1,'ruk-token'); select check_in_player(21,'removed-token');");
    await db.exec(migration());
    const identities=await db.query<{kyle:number;ethers:number|null;ethan:number;moon:number;ruk:number|null;removed:number|null}>("select captain_for_token('kyle-token') as kyle,captain_for_token('ethers-token') as ethers,captain_for_token('ethan-token') as ethan,player_for_token('moon-token') as moon,player_for_token('ruk-token') as ruk,player_for_token('removed-token') as removed");
    assert.deepEqual(identities.rows[0],{kyle:4,ethers:null,ethan:8,moon:26,ruk:null,removed:null});
    const captains=await db.query<{display_name:string;riot_id:string;claimed:boolean;ready:boolean}>('select display_name,riot_id,claimed,ready from captains order by slot');
    assert.deepEqual(captains.rows.map(c=>c.display_name),['Chomania','Admirality','Kyle','Allen','Brian (Holiday)','Envy','Ethan','Nelson']);
    assert.equal(captains.rows[2].ready,true);
    assert.equal(captains.rows[7].riot_id,'rakwillsuk#uwu');
    assert.equal(captains.rows[7].claimed,false);
    const players=await db.query<{riot_id:string;present:boolean}>('select riot_id,present from players');
    assert.equal(players.rows.length,43);
    assert.ok(players.rows.some(p=>p.riot_id==='ethers#000'));
    assert.ok(players.rows.some(p=>p.riot_id==='lil E955#NA1'));
    assert.ok(players.rows.some(p=>p.riot_id==='moon#90849'&&p.present));
    assert.ok(!players.rows.some(p=>p.riot_id==='rakwillsuk#uwu'));
    // Reapplying a data migration must not duplicate players or lose sessions.
    await db.exec(migration());
    assert.deepEqual((await db.query('select id,riot_id,present from players order by id')).rows.length,43);
    assert.equal((await db.query<{id:number}>("select captain_for_token('kyle-token') as id")).rows[0].id,4);
  }finally{await db.close();}
});

test('a stale confirmation for former captain Ethers cannot claim Kyle after reordering', async()=>{
  const db=await oldDatabase();
  try {
    await db.exec(migration());
    await assert.rejects(db.exec("select claim_captain(3,'stale-ethers-claim')"),/doesn't exist/);
    assert.equal((await db.query<{id:number|null}>("select captain_for_token('stale-ethers-claim') as id")).rows[0].id,null);
  }finally{await db.close();}
});

test('roster migration refuses an active draft and preserves its picks', async()=>{
  const db=await oldDatabase();
  try {
    await db.exec("select check_in_player(id,'p'||id) from players; select admin_force_start(); select admin_pick(1,0);");
    const before=(await db.query('select get_state() as state')).rows[0];
    await assert.rejects(db.exec(migration()),/unused lobby/);
    assert.deepEqual((await db.query('select get_state() as state')).rows[0],before);
  }finally{await db.close();}
});
