import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { render, waitFor, cleanup, act } from '@testing-library/react';

test('attendance identity resolves during repeated snapshots and revoked responses cannot restore it', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
  const globals = new Map<string, PropertyDescriptor | undefined>();
  for (const [name, value] of Object.entries({
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  const originalFetch = globalThis.fetch;
  const pending: ((value: Response) => void)[] = [];
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.action, 'me');
    return new Promise<Response>(resolve => pending.push(resolve));
  };
  localStorage.setItem('cmu-pitt-player-token', 'present-player-token');
  const player = {
    id: 1, display_name: 'moon', riot_id: 'moon#90849', peak_rank: 'Emerald 4',
    rank_score: 20, opgg_url: 'https://op.gg', team_captain_id: null, pick_number: null, present: true,
  };
  try {
    const { AttendancePanel } = await import('../src/components/attendance-panel');
    const props = { players: [player], onChanged: async () => {}, onError: (message: string) => { throw Error(message); } };
    const ui = render(React.createElement(AttendancePanel, props));
    await waitFor(() => assert.ok(pending.length));
    // Fresh state snapshots are normal while other attendees check in. They
    // must not invalidate a still-valid identity lookup for this same token.
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        ui.rerender(React.createElement(AttendancePanel, { ...props, players: [{ ...player }] }));
      });
    }
    await act(async () => { pending[0](Response.json({ playerId: 1 })); });
    await waitFor(() => assert.ok(ui.getByRole('button', { name: 'Withdraw attendance' })));
    assert.equal(localStorage.getItem('cmu-pitt-player-token'), 'present-player-token');

    await act(async () => {
      ui.rerender(React.createElement(AttendancePanel, { ...props, players: [{ ...player, present: false }] }));
    });
    await act(async () => { pending.at(-1)!(Response.json({ playerId: null })); });
    await waitFor(() => assert.equal(localStorage.getItem('cmu-pitt-player-token'), null));
    // Older successful reads that arrive after revocation cannot resurrect it.
    await act(async () => { for (const resolve of pending) resolve(Response.json({ playerId: 1 })); });
    assert.equal(ui.queryByRole('button', { name: 'Withdraw attendance' }), null);
    assert.equal(localStorage.getItem('cmu-pitt-player-token'), null);
    assert.equal((ui.getByLabelText('Your player name') as HTMLSelectElement).disabled, false);
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
    for (const [name, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
    dom.window.close();
  }
});
