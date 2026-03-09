import * as vscode from 'vscode';
import { GoogleGenAI } from '@google/genai';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
  console.log('Cognitive Resonance extension is now active!');

  let setApiKeyCommand = vscode.commands.registerCommand('cognitive-resonance.setApiKey', async () => {
    const defaultVal = await context.secrets.get('gemini-api-key');
    const apiKey = await vscode.window.showInputBox({
      prompt: 'Enter your Gemini API Key',
      ignoreFocusOut: true,
      password: true,
      value: defaultVal || ''
    });

    if (apiKey) {
      await context.secrets.store('gemini-api-key', apiKey);
      vscode.window.showInformationMessage('Gemini API Key saved securely.');
    }
  });

  let startSessionCommand = vscode.commands.registerCommand('cognitive-resonance.start', async () => {
    const apiKey = await context.secrets.get('gemini-api-key');
    if (!apiKey) {
      vscode.window.showErrorMessage('Gemini API Key not set. Please run "Cognitive Resonance: Set Gemini API Key" first.');
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'cognitiveResonance',
      'Cognitive Resonance',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'webview-ui', 'dist'))]
      }
    );

    setupChatPanel(panel, context, apiKey);
  });

  let viewHistoryCommand = vscode.commands.registerCommand('cognitive-resonance.viewHistory', async () => {
    const fileUris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      openLabel: 'Open History',
      filters: {
        'JSON': ['json']
      }
    });

    if (!fileUris || fileUris.length === 0) {
      return;
    }

    const fileUri = fileUris[0];
    const filename = path.basename(fileUri.fsPath);

    try {
      const fileContent = await fs.promises.readFile(fileUri.fsPath, 'utf8');
      const data = JSON.parse(fileContent);

      if (!data || !Array.isArray(data.messages)) {
        vscode.window.showErrorMessage('Invalid history file format. Expected an array of messages.');
        return;
      }

      const panel = vscode.window.createWebviewPanel(
        'cognitiveResonanceHistory',
        `Resonance History: ${filename}`,
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'webview-ui', 'dist'))]
        }
      );

      panel.webview.html = getWebviewContent(panel.webview, context.extensionPath);

      // We need to wait for the webview to load before posting the message.
      // Since we don't have a reliable 'ready' event from the webview yet, 
      // a short timeout or waiting for a 'ready' message works. 
      // For now, post immediately and also set a slight delay to ensure it's picked up.
      setTimeout(() => {
        panel.webview.postMessage({ type: 'load_history', data, filename });
      }, 500);

    } catch (error: any) {
      console.error("Error reading history file:", error);
      vscode.window.showErrorMessage('Failed to read history file: ' + error.message);
    }
  });

  let loadSessionCommand = vscode.commands.registerCommand('cognitive-resonance.loadSession', async () => {
    const apiKey = await context.secrets.get('gemini-api-key');
    if (!apiKey) {
      vscode.window.showErrorMessage('Gemini API Key not set. Please run "Cognitive Resonance: Set Gemini API Key" first.');
      return;
    }

    const fileUris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      openLabel: 'Resume Session',
      filters: {
        'JSON': ['json']
      }
    });

    if (!fileUris || fileUris.length === 0) {
      return;
    }

    const fileUri = fileUris[0];
    const filename = path.basename(fileUri.fsPath);

    try {
      const fileContent = await fs.promises.readFile(fileUri.fsPath, 'utf8');
      const data = JSON.parse(fileContent);

      if (!data || !Array.isArray(data.messages)) {
        vscode.window.showErrorMessage('Invalid history file format. Expected an array of messages.');
        return;
      }

      const panel = vscode.window.createWebviewPanel(
        'cognitiveResonance',
        `Cognitive Resonance: ${filename}`,
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'webview-ui', 'dist'))]
        }
      );

      setupChatPanel(panel, context, apiKey);

      // Give webview a moment to initialize before posting the resume state
      setTimeout(() => {
        panel.webview.postMessage({ type: 'resume_history', data, filename });
      }, 500);

    } catch (error: any) {
      console.error("Error reading history file:", error);
      vscode.window.showErrorMessage('Failed to read history file: ' + error.message);
    }
  });

  context.subscriptions.push(setApiKeyCommand, startSessionCommand, loadSessionCommand, viewHistoryCommand);
}

