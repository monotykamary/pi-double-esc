/**
 * Double Escape Debounce — prevents accidental Escape from aborting the LLM
 *
 * Usage: pi --extension ./double-esc.ts
 *
 * When the LLM is streaming:
 *   - First Escape press: shows "ESC AGAIN TO ABORT" hint in the editor border
 *   - Second Escape within the debounce window: actually aborts streaming
 *   - If the window expires, the hint clears and escape resets
 *
 * When not streaming:
 *   - Escape works normally (immediate) — no debounce applied
 *
 * Autocomplete dismissal always works on single Escape (handled by Editor parent).
 *
 * The debounce timeout defaults to 1500ms and can be configured via
 * the PI_DOUBLE_ESC_MS environment variable.
 */

import { CustomEditor, type ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { matchesKey, truncateToWidth, visibleWidth, type TUI } from "@mariozechner/pi-tui";
import {
  createInitialState,
  getDefaultDebounceMs,
  handleEscape,
  handleOtherKey,
  handleTimeout,
  type DoubleEscapeState,
} from "./src/index.js";

class DoubleEscapeEditor extends CustomEditor {
  private escState: DoubleEscapeState = createInitialState();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isIdle: () => boolean;

  constructor(
    tui: TUI,
    theme: any,
    keybindings: any,
    isIdle: () => boolean,
    options?: any,
  ) {
    super(tui, theme, keybindings, options);
    this.isIdle = isIdle;
  }

  private clearDebounce(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape")) {
      const result = handleEscape(this.escState, this.isIdle());

      this.escState = result.state;

      if (result.action === "show_hint") {
        this.clearDebounce();
        this.debounceTimer = setTimeout(() => {
          this.escState = handleTimeout(this.escState).state;
          this.tui.requestRender();
        }, getDefaultDebounceMs());
        this.tui.requestRender();
        return;
      }

      if (result.action === "abort") {
        this.clearDebounce();
        super.handleInput(data);
        return;
      }

      // "nothing" — idle state, pass through
      super.handleInput(data);
      return;
    }

    // Non-escape key while hint is showing: dismiss hint
    if (this.escState.hintActive) {
      this.escState = handleOtherKey(this.escState).state;
      this.clearDebounce();
      this.tui.requestRender();
    }

    super.handleInput(data);
  }

  render(width: number): string[] {
    const lines = super.render(width);
    if (lines.length === 0) return lines;

    if (this.escState.hintActive) {
      const label = " esc again to abort ";
      const first = 0;
      const offset = 2;
      if (visibleWidth(lines[first]!) >= label.length + offset) {
        lines[first] = truncateToWidth(lines[first]!, width - label.length - offset, "") + " ".repeat(offset) + label;
      }
    }

    return lines;
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setEditorComponent((tui, theme, kb) =>
      new DoubleEscapeEditor(tui, theme, kb, () => ctx.isIdle()),
    );
  });
}
