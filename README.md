# pi-double-esc

A [pi](https://github.com/badlogic/pi-mono) extension that prevents accidental Escape key presses from aborting the LLM mid-conversation.

## What it does

When the LLM is streaming a response:

- **First Escape press**: Shows an `esc again to abort` hint on the editor border — does **not** abort
- **Second Escape** within the debounce window: Actually aborts the streaming response
- If the debounce window expires, the hint clears and escape resets

When the LLM is **not** streaming, Escape works normally (immediate) — no debounce applied. Autocomplete dismissal always works on a single Escape.

## Installation

### Option 1: Install via pi package (Recommended)

Install directly from GitHub as a pi package:

```bash
pi install git:github.com:monotykamary/pi-double-esc@main
```

Or add to your `settings.json`:

```json
{
  "packages": [
    "git:github.com:monotykamary/pi-double-esc@main"
  ]
}
```

### Option 2: Global Installation

Copy the extension to pi's global extensions directory:

```bash
cp double-esc.ts ~/.pi/agent/extensions/
```

### Option 3: Project-Local Installation

Copy to your project's `.pi/extensions/` directory:

```bash
mkdir -p .pi/extensions
cp double-esc.ts .pi/extensions/
```

### Option 4: Quick Test

```bash
pi -e ./double-esc.ts
```

## Configuration

Set the `PI_DOUBLE_ESC_MS` environment variable to change the debounce timeout (default: 1500ms):

```bash
PI_DOUBLE_ESC_MS=2000 pi
```

## How it works

The extension replaces pi's editor component with a `CustomEditor` subclass that intercepts Escape key presses:

1. On each `session_start`, `ctx.ui.setEditorComponent()` installs the custom editor
2. The editor uses `ctx.isIdle()` (which reflects `!session.isStreaming`) to detect streaming state
3. While streaming, the first Escape shows a visual hint and starts a debounce timer
4. A second Escape within the window calls `super.handleInput(data)` to perform the actual abort
5. Any other keypress or timeout expiry dismisses the hint

The debounce logic lives in `src/double-esc-logic.ts` as pure functions for testability.

## Development

```bash
npm install          # install dev dependencies
npm test            # run tests
npm run typecheck   # type check
npm run lint:dead   # check for unused exports
```

## License

MIT
