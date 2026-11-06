import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React from "react";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import type { BracketMatchId, DraftState } from "../src/lib/types";

function state(): DraftState {
  return {
    mode: "local",
    draft: {
      id: 1,
      phase: "complete",
      pick_index: 32,
      picks_per_team: 4,
      started_at: null,
      updated_at: "2026-11-06T00:00:00Z",
      announcement: "",
      bracket: null,
      bracket_revision: 4,
    },
    captains: [1, 2, 4, 5, 6, 7, 8, 9].map((id, index) => ({
      id,
      slot: index + 1,
      display_name: `Captain ${id}`,
      riot_id: `captain${id}#123`,
      opgg_url: "https://op.gg",
      peak_rank: "Emerald 4",
      rank_score: 20,
      claimed: true,
      ready: true,
    })),
    players: [],
  };
}

function environment() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
  });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
    });
  }
  return () => {
    cleanup();
    for (const [key, value] of previous) {
      if (value) Object.defineProperty(globalThis, key, value);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  };
}

test("public bracket shows actual captain IDs in seeded slots and unresolved progression without edit controls", async () => {
  const restore = environment();
  try {
    const { TournamentBracket } = await import("../src/components/tournament-bracket");
    const ui = render(React.createElement(TournamentBracket, { state: state() }));
    const first = within(ui.getByRole("article", { name: "Quarterfinal 1" }));
    assert.ok(first.getByText("Captain 1"));
    assert.ok(first.getByText("Team 1"));
    assert.ok(first.getByText("Captain 9"));
    assert.ok(first.getByText("Team 8"));
    assert.ok(ui.getByText("Winner of Quarterfinal 1"));
    assert.ok(ui.getByText("Winner of Semifinal 2"));
    assert.equal(ui.queryAllByRole("button").length, 0);
    const complete = state();
    complete.draft.bracket = {
      seeds: [1, 9, 5, 6, 2, 8, 4, 7],
      winners: { qf1: 1, qf2: 5, qf3: 2, qf4: 4, sf1: 1, sf2: 2, final: 2 },
    };
    ui.rerender(React.createElement(TournamentBracket, { state: complete }));
    const champion = within(ui.getByRole("status", { name: "Tournament champion" }));
    assert.ok(champion.getByText("Captain 2"));
    assert.ok(champion.getByText("Team 2"));
  } finally {
    restore();
  }
});

test("admin result controls require both participants and use the current revision for winners and clears", async () => {
  const restore = environment();
  try {
    const { AdminBracket } = await import("../src/components/admin-bracket");
    const calls: [BracketMatchId, number | null, number][] = [];
    const props = {
      state: state(),
      busy: false,
      onSeeds: () => {},
      onResult: (match: BracketMatchId, winner: number | null, revision: number) => {
        calls.push([match, winner, revision]);
      },
    };
    const ui = render(React.createElement(AdminBracket, props));
    fireEvent.click(ui.getByRole("button", { name: "Advance Captain 1 from Quarterfinal 1" }));
    assert.deepEqual(calls, [["qf1", 1, 4]]);
    const next = state();
    next.draft.bracket_revision = 5;
    next.draft.bracket = { seeds: [1, 9, 5, 6, 2, 8, 4, 7], winners: { qf1: 1 } };
    ui.rerender(React.createElement(AdminBracket, { ...props, state: next }));
    const selected = ui.getByRole("button", { name: "Advance Captain 1 from Quarterfinal 1" });
    assert.equal(selected.getAttribute("aria-pressed"), "true");
    const semi = ui.getByRole("button", { name: "Advance Captain 1 from Semifinal 1" }) as HTMLButtonElement;
    assert.equal(semi.disabled, true);
    fireEvent.click(semi);
    assert.equal(calls.length, 1);
    fireEvent.click(ui.getByRole("button", { name: "Clear result for Quarterfinal 1" }));
    assert.deepEqual(calls[1], ["qf1", null, 5]);
    ui.rerender(React.createElement(AdminBracket, { ...props, state: next, busy: true }));
    for (const button of ui.getAllByRole("button")) {
      assert.equal((button as HTMLButtonElement).disabled, true);
    }
  } finally {
    restore();
  }
});

