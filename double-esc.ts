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

import {
  CustomEditor,
  type ExtensionAPI,
  type ExtensionContext,
  type Theme,
} from "@earendil-works/pi-coding-agent";
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
  onCleanup: (cleanup: () => void) => void,
): EditorComponent {
  let escapeState: DoubleEscapeState = createInitialState();
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const clearDebounce = (): void => {
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
  };

  let active = true;
  const originalHandleInput = editor.handleInput;
  const originalRender = editor.render;
  const handleInput = originalHandleInput.bind(editor);
  const wrappedInput = (data: string): void => {
    const autocomplete = editor as EditorComponent & { isShowingAutocomplete?: () => boolean };
    if (!active || autocomplete.isShowingAutocomplete?.()) {
      clearDebounce();
      escapeState = createInitialState();
      handleInput(data);
      return;
    }
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
    const lines = [...render(width)];
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

  editor.handleInput = wrappedInput;
  const wrappedRender = editor.render;
  onCleanup(() => {
    active = false;
    clearDebounce();
    escapeState = createInitialState();
    if (editor.handleInput === wrappedInput) editor.handleInput = originalHandleInput;
    if (editor.render === wrappedRender) editor.render = originalRender;
  });
  return editor;
}

// Marks the factory this extension installs. Repeated session_start events
// (reload, new session, resume) must reuse it instead of stacking a second
// decorator: the outer copy would swallow the first Escape and the inner one
// would then show the hint again instead of aborting.
const DECORATED_FACTORY = Symbol("pi-double-esc.decoratedFactory");

type EditorFactory = NonNullable<ReturnType<ExtensionContext["ui"]["getEditorComponent"]>>;
// Shared with cooperating editor decorators: inactive factories are skipped
// when an outer owner later unwinds, regardless of shutdown order.
const EDITOR_FACTORY_PATCH = Symbol.for("pi.editor-factory.patch.v1");
type DecoratedEditorFactory = EditorFactory & {
  [DECORATED_FACTORY]?: true;
  [EDITOR_FACTORY_PATCH]?: { active: boolean; original?: EditorFactory };
};
function unwrapEditorFactory(factory: EditorFactory | undefined): EditorFactory | undefined {
  while (factory) {
    const state = (factory as DecoratedEditorFactory)[EDITOR_FACTORY_PATCH];
    if (!state || state.active) return factory;
    factory = state.original;
  }
  return undefined;
}

function hasDoubleEscape(factory: EditorFactory | undefined): boolean {
  while (factory) {
    const wrapped = factory as DecoratedEditorFactory;
    const state = wrapped[EDITOR_FACTORY_PATCH];
    if (state?.active !== false && wrapped[DECORATED_FACTORY]) return true;
    factory = state?.original;
  }
  return false;
}

export default function (pi: ExtensionAPI) {
  const cleanups = new Set<() => void>();
  let installed: DecoratedEditorFactory | undefined;
  let previous: EditorFactory | undefined;
  const factoryStates: { active: boolean; original?: EditorFactory }[] = [];
  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;
    const previousEditorFactory = unwrapEditorFactory(ctx.ui.getEditorComponent()) as DecoratedEditorFactory | undefined;
    if (hasDoubleEscape(previousEditorFactory)) return;

    const state = { active: true, original: previousEditorFactory };
    const editorFactory: DecoratedEditorFactory = (tui, editorTheme, keybindings) => {
      const editor =
        unwrapEditorFactory(previousEditorFactory)?.(tui, editorTheme, keybindings) ??
        new CustomEditor(tui, editorTheme, keybindings);
      if (!state.active) return editor;
      return decorateDoubleEscapeEditor(editor, tui, ctx.ui.theme, () => ctx.isIdle(), (cleanup) => cleanups.add(cleanup));
    };
    editorFactory[DECORATED_FACTORY] = true;
    editorFactory[EDITOR_FACTORY_PATCH] = state;
    factoryStates.push(state);

    previous = previousEditorFactory;
    installed = editorFactory;
    ctx.ui.setEditorComponent(editorFactory);
  });
  pi.on("session_shutdown", (_event, ctx) => {
    for (const cleanup of cleanups) cleanup();
    cleanups.clear();
    for (const state of factoryStates) state.active = false;
    factoryStates.length = 0;
    if (installed && ctx.ui.getEditorComponent() === installed) ctx.ui.setEditorComponent(unwrapEditorFactory(previous));
    installed = undefined;
    previous = undefined;
  });
}
