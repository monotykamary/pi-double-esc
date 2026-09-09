/**
 * Integration tests for the extension entry point.
 */

import { describe, it, expect, vi } from "vitest";
import { createMockPi, getHandler, makeCtx } from "../helpers/mock-pi.js";

async function loadExtension(): Promise<(pi: any) => void> {
  vi.resetModules();
  const mod = await import("../../double-esc.js");
  return mod.default;
}

describe("extension registration", () => {
  it("registers a session_start handler", async () => {
    const factory = await loadExtension();
    const pi = createMockPi();
    factory(pi as any);

    const handler = getHandler(pi, "session_start");
    expect(handler).toBeDefined();
  });

  it("calls setEditorComponent on session_start", async () => {
    const factory = await loadExtension();
    const pi = createMockPi();
    const setEditorComponent = vi.fn();
    const ctx = makeCtx({
      ui: {
        getEditorComponent: vi.fn(() => undefined),
        setEditorComponent,
      },
    });

    factory(pi as any);

    const handler = getHandler(pi, "session_start");
    expect(handler).toBeDefined();
    await handler!({}, ctx);

    expect(setEditorComponent).toHaveBeenCalledOnce();
    expect(setEditorComponent).toHaveBeenCalledWith(expect.any(Function));
  });

  it("preserves an editor installed by another extension", async () => {
    const factory = await loadExtension();
    const pi = createMockPi();
    const handleInput = vi.fn();
    const render = vi.fn(() => ["─".repeat(80)]);
    const existingEditor = {
      getText: vi.fn(() => "existing input"),
      handleInput,
      invalidate: vi.fn(),
      render,
      setText: vi.fn(),
    };
    const previousEditorFactory = vi.fn(() => existingEditor);
    let installedEditorFactory: ((...args: any[]) => unknown) | undefined;
    const setEditorComponent = vi.fn((editorFactory) => {
      installedEditorFactory = editorFactory;
    });
    const ctx = makeCtx({
      ui: {
        getEditorComponent: vi.fn(() => previousEditorFactory),
        setEditorComponent,
        theme: { fg: (_key: string, value: string) => value },
      },
    });

    factory(pi as any);
    await getHandler(pi, "session_start")!({}, ctx);

    expect(installedEditorFactory).toBeDefined();
    const installedEditor = installedEditorFactory!(
      { requestRender: vi.fn() },
      { borderColor: (value: string) => value },
      {},
    );

    expect(previousEditorFactory).toHaveBeenCalledOnce();
    expect(installedEditor).toBe(existingEditor);

    existingEditor.handleInput("\x1b");
    expect(handleInput).not.toHaveBeenCalled();
    expect(existingEditor.render(80)[0]).toContain("esc again to abort");
    expect(render).toHaveBeenCalledOnce();

    existingEditor.handleInput("\x1b");
    expect(handleInput).toHaveBeenCalledOnce();
    expect(handleInput).toHaveBeenCalledWith("\x1b");
  });
});
