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
    const ctx = makeCtx({ ui: { setEditorComponent } });

    factory(pi as any);

    const handler = getHandler(pi, "session_start");
    expect(handler).toBeDefined();
    await handler!({}, ctx);

    expect(setEditorComponent).toHaveBeenCalledOnce();
    expect(setEditorComponent).toHaveBeenCalledWith(expect.any(Function));
  });
});
