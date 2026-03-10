# Cognitive Resonance

Welcome to **Cognitive Resonance**, an experimental VS Code extension ported from the Google AI Studio prototype.

This extension provides a rich, webview-based chat interface allowing you to interact with Google's Gemini generative models directly inside your editor. Wait—it's not just another chat wrapper! Cognitive Resonance provides real-time introspection into the model's "Internal State," visualizing both a Semantic Graph of concepts currently in context and a "Dissonance Meter."

## Features

- **Rich Webview Interface**: A dedicated panel for seamless conversation.
- **Internal State Visualization**: Watch the model map concepts via a Semantic Graph and measure its own "Cognitive Dissonance" based on your prompts.
- **Session Management**: Download chat histories and resume them later seamlessly using the "Resume Session" command.
- **Model Selection**: Dynamically fetches and filters the latest Gemini models available to your API key.

## Requirements

You must have a valid **Gemini API Key**. Get one for free at [Google AI Studio](https://aistudio.google.com/app/apikey).

## Usage

1. **Set your API Key**: Run `Cognitive Resonance: Set Gemini API Key` from the Command Palette (`Cmd+Shift+P`).
2. **Start a Session**: Run `Cognitive Resonance: Start Session` to open the main chat webview.
3. **Resume a Session**: Download your history from an active chat, then use `Cognitive Resonance: Resume Session` to continue it later.

## Setting Up for Local Development

If you wish to clone and build this extension yourself:

```bash
git clone https://github.com/andrey-stepantsov/cognitive-resonance-vscode.git
cd cognitive-resonance-vscode
npm install
npm run build:all
```
Then, press `F5` in VS Code to launch the Extension Development Host.

## Extension Settings

This extension stores your API key securely in VS Code's native SecretStorage. It does not contribute any user-facing configuration settings.

---
*Created by [Your Name]*
