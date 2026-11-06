-- Self-checking test of the Postgres functions. Run against a THROWAWAY database
-- after schema.sql + seed.sql (it resets the draft). Any failure raises an error.
--   psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/schema.sql -f supabase/seed.sql -f supabase/tests/draft_test.sql

create or replace function pg_temp.expect_error(sql text, msg text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'expected error "%" from: %', msg, sql;
exception when others then
  if sqlerrm not like msg then raise exception 'expected "%" but got "%" from: %', msg, sqlerrm, sql; end if;
end $$;

do $$
declare
  k int; cid int; pid int; order_ok text; st json;
begin
  perform admin_reset(true);
  assert (select count(*) from captains) = 8, 'captains';
  assert (select count(*) from players) = 35, 'players';

  perform check_in_player(id,'player' || id) from players;

  -- claims
  perform claim_captain(id, 'tok' || id) from captains;
  perform pg_temp.expect_error($q$select claim_captain(1, 'x')$q$, 'Already taken');
  perform release_captain('tok1');
  assert not (select claimed from captains where id = 1), 'release';
  assert captain_for_token('tok1') is null, 'token revoked on release';
  perform claim_captain(1, 'tok1');

  -- ready / un-ready / start
  perform set_ready('tok' || id, true) from captains where id < 8;
  perform set_ready('tok1', false);
  perform set_ready('tok8', true);
  assert (select phase from draft) = 'lobby', 'not started at 7/8';
  perform pg_temp.expect_error($q$select make_pick('tok1', 1)$q$, 'The draft is not running');
  assert not (set_ready('tok1', true) ->> 'started')::boolean, 'waits for organizer';
  perform admin_force_start();
  assert (select phase from draft) = 'drafting', 'drafting';
  perform pg_temp.expect_error($q$select release_captain('tok1')$q$, 'Names can only be released in the lobby%');
  perform pg_temp.expect_error($q$select make_pick('tok2', 1)$q$, 'It''s Chomania''s pick');
  perform pg_temp.expect_error($q$select make_pick('nope', 1)$q$, 'You are not a captain');
  perform pg_temp.expect_error($q$select make_pick('tok1', 1, 5)$q$, 'The board changed. Try again.');

  -- 32 picks in snake order
  for k in 0..31 loop
    select id into cid from captains where slot = slot_on_clock(k);
    select id into pid from players where team_captain_id is null order by rank_score desc, id limit 1;
    perform make_pick('tok' || cid, pid, k);
  end loop;
  select string_agg(c.slot::text, ',' order by p.pick_number) into order_ok
    from players p join captains c on c.id = p.team_captain_id;
  assert order_ok = '1,2,3,4,5,6,7,8,8,7,6,5,4,3,2,1,1,2,3,4,5,6,7,8,8,7,6,5,4,3,2,1', 'snake: ' || order_ok;
  assert (select phase from draft) = 'review', 'review';
  perform admin_publish_results();
  assert (select phase from draft) = 'complete', 'published';
  assert (select count(*) from players where team_captain_id is null) = 3, '3 undrafted';
  perform pg_temp.expect_error($q$select make_pick('tok1', 1)$q$, 'The draft is not running');

  -- undo from complete, then a drafted player is rejected
  perform admin_undo();
  assert (select phase || pick_index from draft) = 'drafting31', 'undo';
  assert (select count(*) from players where team_captain_id is null) = 4, 'player returned';
  perform pg_temp.expect_error($q$select make_pick('tok1', (select id from players where pick_number = 1))$q$, '% was already drafted');
  perform admin_pick((select id from players where team_captain_id is null order by id limit 1), 31);
  assert (select phase from draft) = 'review', 'admin pick enters review';
  perform admin_publish_results();

  -- admin release mid-draft and reclaim
  perform admin_undo();
  perform admin_release(3);
  assert captain_for_token('tok3') is null, 'admin release revokes token';
  perform claim_captain(3, 'tok3b');
  assert captain_for_token('tok3b') = 3, 'reclaim mid-draft';

  -- settings and resets
  perform pg_temp.expect_error($q$select admin_set_picks_per_team(3)$q$, '%only change in the lobby');
  perform admin_reset(false);
  assert (select phase || pick_index from draft) = 'lobby0', 'reset';
  assert (select count(*) from captains where claimed) = 8, 'reset keeps claims';
  assert (select count(*) from captains where ready) = 0, 'reset clears ready';
  assert (select count(*) from players where team_captain_id is not null or pick_number is not null) = 0, 'reset clears picks';
  perform pg_temp.expect_error($q$select admin_set_picks_per_team(5)$q$, 'This event uses four picks per captain');
  perform pg_temp.expect_error($q$select admin_set_picks_per_team(3)$q$, 'This event uses four picks per captain');
  perform admin_force_start();
  assert (select phase from draft) = 'drafting', 'force start';
  perform admin_reset(true);
  assert (select count(*) from captains where claimed) = 0, 'full reset clears claims';
  assert (select count(*) from captain_tokens) = 0, 'full reset clears tokens';
  perform admin_set_picks_per_team(4);

  st := get_state();
  assert json_array_length(st -> 'captains') = 8 and json_array_length(st -> 'players') = 35, 'get_state';
  assert (st -> 'players' -> 0 ->> 'display_name') = 'ruk', 'players sorted by rank';
end $$;

-- Public role: can read the board, can't read tokens or call functions.
set role anon;
select count(*) as anon_can_read_players from players;
do $$ begin
  begin perform 1 from captain_tokens; raise exception 'anon read captain_tokens'; exception when insufficient_privilege then null; end;
  begin perform admin_reset(true); raise exception 'anon called admin_reset'; exception when insufficient_privilege then null; end;
  begin perform get_state(); raise exception 'anon called get_state'; exception when insufficient_privilege then null; end;
  begin update players set team_captain_id = 1; raise exception 'anon updated players'; exception when insufficient_privilege then null; end;
end $$;
reset role;

select 'ALL DRAFT SQL TESTS PASSED' as result;
