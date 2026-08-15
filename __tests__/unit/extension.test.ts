/**
 * Integration tests for the extension entry point.
 */

import { describe, it, expect, vi } from "vitest";
import { renderEscapeHintLine } from "../../double-esc.js";
import { visibleWidth } from "@earendil-works/pi-tui";
import { createMockPi, getHandler, makeCtx } from "../helpers/mock-pi.js";

async function loadExtension(): Promise<(pi: any) => void> {
  vi.resetModules();
  const mod = await import("../../double-esc.js");
  return mod.default;
}

describe("renderEscapeHintLine", () => {
  const line = "-".repeat(40);
  const label = " hint ";

  function hintOffset(position: "left" | "center" | "right"): number {
    const rendered = renderEscapeHintLine(line, label, position);
    return visibleWidth(rendered.slice(0, rendered.indexOf(label)));
  }

  it("places the hint on the left", () => {
    expect(hintOffset("left")).toBe(2);
  });

  it("centers the hint", () => {
    expect(hintOffset("center")).toBe(17);
  });

  it("keeps the default right placement", () => {
    expect(hintOffset("right")).toBe(32);
  });
});

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
    handler!({}, ctx);

    expect(setEditorComponent).toHaveBeenCalledOnce();
    expect(setEditorComponent).toHaveBeenCalledWith(expect.any(Function));
  });
});
