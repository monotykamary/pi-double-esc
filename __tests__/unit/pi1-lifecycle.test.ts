import { afterEach, describe, expect, it, vi } from "vitest";
import extension from "../../double-esc.js";
import { createMockPi, getHandler, makeCtx } from "../helpers/mock-pi.js";

afterEach(() => vi.useRealTimers());
describe("Pi 1.0 editor lifecycle", () => {
  it("keeps autocomplete single-Escape and restores editor methods/timers on shutdown", async () => {
    vi.useFakeTimers();
    const pi = createMockPi();
    let autocomplete = true;
    const lines = ["─".repeat(80)];
    const input = vi.fn();
    const render = () => lines;
    const editor = { handleInput: input, render, isShowingAutocomplete: () => autocomplete };
    const previous = () => editor;
    let factory: any = previous;
    const ctx = makeCtx({ ui: { getEditorComponent: () => factory, setEditorComponent: (f: any) => { factory = f; }, theme: { fg: (_: string, s: string) => s } } });
    extension(pi);
    await getHandler(pi, "session_start")!({}, ctx);
    factory({ requestRender() {} }, {}, {});
    editor.handleInput("\x1b");
    expect(input).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    autocomplete = false;
    editor.handleInput("\x1b");
    expect(editor.render()[0]).toContain("esc again");
    expect(lines[0]).not.toContain("esc again");
    expect(vi.getTimerCount()).toBe(1);
    await getHandler(pi, "session_shutdown")!({}, ctx);
    expect(vi.getTimerCount()).toBe(0);
    expect(factory).toBe(previous);
    expect(editor.handleInput).toBe(input);
    expect(editor.render).toBe(render);
    await getHandler(pi, "session_shutdown")!({}, ctx);
    await getHandler(pi, "session_start")!({}, ctx);
    factory({ requestRender() {} }, {}, {});
    editor.handleInput("\x1b");
    expect(input).toHaveBeenCalledOnce();
    await getHandler(pi, "session_shutdown")!({}, ctx);
  });
  it.each(["rpc", "json", "sdk"])("does not decorate %s", async (mode) => {
    const pi = createMockPi(); const setEditorComponent = vi.fn();
    extension(pi);
    await getHandler(pi, "session_start")!({}, makeCtx({ mode, ui: { setEditorComponent } }));
    expect(setEditorComponent).not.toHaveBeenCalled();
  });
});
