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
 * Autocomplete dismissal always works on single Escape (handled by the current editor).
 * The extension decorates an editor installed earlier instead of replacing it.
 *
 * The debounce timeout defaults to 1500ms and can be configured via
 * the PI_DOUBLE_ESC_MS environment variable.
 */

import { CustomEditor, type ExtensionAPI, type Theme } from "@earendil-works/pi-coding-agent";
import {
  matchesKey,
  truncateToWidth,
  visibleWidth,
  type EditorComponent,
  type TUI,
} from "@earendil-works/pi-tui";
import {
  createInitialState,
  getDefaultDebounceMs,
  handleEscape,
  handleOtherKey,
  handleTimeout,
  type DoubleEscapeState,
} from "./src/index.js";

/** Add double-Escape behavior without replacing the current editor instance. */
function decorateDoubleEscapeEditor(
  editor: EditorComponent,
  tui: TUI,
  appTheme: Theme,
  isIdle: () => boolean,
): EditorComponent {
  let escapeState: DoubleEscapeState = createInitialState();
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const clearDebounce = (): void => {
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
  };

  const handleInput = editor.handleInput.bind(editor);
  editor.handleInput = (data: string): void => {
    if (!matchesKey(data, "escape")) {
      if (escapeState.hintActive) {
        escapeState = handleOtherKey(escapeState).state;
        clearDebounce();
        tui.requestRender();
      }
      handleInput(data);
      return;
    }

    const result = handleEscape(escapeState, isIdle());
    escapeState = result.state;

    if (result.action === "show_hint") {
      clearDebounce();
      debounceTimer = setTimeout(() => {
        escapeState = handleTimeout(escapeState).state;
        tui.requestRender();
      }, getDefaultDebounceMs());
      tui.requestRender();
      return;
    }

    clearDebounce();
    handleInput(data);
  };

  const render = editor.render.bind(editor);
  editor.render = (width: number): string[] => {
    const lines = render(width);
    if (!escapeState.hintActive || lines.length === 0) return lines;

    const label = " esc again to abort ";
    const styledLabel = appTheme.fg("dim", label);
    const last = lines.length - 1;
    const line = lines[last]!;
    const lineWidth = visibleWidth(line);
    const gap = 2;
    if (lineWidth >= label.length + gap) {
      lines[last] =
        truncateToWidth(line, lineWidth - label.length - gap, "") +
        styledLabel +
        truncateToWidth(line, gap, "");
    }
    return lines;
  };

  return editor;
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    const previousEditorFactory = ctx.ui.getEditorComponent();
    ctx.ui.setEditorComponent((tui, editorTheme, keybindings) => {
      const editor =
        previousEditorFactory?.(tui, editorTheme, keybindings) ??
        new CustomEditor(tui, editorTheme, keybindings);
      return decorateDoubleEscapeEditor(editor, tui, ctx.ui.theme, () => ctx.isIdle());
    });
  });
}
