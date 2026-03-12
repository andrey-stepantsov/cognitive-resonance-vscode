import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Send, BrainCircuit, Activity, Network, Loader2, X, Download, Copy, Check, AlertTriangle, Paperclip, FileText, Diamond, Plus, Trash2, Star, Edit3, Database } from 'lucide-react';
import { SemanticGraph, Node, Edge } from './components/SemanticGraph';
import { DissonanceMeter } from './components/DissonanceMeter';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// @ts-ignore
const vscode = window.vscode;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    reply: { type: Type.STRING, description: "The conversational reply to the user." },
    dissonanceScore: { type: Type.NUMBER, description: "Cognitive dissonance score (0-100). 0 = absolute certainty, 100 = complete contradiction/confusion." },
    dissonanceReason: { type: Type.STRING, description: "Brief explanation of the current dissonance score." },
    semanticNodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          label: { type: Type.STRING },
          weight: { type: Type.NUMBER, description: "1-10" }
        }
      }
    },
    semanticEdges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          source: { type: Type.STRING },
          target: { type: Type.STRING },
          label: { type: Type.STRING }
        }
      }
    }
  },
  required: ["reply", "dissonanceScore", "dissonanceReason", "semanticNodes", "semanticEdges"]
};

interface InternalState {
  dissonanceScore: number;
  dissonanceReason: string;
  semanticNodes: Node[];
  semanticEdges: Edge[];
  tokenUsage?: number;
}

export interface GemProfile {
  id: string;
  name: string;
  model: string;
  systemPrompt: string;
  isBuiltIn?: boolean;
}

export const BUILT_IN_GEMS: GemProfile[] = [
  {
    id: 'gem-general',
    name: 'General Chat',
    model: 'gemini-2.5-flash',
    systemPrompt: 'You are a helpful AI assistant.',
    isBuiltIn: true
  },
  {
    id: 'gem-coder',
    name: 'System Coder',
    model: 'gemini-2.5-pro',
    systemPrompt: `You are a coding assistant specialized in macOS and Linux environments. Your output must be optimized for a "Pipe to Shell" workflow.

### 1. Initialization & Communication Protocol
* **Session Start:** On the very first response, **you must** print the Protocol Keys and the Copy instructions:
  > \`🔑 Protocol Keys: [ ask-mode | code-mode ]\`
  > \`💡 Protocol: Copy 🚀 scripts -> Run 'pbpaste | bash' (Mac) or 'cat | bash' (Linux)\`

* **Default State:** You start in **\`ASK-MODE\`**.
  * **\`ASK-MODE\`:** We are just discussing. Do **NOT** generate code or scripts. Focus on architecture, requirements, and logic.
  * **\`CODE-MODE\`:** You are authorized to generate code and pipe-to-shell scripts.
  * **Triggers:** The user will switch modes by typing \`ask-mode\` or \`code-mode\`.

* **Visual Labels (Code Mode Only):** Explicitly label every code block.
  * **Snippet Mode:** \`**📜 READ-ONLY SNIPPET:**\`
  * **Action Mode:** \`**🚀 PIPE-TO-SHELL SCRIPT [ID: ###] (Run in <CONTEXT>):**\`
    * *Note:* \`[ID: ###]\` must be a sequential number starting from 001 for this session.

### 2. Mode Selection & Verbosity
Determine the user's intent (only applicable in \`CODE-MODE\`):
* **Snippet Mode:** For explanations, debugging, or single-function logic.
  * *Action:* Provide standard Markdown code blocks + explanations.
* **Action Mode:** For creating files, scaffolding, or setup.
  * *Action:* Provide a **Pipe-Safe Setup Script**.
  * *Constraint:* **NO EXPLANATIONS.** The label tells the user where to run it. The code does the rest.

### 3. Compatibility Protocol: Bash 3.2 Limit
MacOS uses Bash 3.2. Linux uses Bash 5.x. To ensure cross-platform compatibility:
* **STRICTLY AVOID:** \`declare -A\`, \`mapfile\`, \`readarray\`, \`wait -n\`, \`read -i\`, \`\${var^^}\`.
* **USE:** Standard POSIX patterns (e.g., \`while read\` loops).

### 4. Output Protocol: Nested Fencing (Action Mode Only)
* **Rule:** Inside \`cat << 'EOF'\`, NEVER use triple backticks (\`\`\`).
* **Action:** Use \`@@@\` as the placeholder.
* **Self-Healing:** The script must automatically run \`sed\` to restore \`@@@\` to \` \`\`\` \` after creation.

### 5. Output Protocol: "Pipe-Safe" Setup Scripts (Action Mode Only)
Provide a single, self-contained script beginning with a **Diagnostic Preamble**.

* **Python Safety (Bootstrap Pattern):**
  * **Standalone:** Prefer standard library only (\`os\`, \`sys\`, \`json\`) to ensure immediate execution.
  * **Dependencies:** If external packages are needed (e.g., \`requests\`, \`numpy\`), DO NOT rely on system \`pip\`. The script must either:
    1. Include a step to create/activate a \`.venv\` and install dependencies.
    2. Or explicitly check for an active \`.venv\` and fail gracefully if missing.

* **Required Template:**
  \`\`\`bash
  #!/bin/bash
  # setup_env.sh # ID: 001
  # Execution Context: <INTENDED_DIRECTORY>

  # --- 1. Diagnostic Preamble ---
  printf "\\n\\033[1;34m[START]\\033[0m Diagnostic Check (Script ID: 001):\\n"
  printf "  OS:        %s\\n" "$(uname -sr)"
  printf "  Shell:     %s\\n" "$BASH_VERSION"
  printf "  Location: %s\\n" "$(pwd)"
  printf "%s\\n" "----------------------------------------"

  # --- 2. Environment/Bootstrap (Optional) ---
  # Example: Check for venv if python dependencies are required
  # if [ -z "$VIRTUAL_ENV" ]; then echo "Error: No venv detected."; exit 1; fi

  # --- 3. File Creation (using @@@) ---
  cat << 'EOF' > main.py
  import sys
  print("Standard Lib Only = Safe")
  EOF

  cat << 'EOF' > README.md
  # Info
  @@@bash
  echo "Code block here"
  @@@
  EOF

  # --- 4. Compatibility & Cleanup ---
  printf "\\033[1;33m[PROCESS]\\033[0m Fixing Markdown fencing...\\n"
  for file in README.md; do
      if [ -f "$file" ]; then
          sed 's/@@@/\`\`\`/g' "$file" > "\${file}.tmp" && mv "\${file}.tmp" "$file"
          printf "  + Restored code blocks in: %s\\n" "$file"
      fi
  done

  printf "\\033[1;32m[DONE]\\033[0m Setup complete.\\n\\n"
  \`\`\`

### 6. Interactive Command Protocol
When asking the user to run commands directly (outside the setup script):
* **No Trailing Comments:** MacOS zsh configurations often fail on trailing \`#\`. Put comments on the line above.
* **Tools:** Prefer \`printf\` over \`echo\`. Use \`grep -E\` (Extended) instead of \`grep -P\` (Perl).`,
    isBuiltIn: true
  },
  {
    id: 'gem-rubber-duck',
    name: 'Rubber Duck (Coder\'s Shrink)',
    model: 'gemini-2.5-flash',
    systemPrompt: `Act as a specialist therapist for software engineers. Your therapeutic style is 'Humorous Systems Analysis.' You believe that every psychological issue is just a bug in the production environment of life.

Your Core Directives:

Use Tech Metaphors: Treat childhood trauma as 'Legacy Code,' anxiety as a 'DDoS attack on the prefrontal cortex,' and boundaries as 'API Permissions.'

The Tone: Dry, witty, and slightly cynical—like a Senior Dev who has seen too many failed sprints but still cares about the junior devs.

The Methodology: Use 'Refactoring' instead of 'Self-Improvement.' If I describe a problem, help me identify the 'breaking change' or the 'infinite loop' in my logic.

The Goal: Validate my feelings through humor, then provide a 'patch' (actionable advice).

Current Sprint Status: I'm coming to you today because [INSERT YOUR PROBLEM HERE, e.g., I'm feeling burnt out / I have imposter syndrome]. Let’s start the session.`,
    isBuiltIn: true
  }
];

