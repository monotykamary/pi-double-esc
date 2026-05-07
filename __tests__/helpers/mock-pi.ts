/**
 * Test helpers for pi-double-esc.
 *
 * Provides a mock ExtensionAPI and factories for building test contexts.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const noop = () => {};

export interface MockPi extends ExtensionAPI {
  _eventHandlers: Map<string, Array<(...args: any[]) => void>>;
  _registeredTools: string[];
  _registeredCommands: Array<{ name: string; config: any }>;
}

export function createMockPi(): MockPi {
  const eventHandlers = new Map<string, Array<(...args: any[]) => void>>();

  const mock: MockPi = {
    _eventHandlers: eventHandlers,
    _registeredTools: [],
    _registeredCommands: [],

    on(event: string, handler: any) {
      if (!eventHandlers.has(event)) eventHandlers.set(event, []);
      eventHandlers.get(event)!.push(handler);
    },
    registerTool(tool: any): void {
      mock._registeredTools.push(tool.name);
    },
    registerCommand(name: string, config: any) {
      mock._registeredCommands.push({ name, config });
    },
    registerShortcut: noop as any,
    registerFlag: noop as any,
    getFlag: noop as any,
    registerMessageRenderer: noop as any,
    sendMessage: noop as any,
    sendUserMessage: noop as any,
    appendEntry: noop as any,
    setSessionName: noop as any,
    getSessionName: noop as any,
    setLabel: noop as any,
    exec: noop as any,
    setModel: noop as any,
    getThinkingLevel: noop as any,
    setThinkingLevel: noop as any,
    registerProvider: noop as any,
    unregisterProvider: noop as any,
    getAllTools: noop as any,
    getActiveTools: noop as any,
    setActiveTools: noop as any,
    getCommands: noop as any,
    events: {} as any,
  } as MockPi;

  return mock;
}

export function makeCtx(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    cwd: "/fake/project",
    hasUI: true,
    isIdle: () => false,
    ui: {
      notify: noop,
      setStatus: noop,
      setEditorComponent: noop,
      theme: { fg: (_k: string, v: any) => v },
    },
    ...overrides,
  };
}

/** Get first handler registered for an event, or undefined */
export function getHandler(
  pi: MockPi,
  event: string,
): ((...args: any[]) => void) | undefined {
  return pi._eventHandlers.get(event)?.[0];
}
