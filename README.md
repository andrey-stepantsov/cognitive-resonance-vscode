# Cognitive Resonance

Welcome to **Cognitive Resonance**, an experimental VS Code extension ported from the Google AI Studio prototype.

This extension provides a rich, webview-based chat interface allowing you to interact with Google's Gemini generative models directly inside your editor. Wait—it's not just another chat wrapper! Cognitive Resonance provides real-time introspection into the model's "Internal State," visualizing both a Semantic Graph of concepts currently in context and a "Dissonance Meter."

## Features

- **Rich Webview Interface**: A dedicated panel for seamless conversation.
- **Internal State Visualization**: Watch the model map concepts via a Semantic Graph and measure its own "Cognitive Dissonance" based on your prompts.
- **Session Management**: Download chat histories and resume them later seamlessly using the "Resume Session" command.
- **Model Selection**: Dynamically fetches and filters the latest Gemini models available to your API key.

## Requirements

You must have a valid **Gemini API Key**. 

### How to get an API Key
Getting a key is completely free:
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Sign in with your Google account.
3. Click the **"Create API key"** button.
4. If you don't have an existing Google Cloud project, select "Create API key in new project".
5. Copy the generated key. **Do not share this key with anyone**, as it is tied to your quota and account.

## Usage

All features are accessed via the VS Code Command Palette (`Cmd+Shift+P` on Mac, `Ctrl+Shift+P` on Windows/Linux):

1. **`Cognitive Resonance: Set Gemini API Key`**: Run this first to securely save your API key.
2. **`Cognitive Resonance: Start Session`**: Opens the main chat webview to begin a new conversation.
3. **`Cognitive Resonance: Resume Session`**: Select a previously downloaded `.json` history file to continue a past conversation.
4. **`Cognitive Resonance: View History`**: Select a `.json` history file strictly for a read-only review of the semantic graph and dialogue.

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
*Created by Andrey Stepantsov*