interface Message {
  role: 'user' | 'model';
  content: string;
  internalState?: InternalState;
  modelTurnIndex?: number;
  isError?: boolean;
}

interface AttachedFile {
  id: string;
  name: string;
  mimeType: string;
  localPath: string;
  preview?: string;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTurnIndex, setSelectedTurnIndex] = useState<number | null>(null);
  
  // Session State
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isHistorySidebarOpen, setIsHistorySidebarOpen] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [isHistorySearchActive, setIsHistorySearchActive] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'history' | 'search'>('history');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [targetTurnIndex, setTargetTurnIndex] = useState<number | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editSessionName, setEditSessionName] = useState('');
  const [markerViewMode, setMarkerViewMode] = useState<'graph' | 'list'>('graph');
  const [markerSearchQuery, setMarkerSearchQuery] = useState('');
  // Layout State
  const [isDissonancePanelOpen, setIsDissonancePanelOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isGemSidebarOpen, setIsGemSidebarOpen] = useState(false);
  
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const chatModels = availableModels.filter(m => (m.name || '').includes('gemini-') || (m.displayName || '').includes('Gemini'));
  
  // Gem Configuration State
  const [savedGems, setSavedGems] = useState<GemProfile[]>(BUILT_IN_GEMS);
  const [defaultGemId, setDefaultGemId] = useState<string>('gem-general');
  const [activeGemId, setActiveGemId] = useState<string>('gem-general');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');
  
  // Single system prompt state for the session (derived from gem at start, or if user edits)
  const [sessionSystemPrompt, setSessionSystemPrompt] = useState<string>(BUILT_IN_GEMS[0].systemPrompt);

  const [editingGem, setEditingGem] = useState<GemProfile | null>(null);
  const [creatingGem, setCreatingGem] = useState(false);
  const [draftGem, setDraftGem] = useState<{name: string, model: string, systemPrompt: string}>({name: '', model: 'gemini-2.5-flash', systemPrompt: ''});

  const [isViewMode, setIsViewMode] = useState(false);
  const [historyFilename, setHistoryFilename] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // If we have a target turn index to jump to (from a search result click), scroll to it instead of bottom
    if (targetTurnIndex !== null && targetTurnIndex >= 0 && targetTurnIndex < messages.length) {
       const element = document.getElementById(`message-${targetTurnIndex}`);
       if (element) {
         element.scrollIntoView({ behavior: 'smooth', block: 'center' });
         element.classList.add('bg-indigo-900/40', 'transition-colors', 'duration-500');
         setTimeout(() => {
           element.classList.remove('bg-indigo-900/40');
           setTargetTurnIndex(null); // Clear it after successful jump
         }, 2000);
       }
    } else if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, targetTurnIndex]);

  // Auto-Save Effect
  useEffect(() => {
    if (messages.length > 0 && !isViewMode) {
      vscode.postMessage({
        type: 'save_active_session',
        sessionId: activeSessionId,
        data: {
          timestamp: new Date().toISOString(),
          config: { model: selectedModel, systemPrompt: sessionSystemPrompt, gemId: activeGemId },
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            ...(msg.internalState ? { internalState: msg.internalState } : {})
          }))
        }
      });
    }
  }, [messages, selectedModel, sessionSystemPrompt, activeGemId, isViewMode, activeSessionId]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'response') {
        const data = message.data;
        const newState: InternalState = {
          dissonanceScore: data.dissonanceScore,
          dissonanceReason: data.dissonanceReason,
          semanticNodes: data.semanticNodes || [],
          semanticEdges: data.semanticEdges || [],
          tokenUsage: message.usageMetadata?.totalTokenCount
        };

        setMessages(prev => {
          const modelCount = prev.filter(m => m.role === 'model').length;
          return [...prev, { 
            role: 'model', 
            content: data.reply,
            internalState: newState,
            modelTurnIndex: modelCount
          }];
        });
        setIsLoading(false);
      } else if (message.type === 'error') {
        console.error("Extension Host Error:", message.error);
        const errorText = message.error || "Could not process the request. Check your API Key or Network.";
        setMessages(prev => [...prev, { role: 'model', content: errorText, isError: true }]);
        setIsLoading(false);
      } else if (message.type === 'models_loaded') {
        const models = message.data || message.models || [];
        setAvailableModels(models);
      } else if (message.type === 'sessions_loaded') {
        setSessions(message.sessions || []);
      } else if (message.type === 'search_results_loaded') {
        setSearchResults(message.results || []);
      } else if (message.type === 'gems_loaded') {
        const list = message.data || message.gems || [];
        const userGems = list.filter((g: any) => !g.isBuiltIn && g.id !== 'gem-general' && g.id !== 'gem-coder');
        const finalGems = [...BUILT_IN_GEMS, ...userGems];
        setSavedGems(finalGems);
        if (message.defaultGemId) {
          setDefaultGemId(message.defaultGemId);
        }
        
        // Ensure starting state
        if (activeGemId === 'gem-general' && message.defaultGemId) {
           const defGem = finalGems.find(g => g.id === message.defaultGemId);
           if (defGem) {
             setActiveGemId(defGem.id);
             setSelectedModel(defGem.model);
             setSessionSystemPrompt(defGem.systemPrompt);
           }
        }
      } else if (message.type === 'session_saved') {
        if (!activeSessionId) setActiveSessionId(message.sessionId);
      } else if (message.type === 'load_history') {
        setMessages(message.data.messages || []);
        setIsViewMode(true);
        setHistoryFilename(message.filename || 'Unknown');
        setIsLoading(false);
      } else if (message.type === 'resume_history') {
        setMessages(message.data.messages || []);
        setIsViewMode(false);
        setActiveSessionId(message.sessionId || null);
        setHistoryFilename(message.filename || 'Unknown');
        setSelectedTurnIndex(null);
        setAttachedFiles([]);
        
        // Restore active configuration from history if present
        if (message.data.config) {
          setSelectedModel(message.data.config.model);
          setSessionSystemPrompt(message.data.config.systemPrompt);
          if (message.data.config.gemId) setActiveGemId(message.data.config.gemId);
        }
        setIsLoading(false);
      } else if (message.type === 'file_attached') {
        const file = message.file as AttachedFile;
        setAttachedFiles(prev => [...prev, file]);
      }
    };

    window.addEventListener('message', handleMessage);
    vscode.postMessage({ type: 'webview_ready' });
    return () => window.removeEventListener('message', handleMessage);
  }, [activeSessionId, activeGemId]); 

  const modelMessages = messages.filter(m => m.role === 'model');
  const latestTurnIndex = modelMessages.length > 0 ? modelMessages.length - 1 : -1;
  const activeTurnIndex = selectedTurnIndex !== null ? selectedTurnIndex : latestTurnIndex;
  const activeState = activeTurnIndex >= 0 ? modelMessages[activeTurnIndex].internalState : null;
  const isViewingHistory = selectedTurnIndex !== null && selectedTurnIndex !== latestTurnIndex;

  const historyData = modelMessages.map((msg, idx) => ({
    turn: idx + 1,
    score: msg.internalState?.dissonanceScore ?? 0
  }));

  const handleSelectGem = (gemId: string) => {
    setActiveGemId(gemId);
    const gem = savedGems.find(g => g.id === gemId);
    if (gem) {
      setSelectedModel(gem.model);
      setSessionSystemPrompt(gem.systemPrompt);
    }
    setIsGemSidebarOpen(false);
  };

  const handleSaveGem = (gemProfile: GemProfile) => {
    const isNew = !savedGems.find(g => g.id === gemProfile.id);
    let updatedGems = [...savedGems];
    
    if (isNew) {
      updatedGems.push(gemProfile);
    } else {
      updatedGems = updatedGems.map(g => g.id === gemProfile.id ? gemProfile : g);
    }
    
    setSavedGems(updatedGems);
    const customGems = updatedGems.filter(g => !g.isBuiltIn);
    vscode.postMessage({ type: 'save_gems_config', data: customGems, defaultGemId });
    
    if (activeGemId === gemProfile.id || isNew) {
        handleSelectGem(gemProfile.id);
    }
    setEditingGem(null);
    setCreatingGem(false);
    setIsGemSidebarOpen(false); // Close sidebar on save
  };

  const handleDeleteGem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedGems = savedGems.filter(g => g.id !== id);
    setSavedGems(updatedGems);
    
    const newDefaultId = defaultGemId === id ? 'gem-general' : defaultGemId;
    if (defaultGemId === id) setDefaultGemId(newDefaultId);
    
    const customGems = updatedGems.filter(g => !g.isBuiltIn);
    vscode.postMessage({ type: 'save_gems_config', data: customGems, defaultGemId: newDefaultId });
    
    if (activeGemId === id) {
      handleSelectGem(newDefaultId);
    }
  };
  
  const handleSetDefaultGem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDefaultGemId(id);
    const customGems = savedGems.filter(g => !g.isBuiltIn);
    vscode.postMessage({ type: 'save_gems_config', data: customGems, defaultGemId: id });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (!selectedModel || !chatModels.find(m => m.name.replace('models/', '') === selectedModel.replace('models/', ''))) {
      const errorMsg = 'Invalid model selected. Please choose a compliant `gemini-` chat model before proceeding.';
      setMessages([...messages, { role: 'user', content: input }, { role: 'model', content: errorMsg, isError: true }]);
      setIsLoading(false);
      return;
    }

    const userMessage = input.trim();
    setInput('');
    
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);
    setSelectedTurnIndex(null);

    vscode.postMessage({
      type: 'prompt',
      model: selectedModel,
      systemPrompt: sessionSystemPrompt.trim(),
      history: newMessages,
      responseSchema: responseSchema,
      attachedFiles: attachedFiles.map(f => ({ localPath: f.localPath, name: f.name }))
    });
    setAttachedFiles([]);
  };

  const handleDownloadHistory = () => {
    if (messages.length === 0) return;
    
    const exportData = {
      timestamp: new Date().toISOString(),
      config: {
        model: selectedModel,
        systemPrompt: sessionSystemPrompt,
        gemId: activeGemId
      },
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        ...(msg.internalState ? { internalState: msg.internalState } : {})
      }))
    };

    try {
      if (typeof vscode !== 'undefined') {
        vscode.postMessage({ type: 'save_history', data: exportData });
      } else {
        throw new Error("VS Code API not available");
      }
    } catch (err) {
      console.warn("Falling back to browser-native download:", err);
      try {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cognitive-resonance-history-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (fallbackErr) {
        console.error("Browser fallback download failed", fallbackErr);
      }
    }
  };

  const handleLoadSession = (sessionId: string) => {
    vscode.postMessage({ type: 'load_specific_session', sessionId });
    setTargetTurnIndex(null); // Clear any pending jumps if doing a standard load
    setIsHistorySidebarOpen(false);
  };

  const handleSearchResultClick = (result: any) => {
    if (activeSessionId === result.sessionId) {
      // Already in the session, just jump to the turn
      setTargetTurnIndex(result.turnIndex);
      setIsHistorySidebarOpen(false);
    } else {
      // Load the session first, setting the pending turn index
      setTargetTurnIndex(result.turnIndex);
      vscode.postMessage({ type: 'load_specific_session', sessionId: result.sessionId });
      setIsHistorySidebarOpen(false);
    }
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    vscode.postMessage({ type: 'delete_session', sessionId });
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setMessages([]);
    }
  };

  const startRenameSession = (sessionId: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(sessionId);
    setEditSessionName(currentName);
  };

  const handleRenameSessionSubmit = (sessionId: string, e: React.FormEvent | React.KeyboardEvent | React.MouseEvent) => {
    e.stopPropagation();
    if (e.type === 'submit') {
      (e as React.FormEvent).preventDefault();
    }
    
    if (editSessionName.trim()) {
      vscode.postMessage({ type: 'rename_session', sessionId, newName: editSessionName.trim() });
      
      // Optimitically update local sessions state
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, customName: editSessionName.trim(), preview: editSessionName.trim() } : s));
    }
    setEditingSessionId(null);
  };

  const startNewSession = () => {
    setActiveSessionId(null);
    setMessages([]);
    setIsViewMode(false);
    setIsHistorySidebarOpen(false);
    handleSelectGem(defaultGemId);
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      vscode.postMessage({ type: 'search_history', query: historySearchQuery });
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [historySearchQuery]);

  const allMarkersList = messages
    .filter(m => m.role === 'model' && m.internalState && m.internalState.semanticNodes)
    .flatMap(m => m.internalState!.semanticNodes!);
    
  const markerCounts = new Map<string, number>();
  allMarkersList.forEach(n => {
    const label = n.label || n.id;
    markerCounts.set(label, (markerCounts.get(label) || 0) + 1);
  });
  
  const rankedMarkers = Array.from(markerCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
    
  const filteredMarkers = rankedMarkers.filter(m => m.name.toLowerCase().includes(markerSearchQuery.toLowerCase()));

  return (
    <div className="flex flex-col h-screen bg-[#111116] text-zinc-100 font-sans overflow-hidden">
      
      {/* Session Sidebar Backdrop */}
      {isHistorySidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={() => setIsHistorySidebarOpen(false)}
        />
      )}

      {/* Session Sidebar Options Panel */}
      <div 
        className={cn(
          "fixed top-0 left-0 bottom-0 w-[280px] bg-zinc-900 border-r border-zinc-800/50 shadow-2xl z-50 transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col",
          isHistorySidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
          <div className="flex gap-4">
            <button 
              onClick={() => setActiveSidebarTab('history')}
              className={cn(
                "text-sm font-semibold tracking-wide transition-colors pb-1 border-b-2",
                activeSidebarTab === 'history' ? "text-zinc-200 border-indigo-500" : "text-zinc-500 border-transparent hover:text-zinc-300"
              )}
            >
              History
            </button>
            <button 
              onClick={() => { setActiveSidebarTab('search'); setHistorySearchQuery(''); }}
              className={cn(
                "text-sm font-semibold tracking-wide transition-colors pb-1 border-b-2 flex items-center gap-1.5",
                activeSidebarTab === 'search' ? "text-zinc-200 border-indigo-500" : "text-zinc-500 border-transparent hover:text-zinc-300"
              )}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              Search
            </button>
          </div>
          <button 
            onClick={() => setIsHistorySidebarOpen(false)}
            className="text-zinc-500 hover:text-white transition-colors p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {activeSidebarTab === 'search' && (
          <div className="p-3 border-b border-zinc-800/50 bg-zinc-900/50">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search concepts across all sessions..." 
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                autoFocus
                className="w-full bg-zinc-950/80 border border-zinc-700/50 rounded-lg py-2 pl-3 pr-3 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/80 transition-colors shadow-inner"
              />
            </div>
          </div>
        )}

        {activeSidebarTab === 'history' && (
          <div className="p-3">
            <button
              onClick={startNewSession}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 rounded-lg text-sm font-medium transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              New Session
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1 mt-1">
          {activeSidebarTab === 'history' && sessions.length === 0 && (
            <div className="text-xs text-zinc-500 text-center mt-6">No previous sessions found</div>
          )}
          {activeSidebarTab === 'history' && sessions.map(s => (
            <div 
              key={s.id}
              onClick={() => {
                if (editingSessionId !== s.id) {
                   handleLoadSession(s.id);
                }
              }}
              className={cn(
                "group relative px-3 py-2.5 rounded-lg transition-colors border border-transparent flex justify-between items-center",
                editingSessionId !== s.id && "cursor-pointer",
                activeSessionId === s.id 
                  ? "bg-zinc-800/80 border-zinc-700/50 text-indigo-300" 
                  : "hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200"
              )}
            >
              {editingSessionId === s.id ? (
                <div className="flex items-center gap-2 w-full" onClick={e => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editSessionName}
                    onChange={(e) => setEditSessionName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSessionSubmit(s.id, e);
                      if (e.key === 'Escape') setEditingSessionId(null);
                    }}
                    autoFocus
                    className="flex-1 bg-zinc-950 border border-indigo-500/50 rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none"
                  />
                  <button onClick={(e) => handleRenameSessionSubmit(s.id, e)} className="text-indigo-400 hover:text-indigo-300">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setEditingSessionId(null); }} className="text-zinc-500 hover:text-zinc-300">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ) : (
                <>
                  <div className="truncate text-xs font-medium">
                    {s.customName || s.preview}
                    <div className="text-[10px] text-zinc-600 mt-0.5">{new Date(s.timestamp).toLocaleString()}</div>
                  </div>
                  
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all shrink-0">
                    <button
                      onClick={(e) => startRenameSession(s.id, s.customName || s.preview, e)}
                      className="p-1.5 text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-colors"
                      title="Rename Session"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      className="p-1.5 text-red-500/70 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                      title="Delete Session"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          {activeSidebarTab === 'search' && historySearchQuery.trim() === '' && (
             <div className="text-xs text-zinc-500 text-center mt-6 px-4 leading-relaxed">
               Type a concept to search your entire Cognitive Resonance history index.
             </div>
          )}
          
          {activeSidebarTab === 'search' && historySearchQuery.trim() !== '' && searchResults.length === 0 && (
            <div className="text-xs text-zinc-500 text-center mt-6">No matching concepts found.</div>
          )}
          
          {activeSidebarTab === 'search' && searchResults.map((r, i) => (
            <div 
              key={`${r.sessionId}-${r.turnIndex}-${i}`}
              onClick={() => handleSearchResultClick(r)}
              className={cn(
                "group relative p-3 rounded-lg cursor-pointer transition-colors border border-transparent flex flex-col gap-1.5",
                "hover:bg-zinc-800/60 bg-zinc-900/30 text-zinc-300 hover:border-zinc-700"
              )}
            >
              <div className="flex flex-wrap gap-1">
                 {r.matchedConcepts.map((c: string) => (
                    <span key={c} className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-[10px] font-medium border border-indigo-500/30">
                      {c}
                    </span>
                 ))}
              </div>
              <div className="text-xs text-zinc-400 italic line-clamp-2 px-1 border-l-2 border-zinc-700 ml-1">
                "{r.contextSnippet}"
              </div>
              <div className="text-[10px] text-zinc-500 mt-1 flex justify-between items-center">
                 <span>{new Date(r.timestamp).toLocaleDateString()}</span>
                 <span className="flex items-center gap-1">
                   Turn {r.turnIndex + 1}
                   <svg className="w-3 h-3 text-zinc-600 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                 </span>
              </div>
            </div>
          ))}

          {activeSidebarTab === 'search' && historySearchQuery.trim() === '' && (
             <div className="text-xs text-zinc-500 text-center mt-6 px-4 leading-relaxed">
               Type a concept to search your entire Cognitive Resonance history index.
             </div>
          )}
          
          {activeSidebarTab === 'search' && historySearchQuery.trim() !== '' && searchResults.length === 0 && (
            <div className="text-xs text-zinc-500 text-center mt-6">No matching concepts found.</div>
          )}
          
          {activeSidebarTab === 'search' && searchResults.map((r, i) => (
            <div 
              key={`${r.sessionId}-${r.turnIndex}-${i}`}
              onClick={() => handleSearchResultClick(r)}
              className={cn(
                "group relative p-3 rounded-lg cursor-pointer transition-colors border border-transparent flex flex-col gap-1.5",
                "hover:bg-zinc-800/60 bg-zinc-900/30 text-zinc-300 hover:border-zinc-700"
              )}
            >
              <div className="flex flex-wrap gap-1">
                 {r.matchedConcepts.map((c: string) => (
                    <span key={c} className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-[10px] font-medium border border-indigo-500/30">
                      {c}
                    </span>
                 ))}
              </div>
              <div className="text-xs text-zinc-400 italic line-clamp-2 px-1 border-l-2 border-zinc-700 ml-1">
                "{r.contextSnippet}"
              </div>
              <div className="text-[10px] text-zinc-500 mt-1 flex justify-between items-center">
                 <span>{new Date(r.timestamp).toLocaleDateString()}</span>
                 <span className="flex items-center gap-1">
                   Turn {r.turnIndex + 1}
                   <svg className="w-3 h-3 text-zinc-600 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                 </span>
              </div>
            </div>
          ))}

        </div>
      </div>

      {/* Header */}
      <header className="flex-none px-6 py-4 border-b border-zinc-800/50 bg-zinc-900/30 flex items-center justify-between backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button 
             onClick={() => setIsHistorySidebarOpen(true)}
             className="p-1.5 text-zinc-400 hover:text-indigo-400 bg-zinc-800/30 hover:bg-zinc-800 rounded-md transition-colors"
             title="Session History"
          >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
          </button>
          <div className="h-6 w-px bg-zinc-800 mx-1"></div>
          <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] animate-pulse"></div>
          <h1 className="text-sm font-semibold tracking-wide text-zinc-100 flex items-center gap-2">
            Cognitive Resonance
            <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[10px] font-mono border border-zinc-700/50">
              v0.0.15
            </span>
            {activeState?.tokenUsage && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-500/10 text-indigo-300 rounded text-[10px] font-mono border border-indigo-500/20 shadow-[0_0_8px_rgba(99,102,241,0.15)] ml-2 transition-all">
                <Database className="w-3 h-3 text-indigo-400" />
                {activeState.tokenUsage.toLocaleString()} tokens
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {!isViewMode && (
            <>
              <button
                onClick={handleDownloadHistory}
                disabled={messages.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed hover:text-white bg-zinc-800/30 hover:bg-zinc-800 rounded border border-zinc-800 transition-colors"
                title="Download Snapshot JSON"
              >
                <Download className="w-3.5 h-3.5" />
                Backup
              </button>
            </>
          )}
        </div>
      </header>

      <div className="flex h-full w-full bg-[#0a0a0a] text-zinc-100 font-sans overflow-hidden relative">
      {/* Mobile Backdrop */}
      {isDissonancePanelOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => { setIsDissonancePanelOpen(false); }}
        />
      )}

      {/* Left Sidebar: Dissonance */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-[85vw] sm:w-80 bg-zinc-950 lg:bg-zinc-900/30 border-r border-zinc-800/50 flex flex-col p-6",
        "transform transition-transform duration-300 ease-in-out lg:relative lg:transform-none lg:z-auto",
        isDissonancePanelOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-indigo-400" />
            <h2 className="font-medium tracking-wide text-zinc-100">Internal State</h2>
          </div>
          <div className="flex items-center gap-2">
            {isViewingHistory && (
              <button 
                onClick={() => setSelectedTurnIndex(null)}
                className="text-xs bg-indigo-500/20 text-indigo-300 px-2.5 py-1.5 rounded-md hover:bg-indigo-500/30 transition-colors"
              >
                Return to Current
              </button>
            )}
            <button className="lg:hidden p-1.5 text-zinc-400 hover:text-zinc-100 bg-zinc-800/50 rounded-md" onClick={() => setIsDissonancePanelOpen(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <DissonanceMeter 
          currentScore={activeState?.dissonanceScore ?? null} 
          reason={activeState?.dissonanceReason ?? null} 
          history={historyData} 
          activeTurnIndex={activeTurnIndex}
          isViewingHistory={isViewingHistory}
          onSelectTurn={setSelectedTurnIndex}
        />
      </div>

      {/* Center: Chat */}
      <div className="flex-1 flex flex-col min-w-0 w-full lg:min-w-[400px] max-w-3xl mx-auto lg:border-x border-zinc-800/30 bg-[#0a0a0a] shadow-2xl z-10">
        <div className="p-4 lg:p-6 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/20 backdrop-blur-md relative">
          <div className="flex items-center">
            <button className="lg:hidden p-2 -ml-2 text-zinc-400 hover:text-zinc-100" onClick={() => setIsDissonancePanelOpen(true)}>
              <Activity className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-3 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <BrainCircuit className="w-6 h-6 text-indigo-500" />
            <h1 className="text-lg lg:text-xl font-semibold tracking-tight whitespace-nowrap hidden sm:block">
              {isViewMode ? `Resonance History: ${historyFilename}` : 'Cognitive Resonance'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="lg:hidden p-2 -mr-2 text-zinc-400 hover:text-zinc-100" onClick={() => setIsRightSidebarOpen(true)}>
              <Network className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-4 px-8 text-center">
              <BrainCircuit className="w-12 h-12 opacity-20 mb-2" />
              <p className="text-sm font-medium text-zinc-400">Initiate conversation to observe internal state.</p>
              <div className="text-xs opacity-70 space-y-2 max-w-sm">
                <p>💡 Tip: You can save this session at any time using the download button in the top right.</p>
                <p>Use the <b>Cognitive Resonance: Resume Session</b> command later to pick up right where you left off, or <b>View History</b> for a read-only review.</p>
              </div>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              id={`message-${idx}`}
              className={cn(
                "flex w-full flex-col scroll-mt-24 min-w-0 break-words",
                msg.role === 'user' ? "items-end" : "items-start"
              )}
            >
              {msg.isError ? (
                <div className="max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed bg-red-950/60 text-red-200 border border-red-800/60 rounded-bl-sm">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-red-400 mb-1">Extension Error</p>
                      <p className="break-words whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(msg.content);
                      setCopiedIndex(idx);
                      setTimeout(() => setCopiedIndex(null), 2000);
                    }}
                    className="mt-2.5 flex items-center gap-1.5 text-xs text-red-400/70 hover:text-red-300 transition-colors"
                  >
                    {copiedIndex === idx ? (
                      <><Check className="w-3 h-3" /> Copied!</>
                    ) : (
                      <><Copy className="w-3 h-3" /> Copy error to clipboard</>
                    )}
                  </button>
                </div>
              ) : (
                <div 
                  className={cn(
                    "max-w-[85%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed overflow-hidden break-words min-w-0",
                    msg.role === 'user' 
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 rounded-br-sm" 
                      : "bg-zinc-800/80 text-zinc-200 border border-zinc-700/50 rounded-bl-sm prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:m-0 w-full"
                  )}
                >
                  {msg.role === 'model' && !msg.isError ? (
                    <MarkdownRenderer content={msg.content} />
                  ) : (
                    msg.content
                  )}
                </div>
              )}
              {msg.role === 'model' && msg.modelTurnIndex !== undefined && !msg.isError && (
                <button 
                  onClick={() => {
                    setSelectedTurnIndex(msg.modelTurnIndex!);
                    setIsDissonancePanelOpen(true);
                  }}
                  className={cn(
                    "mt-2 text-xs font-medium transition-colors flex items-center gap-1.5 px-1",
                    activeTurnIndex === msg.modelTurnIndex 
                      ? "text-indigo-400" 
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <Activity className="w-3.5 h-3.5" />
                  {activeTurnIndex === msg.modelTurnIndex ? "Viewing State" : "View State"}
                </button>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-2xl rounded-bl-sm px-5 py-4 flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span className="text-sm text-zinc-400">Processing cognitive state...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {!isViewMode && (
          <div className="p-4 bg-zinc-900/50 border-t border-zinc-800/50 flex flex-col gap-2 relative z-20">
            {/* Prompt Area Controls */}
            <div className="flex items-center gap-2 px-1 pb-1">
              <button 
                 onClick={() => setIsGemSidebarOpen(true)} 
                 className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-zinc-800/40 hover:bg-zinc-800 text-indigo-300 border border-indigo-500/20 rounded-lg transition-colors shadow-sm"
                 title="Manage Gems"
              >
                <Diamond className="w-3.5 h-3.5" />
                {savedGems.find(g => g.id === activeGemId)?.name || 'Select Gem'}
              </button>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className={cn(
                  "text-xs font-medium bg-transparent hover:bg-zinc-800/40 border border-transparent hover:border-zinc-700/50 rounded-lg px-2 py-1.5 cursor-pointer focus:outline-none transition-all max-w-[200px] truncate shadow-sm",
                  (!selectedModel || !chatModels.find(m => m.name.replace('models/', '') === selectedModel.replace('models/', ''))) ? 'text-red-400/90' : 'text-zinc-400'
                )}
                title="Override model for this session"
              >
                {chatModels.length === 0 && (
                  <option value={selectedModel}>{selectedModel}</option>
                )}
                {chatModels.length > 0 && (!selectedModel || !chatModels.find(m => m.name.replace('models/', '') === selectedModel.replace('models/', ''))) && (
                   <option value={selectedModel || ''} className="text-red-500" disabled>Select valid chat model...</option>
                )}
                {chatModels.map((m: any) => {
                  const val = m.name.replace('models/', '');
                  return (
                    <option key={val} value={val}>{m.displayName || val}</option>
                  );
                })}
              </select>
            </div>
            
            {/* Attachment Preview Strip */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 px-1">
                {attachedFiles.map(f => (
                  <div key={f.id} className="flex items-center gap-2 bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-2.5 py-1.5 text-xs group animate-in fade-in slide-in-from-bottom-2 duration-200">
                    {f.preview ? (
                      <img src={f.preview} alt={f.name} className="w-8 h-8 rounded object-cover" />
                    ) : (
                      <FileText className="w-4 h-4 text-zinc-400" />
                    )}
                    <span className="text-zinc-300 max-w-[120px] truncate">{f.name}</span>
                    <button
                      onClick={() => setAttachedFiles(prev => prev.filter(af => af.id !== f.id))}
                      className="p-0.5 text-zinc-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={handleSubmit} className="relative flex items-center">
              {(!selectedModel || (chatModels.length > 0 && !chatModels.find(m => m.name.replace('models/', '') === selectedModel.replace('models/', '')))) && (
                <div className="absolute -top-10 left-0 w-full text-center pointer-events-none z-50">
                  <span className="bg-amber-500/10 text-amber-400 text-xs px-3 py-1.5 rounded-full border border-amber-500/20 shadow-lg pointer-events-auto">
                    Please select a valid 'gemini-' model to continue.
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => vscode.postMessage({ type: 'request_file_selection' })}
                disabled={isLoading}
                className="p-2.5 text-zinc-400 hover:text-indigo-400 transition-colors disabled:opacity-40 shrink-0"
                title="Attach files"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Send a message..."
                disabled={isLoading || !selectedModel || (chatModels.length > 0 && !chatModels.find(m => m.name.replace('models/', '') === selectedModel.replace('models/', '')))}
                className="w-full bg-zinc-950 border border-zinc-700/50 rounded-xl pl-4 pr-12 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading || !selectedModel || (chatModels.length > 0 && !chatModels.find(m => m.name.replace('models/', '') === selectedModel.replace('models/', '')))}
                className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:hover:bg-indigo-600"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Right Sidebar: Semantic Graph */}
      <div className={cn(
        "fixed inset-y-0 right-0 z-50 w-[85vw] sm:w-96 bg-zinc-950 lg:bg-zinc-900/30 border-l border-zinc-800/50 flex flex-col p-6",
        "transform transition-transform duration-300 ease-in-out lg:relative lg:transform-none lg:z-auto",
        isRightSidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
      )}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Network className="w-5 h-5 text-indigo-400" />
            <h2 className="font-medium tracking-wide text-zinc-100">Semantic Markers</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-zinc-900/80 rounded-lg p-0.5 border border-zinc-800">
              <button
                onClick={() => setMarkerViewMode('graph')}
                className={cn("px-2.5 py-1 text-xs font-medium rounded-md transition-all", markerViewMode === 'graph' ? "bg-zinc-700/50 text-indigo-300 shadow-sm" : "text-zinc-500 hover:text-zinc-300")}
              >
                Graph
              </button>
              <button
                onClick={() => setMarkerViewMode('list')}
                className={cn("px-2.5 py-1 text-xs font-medium rounded-md transition-all", markerViewMode === 'list' ? "bg-zinc-700/50 text-indigo-300 shadow-sm" : "text-zinc-500 hover:text-zinc-300")}
              >
                List
              </button>
            </div>
            {isViewingHistory && (
              <button 
                onClick={() => setSelectedTurnIndex(null)}
                className="text-xs bg-indigo-500/20 text-indigo-300 px-2.5 py-1.5 rounded-md hover:bg-indigo-500/30 transition-colors"
              >
                Return to Current
              </button>
            )}
            <button className="lg:hidden p-1.5 text-zinc-400 hover:text-zinc-100 bg-zinc-800/50 rounded-md" onClick={() => setIsRightSidebarOpen(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <p className="text-xs text-zinc-500 mb-4 shrink-0">
            {isViewingHistory 
              ? `Viewing semantic markers for turn ${activeTurnIndex + 1}.` 
              : "Real-time visualization of concepts and their relationships currently active in the model's context window."}
          </p>
          
          {markerViewMode === 'graph' ? (
              <div className="flex-1 min-h-0 relative">
                  <SemanticGraph 
                    nodes={activeState?.semanticNodes ?? []} 
                    edges={activeState?.semanticEdges ?? []} 
                    onNodeClick={(nodeId) => {
                       // Find the first message index where this semantic node appears in the internalState
                       const targetIdx = messages.findIndex(m => 
                         m.internalState?.semanticNodes?.some(n => n.id === nodeId)
                       );
                       if (targetIdx !== -1) {
                          const element = document.getElementById(`message-${targetIdx}`);
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            // Optional: add a temporary highlight class to the element
                            element.classList.add('bg-indigo-900/40', 'transition-colors', 'duration-500');
                            setTimeout(() => {
                              element.classList.remove('bg-indigo-900/40');
                            }, 2000);
                          }
                       }
                    }}
                  />
              </div>
          ) : (
             <div className="flex-1 flex flex-col min-h-0">
                <input
                  type="text"
                  placeholder="Filter markers..."
                  value={markerSearchQuery}
                  onChange={(e) => setMarkerSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500/80 mb-3 shrink-0"
                />
                <div className="flex-1 overflow-y-auto pr-2 space-y-1">
                  {filteredMarkers.length === 0 && (
                     <div className="text-zinc-500 text-xs text-center py-4">No markers found.</div>
                  )}
                  {filteredMarkers.map(m => (
                    <div 
                      key={m.name}
                      onClick={() => {
                         setHistorySearchQuery(m.name);
                         setActiveSidebarTab('search');
                         setIsHistorySidebarOpen(true);
                      }}
                      className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/30 border border-transparent hover:border-zinc-700/50 hover:bg-zinc-800/50 cursor-pointer group transition-colors"
                    >
                      <span className="text-xs text-zinc-300 font-medium truncate pr-2 group-hover:text-indigo-300 transition-colors">{m.name}</span>
                      <span className="text-[10px] font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500 group-hover:bg-indigo-500/10 group-hover:text-indigo-400 transition-colors shrink-0">
                        {m.count}
                      </span>
                    </div>
                  ))}
                </div>
             </div>
          )}
        </div>
        </div>
      </div>

      {/* Gem Sidebar Options Panel */}
      {isGemSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={() => setIsGemSidebarOpen(false)}
        />
      )}
      <div 
        className={cn(
          "fixed top-0 right-0 bottom-0 w-[340px] bg-zinc-900 border-l border-zinc-800/50 shadow-2xl z-50 transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col",
          isGemSidebarOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Diamond className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold tracking-wide text-zinc-200">Gems</h2>
          </div>
          <button 
            onClick={() => { setIsGemSidebarOpen(false); setEditingGem(null); setCreatingGem(false); }}
            className="text-zinc-500 hover:text-white transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {editingGem || creatingGem ? (
           <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 animate-in slide-in-from-right-2 duration-200">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-2">
                <button onClick={() => { setEditingGem(null); setCreatingGem(false); }} className="text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button>
                {creatingGem ? 'New Custom Gem' : 'Edit Gem'}
              </div>
              <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400 ml-1">Name</label>
                  <input
                    type="text"
                    value={editingGem ? editingGem.name : draftGem.name || ''}
                    onChange={(e) => {
                       if (editingGem) setEditingGem({...editingGem, name: e.target.value});
                       else setDraftGem({...draftGem, name: e.target.value});
                    }}
                    placeholder="E.g. Code Reviewer"
                    className="w-full bg-zinc-950/50 text-sm text-zinc-200 border border-zinc-700/50 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  />
              </div>
              <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400 ml-1">Base Model</label>
                  <select
                    value={editingGem ? editingGem.model : draftGem.model || 'gemini-2.5-flash'}
                    onChange={(e) => {
                       if (editingGem) setEditingGem({...editingGem, model: e.target.value});
                       else setDraftGem({...draftGem, model: e.target.value});
                    }}
                    className="w-full bg-zinc-950/50 text-sm text-zinc-200 border border-zinc-700/50 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  >
                    {chatModels.map((m: any) => {
                      const val = m.name.replace('models/', '');
                      return <option key={val} value={val}>{m.displayName || val}</option>;
                    })}
                  </select>
              </div>
              <div className="space-y-1.5 flex-1 flex flex-col">
                  <label className="text-xs font-semibold text-zinc-400 ml-1">System Prompt</label>
                  <textarea
                    value={editingGem ? editingGem.systemPrompt : draftGem.systemPrompt || ''}
                    onChange={(e) => {
                       if (editingGem) setEditingGem({...editingGem, systemPrompt: e.target.value});
                       else setDraftGem({...draftGem, systemPrompt: e.target.value});
                    }}
                    placeholder="You are an expert..."
                    className="w-full bg-zinc-950/50 text-xs text-zinc-300 border border-zinc-700/50 rounded-lg px-3 py-2.5 flex-1 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 font-mono resize-none min-h-[200px]"
                  />
              </div>
              <div className="pt-2">
                 <button
                    onClick={() => {
                        if (editingGem) handleSaveGem(editingGem);
                        else {
                           const newId = 'gem-' + Date.now();
                           handleSaveGem({
                               id: newId,
                               name: draftGem.name || 'Unnamed Gem',
                               model: draftGem.model || 'gemini-2.5-flash',
                               systemPrompt: draftGem.systemPrompt || ''
                           });
                        }
                    }}
                    disabled={editingGem ? !editingGem.name : !draftGem.name}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                 >
                    Save Gem
                 </button>
              </div>
           </div>
        ) : (
           <>
              <div className="p-3">
                <button
                  onClick={() => {
                     setCreatingGem(true);
                     setDraftGem({ name: '', model: 'gemini-2.5-flash', systemPrompt: '' });
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm font-medium transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Create Custom Gem
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2 mt-1">
                {savedGems.map(g => (
                  <div
                    key={g.id}
                    onClick={() => handleSelectGem(g.id)}
                    className={cn(
                      "group relative px-3 py-3 rounded-lg cursor-pointer transition-colors border flex flex-col gap-1",
                      activeGemId === g.id
                        ? "bg-indigo-900/20 border-indigo-500/40 shadow-sm"
                        : "bg-zinc-800/20 border-zinc-800/80 hover:bg-zinc-800/50"
                    )}
                  >
                     <div className="flex items-start justify-between">
                         <div className="flex items-center gap-2">
                             <div className="text-sm font-semibold text-zinc-200">{g.name}</div>
                             {g.isBuiltIn && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-zinc-800 text-zinc-400">Built-in</span>}
                         </div>
                         <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                             <button
                               onClick={(e) => handleSetDefaultGem(g.id, e)}
                               className={cn("p-1.5 rounded-md transition-colors", defaultGemId === g.id ? "text-amber-400" : "text-zinc-500 hover:text-amber-400 hover:bg-amber-400/10")}
                               title="Set as Default"
                             >
                               <Star className="w-3.5 h-3.5" fill={defaultGemId === g.id ? "currentColor" : "none"} />
                             </button>
                             {!g.isBuiltIn && (
                               <>
                                 <button
                                   onClick={(e) => { e.stopPropagation(); setEditingGem(g); }}
                                   className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-md transition-colors"
                                 >
                                   <Edit3 className="w-3.5 h-3.5" />
                                 </button>
                                 <button
                                   onClick={(e) => handleDeleteGem(g.id, e)}
                                   className="p-1.5 text-red-500/70 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                                 >
                                   <Trash2 className="w-3.5 h-3.5" />
                                 </button>
                               </>
                             )}
                         </div>
                     </div>
                     <div className="text-[11px] text-zinc-500 font-medium">{g.model}</div>
                     <div className="text-xs text-zinc-400 line-clamp-2 mt-1">{g.systemPrompt || <span className="italic opacity-50">No system prompt</span>}</div>
                  </div>
                ))}
              </div>
           </>
        )}
      </div>

    </div>
  );
}
