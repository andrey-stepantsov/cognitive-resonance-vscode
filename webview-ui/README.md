# Cognitive Resonance Webview UI

This directory contains the React frontend code for the Cognitive Resonance VSCode Extension.

It was originally ported from a Google AI Studio prototype. The frontend is built using Vite and React, and is configured to output an unhashed bundle so that the VSCode Extension Host (`src/extension.ts`) can predictably load it into a Webview Panel.

## Development

The webview UI is built automatically when compiling the extension using the `build:all` or `build:webview` scripts in the root `package.json`.

**Important Changes from Prototype:**
- No local `.env.local` is used. The Gemini API key is managed securely via the VSCode Secret Storage (`cognitive-resonance.setApiKey` command).
- The AI API calls are NOT made directly from the browser/React code. This is to avoid exposing the user's API key within the webview environment.
- Instead, the React code sends messages to the Extension Host (via `vscode.postMessage`), which proxies the request to the Google Gen AI SDK.
- The webview UI relies on the `window.vscode` object injected by the extension host. Running this standalone via `npm run dev` will lack the necessary extension context.
