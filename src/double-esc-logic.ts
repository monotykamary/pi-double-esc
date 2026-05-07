/**
 * Double-escape debounce logic — pure functions and state class for testing.
 *
 * The editor extension in double-esc.ts uses these building blocks.
 * All state is encapsulated in DoubleEscapeState; the editor merely
 * calls press() and clearOnOtherKey() and reads the resulting state.
 */

export interface DoubleEscapeState {
  /** First escape has been pressed, waiting for confirmation */
  hintActive: boolean;
  /** Number of escapes in the current debounce window */
  escapeCount: number;
}

export interface DoubleEscapeResult {
  /** Updated state after the action */
  state: DoubleEscapeState;
  /** What the caller should do */
  action: "show_hint" | "abort" | "nothing";
}

const DEFAULT_DEBOUNCE_MS = 1500;

export function getDefaultDebounceMs(): number {
  const env = process.env.PI_DOUBLE_ESC_MS;
  if (env) {
    const parsed = parseInt(env, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_DEBOUNCE_MS;
}

/**
 * Handle an escape key press.
 *
 * @param currentState  Current debounce state
 * @param isIdle        Whether the agent is idle (not streaming)
 * @returns             Result with updated state and action
 */
export function handleEscape(
  currentState: DoubleEscapeState,
  isIdle: boolean,
): DoubleEscapeResult {
  // When idle and no hint is showing, pass through immediately
  if (isIdle && !currentState.hintActive) {
    return { state: currentState, action: "nothing" };
  }

  const newCount = currentState.escapeCount + 1;

  if (newCount === 1) {
    // First press: show hint, start debounce
    return {
      state: { hintActive: true, escapeCount: 1 },
      action: "show_hint",
    };
  }

  // Second+ press within window: abort
  return {
    state: { hintActive: false, escapeCount: 0 },
    action: "abort",
  };
}

/**
 * Handle any non-escape key press while hint is showing.
 * Dismisses the hint and resets the debounce state.
 */
export function handleOtherKey(currentState: DoubleEscapeState): DoubleEscapeResult {
  if (!currentState.hintActive) {
    return { state: currentState, action: "nothing" };
  }

  return {
    state: { hintActive: false, escapeCount: 0 },
    action: "nothing",
  };
}

/**
 * Handle debounce timeout expiry.
 * Clears the hint and resets state.
 */
export function handleTimeout(currentState: DoubleEscapeState): DoubleEscapeResult {
  if (!currentState.hintActive) {
    return { state: currentState, action: "nothing" };
  }

  return {
    state: { hintActive: false, escapeCount: 0 },
    action: "nothing",
  };
}

/**
 * Create the initial state.
 */
export function createInitialState(): DoubleEscapeState {
  return { hintActive: false, escapeCount: 0 };
}