function setupChatPanel(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, apiKey: string) {
  panel.webview.html = getWebviewContent(panel.webview, context.extensionPath);

  const ai = new GoogleGenAI({ apiKey });

  // Fetch available models in the background
  (async () => {
    try {
      const modelsResponse = await ai.models.list();
      const modelList = [];
      for await (const m of modelsResponse) {
         if (!m.name) continue;
         const name = m.name.toLowerCase();
         
         // Only include primary Gemini generative models
         if (!name.includes('gemini-')) continue;
         
         // Exclude legacy single-turn vision models
         if (name.includes('-vision')) continue;
         
         // Exclude specialized and embedding models
         if (name.includes('embedding') || name.includes('aqa') || name.includes('audio') || name.includes('learn')) continue;
         if (name.includes('bison') || name.includes('gecko')) continue;
         
         // Exclude nano models as they generally struggle with strict, large JSON schema enforcement required for the semantic graph
         if (name.includes('nano')) continue;

         modelList.push({ name: m.name, displayName: m.displayName, description: m.description });
      }
      panel.webview.postMessage({ type: 'models_loaded', models: modelList });
    } catch (err) {
      console.error("Failed to fetch Google Gen AI models", err);
    }
  })();

  // Handle messages from the webview
  panel.webview.onDidReceiveMessage(
    async message => {
      switch (message.type) {
        case 'prompt':
          try {
            const response = await ai.models.generateContent({
              model: message.model || "gemini-3.1-pro-preview",
              contents: message.history.map((m: any) => ({
                role: m.role,
                parts: [{ text: m.content }]
              })),
              config: {
                systemInstruction: "You are an AI assistant. Along with your reply, you must analyze your own internal state. Calculate your 'dissonance score' (0-100) representing your uncertainty, conflicting information, or cognitive load. Also, extract a semantic graph of the concepts you are currently processing.",
                responseMimeType: "application/json",
                responseSchema: message.responseSchema
              }
            });
            
            const jsonStr = response.text;
            if (jsonStr) {
              const data = JSON.parse(jsonStr);
              panel.webview.postMessage({ type: 'response', data });
            }
          } catch (error: any) {
            console.error("Error generating response:", error);
            panel.webview.postMessage({ type: 'error', error: error.message });
          }
          return;
        case 'save_history':
          try {
            const uri = await vscode.window.showSaveDialog({
              filters: { 'JSON': ['json'] },
              defaultUri: vscode.Uri.file(`cognitive-resonance-history-${new Date().toISOString().split('T')[0]}.json`),
              saveLabel: 'Save Session History'
            });
            if (uri) {
              await fs.promises.writeFile(uri.fsPath, JSON.stringify(message.data, null, 2), 'utf8');
              vscode.window.showInformationMessage('Session history saved successfully.');
            }
          } catch (err: any) {
             console.error("Failed to save session history:", err);
             vscode.window.showErrorMessage('Failed to save session history: ' + err.message);
          }
          return;
      }
    },
    undefined,
    context.subscriptions
  );
}

function getWebviewContent(webview: vscode.Webview, extensionPath: string): string {
  const distPath = path.join(extensionPath, 'webview-ui', 'dist');
  
  // Note: we'll configure vite to output index.js and index.css without hashes
  const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(distPath, 'assets', 'index.js')));
  const styleUri = webview.asWebviewUri(vscode.Uri.file(path.join(distPath, 'assets', 'index.css')));

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Cognitive Resonance</title>
        <link href="${styleUri}" rel="stylesheet">
      </head>
      <body>
        <div id="root"></div>
        <script>
          const vscode = acquireVsCodeApi();
          window.vscode = vscode;
        </script>
        <script type="module" src="${scriptUri}"></script>
      </body>
    </html>
  `;
}

export function deactivate() {}