test("matchup editor rejects duplicate teams and submits its opening revision after a live update", async () => {
  const restore = environment();
  try {
    const { AdminBracket } = await import("../src/components/admin-bracket");
    const calls: [number[], number][] = [];
    const props = {
      state: state(),
      busy: false,
      onSeeds: (seeds: number[], revision: number) => calls.push([seeds, revision]),
      onResult: () => {},
    };
    const ui = render(React.createElement(AdminBracket, props));
    fireEvent.click(ui.getByRole("button", { name: "Edit matchups" }));
    assert.equal(ui.getAllByRole("combobox").length, 8);
    fireEvent.change(ui.getByLabelText("Quarterfinal 1, team 1"), { target: { value: "9" } });
    const save = ui.getByRole("button", { name: "Save matchups" }) as HTMLButtonElement;
    assert.equal(save.disabled, true);
    fireEvent.click(save);
    assert.equal(calls.length, 0);
    fireEvent.change(ui.getByLabelText("Quarterfinal 1, team 2"), { target: { value: "1" } });
    const updated = state();
    updated.draft.bracket_revision = 9;
    ui.rerender(React.createElement(AdminBracket, { ...props, state: updated }));
    assert.ok(ui.getByRole("status", { name: "Matchup changes" }));
    fireEvent.click(ui.getByRole("button", { name: "Save matchups" }));
    assert.deepEqual(calls, [[[9, 1, 5, 6, 2, 8, 4, 7], 4]]);
    fireEvent.click(ui.getByRole("button", { name: "Cancel" }));
    fireEvent.click(ui.getByRole("button", { name: "Edit matchups" }));
    assert.equal((ui.getByLabelText("Quarterfinal 1, team 1") as HTMLSelectElement).value, "1");
  } finally {
    restore();
  }
});

test("matchup editor closes when a requested save is reflected in live state", async () => {
  const restore = environment();
  try {
    const { AdminBracket } = await import("../src/components/admin-bracket");
    const props = { state: state(), busy: false, onSeeds: () => {}, onResult: () => {} };
    const ui = render(React.createElement(AdminBracket, props));
    fireEvent.click(ui.getByRole("button", { name: "Edit matchups" }));
    fireEvent.change(ui.getByLabelText("Quarterfinal 1, team 1"), { target: { value: "9" } });
    fireEvent.change(ui.getByLabelText("Quarterfinal 1, team 2"), { target: { value: "1" } });
    fireEvent.click(ui.getByRole("button", { name: "Save matchups" }));
    const unrelated = state();
    unrelated.draft.bracket_revision = 5;
    unrelated.draft.bracket = { seeds: [1, 9, 5, 6, 2, 8, 4, 7], winners: { qf1: 1 } };
    ui.rerender(React.createElement(AdminBracket, { ...props, state: unrelated }));
    assert.equal(ui.getAllByRole("combobox").length, 8);
    assert.equal((ui.getByLabelText("Quarterfinal 1, team 1") as HTMLSelectElement).value, "9");
    const saved = state();
    saved.draft.bracket_revision = 6;
    saved.draft.bracket = { seeds: [9, 1, 5, 6, 2, 8, 4, 7], winners: {} };
    ui.rerender(React.createElement(AdminBracket, { ...props, state: saved }));
    assert.equal(ui.queryAllByRole("combobox").length, 0);
    fireEvent.click(ui.getByRole("button", { name: "Edit matchups" }));
    assert.equal((ui.getByLabelText("Quarterfinal 1, team 1") as HTMLSelectElement).value, "9");
  } finally {
    restore();
  }
});

test("matchup editor prevents unchanged saves against both default and live matchups", async () => {
  const restore = environment();
  try {
    const { AdminBracket } = await import("../src/components/admin-bracket");
    const calls: [number[], number][] = [];
    const props = {
      state: state(),
      busy: false,
      onSeeds: (seeds: number[], revision: number) => calls.push([seeds, revision]),
      onResult: () => {},
    };
    const ui = render(React.createElement(AdminBracket, props));
    fireEvent.click(ui.getByRole("button", { name: "Edit matchups" }));
    const save = ui.getByRole("button", { name: "Save matchups" }) as HTMLButtonElement;
    assert.equal(save.disabled, true);
    fireEvent.click(save);
    assert.equal(calls.length, 0);
    fireEvent.change(ui.getByLabelText("Quarterfinal 1, team 1"), { target: { value: "9" } });
    fireEvent.change(ui.getByLabelText("Quarterfinal 1, team 2"), { target: { value: "1" } });
    assert.equal(save.disabled, false);
    const current = state();
    current.draft.bracket_revision = 5;
    current.draft.bracket = { seeds: [9, 1, 5, 6, 2, 8, 4, 7], winners: { qf1: 9 } };
    ui.rerender(React.createElement(AdminBracket, { ...props, state: current }));
    assert.equal(save.disabled, true);
    fireEvent.submit(save.closest("form")!);
    assert.equal(calls.length, 0);
  } finally {
    restore();
  }
});
