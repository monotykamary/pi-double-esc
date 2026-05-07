/**
 * Unit tests for double-escape debounce logic.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  handleEscape,
  handleOtherKey,
  handleTimeout,
  createInitialState,
  getDefaultDebounceMs,
  type DoubleEscapeState,
} from "../../src/double-esc-logic.js";

describe("createInitialState", () => {
  it("returns hintActive=false and escapeCount=0", () => {
    const state = createInitialState();
    expect(state.hintActive).toBe(false);
    expect(state.escapeCount).toBe(0);
  });
});

describe("handleEscape", () => {
  it("returns nothing when idle and no hint is active", () => {
    const state = createInitialState();
    const result = handleEscape(state, true);
    expect(result.action).toBe("nothing");
    expect(result.state).toBe(state);
  });

  it("returns show_hint on first escape while streaming", () => {
    const state = createInitialState();
    const result = handleEscape(state, false);
    expect(result.action).toBe("show_hint");
    expect(result.state.hintActive).toBe(true);
    expect(result.state.escapeCount).toBe(1);
  });

  it("returns abort on second escape while streaming", () => {
    const state: DoubleEscapeState = { hintActive: true, escapeCount: 1 };
    const result = handleEscape(state, false);
    expect(result.action).toBe("abort");
    expect(result.state.hintActive).toBe(false);
    expect(result.state.escapeCount).toBe(0);
  });

  it("returns abort on second escape even when idle if hint is active", () => {
    // Edge case: streaming stopped between first and second press,
    // but hint is still showing. User should still be able to confirm.
    const state: DoubleEscapeState = { hintActive: true, escapeCount: 1 };
    const result = handleEscape(state, true);
    expect(result.action).toBe("abort");
    expect(result.state.hintActive).toBe(false);
    expect(result.state.escapeCount).toBe(0);
  });

  it("returns show_hint on first escape when idle but hint is already active (shouldn't happen, but handles it)", () => {
    // This shouldn't occur in practice (hintActive implies escapeCount >= 1)
    // but verify it handles the edge case gracefully
    const state: DoubleEscapeState = { hintActive: true, escapeCount: 0 };
    const result = handleEscape(state, true);
    // escapeCount goes to 1, which triggers show_hint
    expect(result.action).toBe("show_hint");
    expect(result.state.escapeCount).toBe(1);
  });

  it("handles third+ escape as abort", () => {
    const state: DoubleEscapeState = { hintActive: true, escapeCount: 2 };
    const result = handleEscape(state, false);
    expect(result.action).toBe("abort");
    expect(result.state.escapeCount).toBe(0);
  });
});

describe("handleOtherKey", () => {
  it("returns nothing when hint is not active", () => {
    const state = createInitialState();
    const result = handleOtherKey(state);
    expect(result.action).toBe("nothing");
    expect(result.state).toBe(state);
  });

  it("resets state when hint is active", () => {
    const state: DoubleEscapeState = { hintActive: true, escapeCount: 1 };
    const result = handleOtherKey(state);
    expect(result.action).toBe("nothing");
    expect(result.state.hintActive).toBe(false);
    expect(result.state.escapeCount).toBe(0);
  });
});

describe("handleTimeout", () => {
  it("returns nothing when hint is not active", () => {
    const state = createInitialState();
    const result = handleTimeout(state);
    expect(result.action).toBe("nothing");
    expect(result.state).toBe(state);
  });

  it("resets state when hint is active", () => {
    const state: DoubleEscapeState = { hintActive: true, escapeCount: 1 };
    const result = handleTimeout(state);
    expect(result.action).toBe("nothing");
    expect(result.state.hintActive).toBe(false);
    expect(result.state.escapeCount).toBe(0);
  });
});

describe("getDefaultDebounceMs", () => {
  it("returns 1500 by default", () => {
    const original = process.env.PI_DOUBLE_ESC_MS;
    delete process.env.PI_DOUBLE_ESC_MS;
    expect(getDefaultDebounceMs()).toBe(1500);
    if (original !== undefined) process.env.PI_DOUBLE_ESC_MS = original;
  });

  it("reads from PI_DOUBLE_ESC_MS env var", () => {
    const original = process.env.PI_DOUBLE_ESC_MS;
    process.env.PI_DOUBLE_ESC_MS = "2000";
    expect(getDefaultDebounceMs()).toBe(2000);
    if (original !== undefined) process.env.PI_DOUBLE_ESC_MS = original;
    else delete process.env.PI_DOUBLE_ESC_MS;
  });

  it("ignores invalid PI_DOUBLE_ESC_MS values", () => {
    const original = process.env.PI_DOUBLE_ESC_MS;
    process.env.PI_DOUBLE_ESC_MS = "not-a-number";
    expect(getDefaultDebounceMs()).toBe(1500);
    if (original !== undefined) process.env.PI_DOUBLE_ESC_MS = original;
    else delete process.env.PI_DOUBLE_ESC_MS;
  });

  it("ignores zero PI_DOUBLE_ESC_MS values", () => {
    const original = process.env.PI_DOUBLE_ESC_MS;
    process.env.PI_DOUBLE_ESC_MS = "0";
    expect(getDefaultDebounceMs()).toBe(1500);
    if (original !== undefined) process.env.PI_DOUBLE_ESC_MS = original;
    else delete process.env.PI_DOUBLE_ESC_MS;
  });

  it("ignores negative PI_DOUBLE_ESC_MS values", () => {
    const original = process.env.PI_DOUBLE_ESC_MS;
    process.env.PI_DOUBLE_ESC_MS = "-500";
    expect(getDefaultDebounceMs()).toBe(1500);
    if (original !== undefined) process.env.PI_DOUBLE_ESC_MS = original;
    else delete process.env.PI_DOUBLE_ESC_MS;
  });
});

describe("full debounce lifecycle", () => {
  it("streaming: press → hint → press → abort", () => {
    let state = createInitialState();

    // First escape while streaming
    const r1 = handleEscape(state, false);
    expect(r1.action).toBe("show_hint");
    state = r1.state;
    expect(state.hintActive).toBe(true);

    // Second escape confirms abort
    const r2 = handleEscape(state, false);
    expect(r2.action).toBe("abort");
    state = r2.state;
    expect(state.hintActive).toBe(false);
  });

  it("streaming: press → timeout → press → normal", () => {
    let state = createInitialState();

    // First escape while streaming
    const r1 = handleEscape(state, false);
    state = r1.state;

    // Timeout expires
    const rt = handleTimeout(state);
    state = rt.state;
    expect(state.hintActive).toBe(false);

    // Next escape while streaming starts fresh
    const r2 = handleEscape(state, false);
    expect(r2.action).toBe("show_hint");
  });

  it("streaming: press → other key → resets", () => {
    let state = createInitialState();

    // First escape while streaming
    const r1 = handleEscape(state, false);
    state = r1.state;
    expect(state.hintActive).toBe(true);

    // Press another key (typing in editor)
    const r2 = handleOtherKey(state);
    state = r2.state;
    expect(state.hintActive).toBe(false);
    expect(state.escapeCount).toBe(0);

    // Next escape while streaming starts fresh
    const r3 = handleEscape(state, false);
    expect(r3.action).toBe("show_hint");
  });

  it("idle: press → nothing (pass through)", () => {
    const state = createInitialState();
    const result = handleEscape(state, true);
    expect(result.action).toBe("nothing");
  });

  it("streaming stops between presses: still allows abort via hint", () => {
    // First press while streaming
    let state = createInitialState();
    const r1 = handleEscape(state, false);
    state = r1.state;

    // Streaming ends (isIdle=true), but hint is still active
    // Second press should still abort
    const r2 = handleEscape(state, true);
    expect(r2.action).toBe("abort");
  });
});
