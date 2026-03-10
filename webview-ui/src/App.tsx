import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Send, BrainCircuit, Activity, Network, Loader2, X, Download, Copy, Check, AlertTriangle, Settings, Paperclip, FileText } from 'lucide-react';
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
}

export interface GemProfile {
  id: string;
  name: string;
  model: string;
  systemPrompt: string;
}

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Layout State
  const [isDissonancePanelOpen, setIsDissonancePanelOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  
  // Gem Configuration State
  const [savedGems, setSavedGems] = useState<GemProfile[]>([]);
  const [activeGemId, setActiveGemId] = useState<string>('default');
  const [draftName, setDraftName] = useState<string>('My Custom Gem');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.1-pro-preview');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const [isViewMode, setIsViewMode] = useState(false);
  const [historyFilename, setHistoryFilename] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-Save Effect
  useEffect(() => {
    if (messages.length > 0 && !isViewMode) {
      vscode.postMessage({
        type: 'save_active_session',
        sessionId: activeSessionId,
        data: {
          timestamp: new Date().toISOString(),
          config: { model: selectedModel, systemPrompt: systemPrompt },
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            ...(msg.internalState ? { internalState: msg.internalState } : {})
          }))
        }
      });
    }
  }, [messages, selectedModel, systemPrompt, isViewMode]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'response') {
        const data = message.data;
        const newState: InternalState = {
          dissonanceScore: data.dissonanceScore,
          dissonanceReason: data.dissonanceReason,
          semanticNodes: data.semanticNodes || [],
          semanticEdges: data.semanticEdges || []
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
        
        // If the currently selected model is not in the list, fallback 
        setSelectedModel(prev => {
           if (models.length > 0 && !models.find((m: any) => m.name === prev || m.name === `models/${prev}`)) {
              return models[0].name.replace('models/', '');
           }
           return prev;
        });
      } else if (message.type === 'sessions_loaded') {
        const list = message.sessions || [];
        setSessions(list);
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
        
        // Restore active configuration from history if present
        if (message.data.config) {
          setSelectedModel(message.data.config.model);
          setSystemPrompt(message.data.config.systemPrompt);
          setActiveGemId('custom'); // Or find matching ID
        }
        setIsLoading(false);
      } else if (message.type === 'file_attached') {
        const file = message.file as AttachedFile;
        setAttachedFiles(prev => [...prev, file]);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeSessionId]); // Added activeSessionId to dependencies for session_saved logic

  const modelMessages = messages.filter(m => m.role === 'model');
  const latestTurnIndex = modelMessages.length > 0 ? modelMessages.length - 1 : -1;
  const activeTurnIndex = selectedTurnIndex !== null ? selectedTurnIndex : latestTurnIndex;
  const activeState = activeTurnIndex >= 0 ? modelMessages[activeTurnIndex].internalState : null;
  const isViewingHistory = selectedTurnIndex !== null && selectedTurnIndex !== latestTurnIndex;

  const historyData = modelMessages.map((msg, idx) => ({
    turn: idx + 1,
    score: msg.internalState?.dissonanceScore ?? 0
  }));

  const handleSelectGem = (gem: GemProfile) => {
    setActiveGemId(gem.id);
    setDraftName(gem.name);
    setSelectedModel(gem.model);
    setSystemPrompt(gem.systemPrompt);
  };

  const handleSaveGem = () => {
    const updatedGems = [...savedGems];
    const existingIdx = updatedGems.findIndex(g => g.id === activeGemId);
    
    if (existingIdx >= 0) {
      updatedGems[existingIdx] = { ...updatedGems[existingIdx], name: draftName || 'Unnamed Gem', model: selectedModel, systemPrompt };
    } else {
      const newGem: GemProfile = {
        id: 'gem-' + Date.now(),
        name: draftName || 'My Custom Gem',
        model: selectedModel,
        systemPrompt
      };
      updatedGems.push(newGem);
      setActiveGemId(newGem.id);
    }
    
    setSavedGems(updatedGems);
    vscode.postMessage({ type: 'save_gems', data: updatedGems });
  };

  const handleDeleteGem = () => {
    const updatedGems = savedGems.filter(g => g.id !== activeGemId);
    setSavedGems(updatedGems);
    vscode.postMessage({ type: 'save_gems', data: updatedGems });
    
    if (updatedGems.length > 0) {
      handleSelectGem(updatedGems[0]);
    } else {
      setActiveGemId('default');
      setDraftName('New Gem');
      setSystemPrompt('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);
    setSelectedTurnIndex(null);

    vscode.postMessage({
      type: 'prompt',
      model: selectedModel,
      systemPrompt: systemPrompt.trim(),
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
        systemPrompt: systemPrompt
      },
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        ...(msg.internalState ? { internalState: msg.internalState } : {})
      }))
    };

    vscode.postMessage({ type: 'save_history', data: exportData });
  };

  const handleLoadSession = (sessionId: string) => {
    vscode.postMessage({ type: 'load_specific_session', sessionId });
    setIsSidebarOpen(false);
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    vscode.postMessage({ type: 'delete_session', sessionId });
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setMessages([]);
    }
  };

  const startNewSession = () => {
    setActiveSessionId(null);
    setMessages([]);
    setIsViewMode(false);
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex flex-col h-screen bg-[#111116] text-zinc-100 font-sans overflow-hidden">
      
      {/* Session Sidebar Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Session Sidebar Options Panel */}
      <div 
        className={cn(
          "fixed top-0 left-0 bottom-0 w-[280px] bg-zinc-900 border-r border-zinc-800/50 shadow-2xl z-50 transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-200">Session History</h2>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="text-zinc-500 hover:text-white transition-colors p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-3">
          <button
            onClick={startNewSession}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 rounded-lg text-sm font-medium transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Session
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1 mt-1">
          {sessions.length === 0 && (
            <div className="text-xs text-zinc-500 text-center mt-6">No previous sessions found</div>
          )}
          {sessions.map(s => (
            <div 
              key={s.id}
              onClick={() => handleLoadSession(s.id)}
              className={cn(
                "group relative px-3 py-2.5 rounded-lg cursor-pointer transition-colors border border-transparent flex justify-between items-center",
                activeSessionId === s.id 
                  ? "bg-zinc-800/80 border-zinc-700/50 text-indigo-300" 
                  : "hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200"
              )}
            >
              <div className="truncate text-xs font-medium">
                {s.preview}
                <div className="text-[10px] text-zinc-600 mt-0.5">{new Date(s.timestamp).toLocaleString()}</div>
              </div>
              
              <button
                onClick={(e) => handleDeleteSession(s.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-red-500/70 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Header */}
      <header className="flex-none px-6 py-4 border-b border-zinc-800/50 bg-zinc-900/30 flex items-center justify-between backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button 
             onClick={() => setIsSidebarOpen(true)}
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
              v0.0.5
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {!isViewMode && (
            <button
              onClick={() => setIsConfigOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-indigo-400 bg-zinc-800/30 hover:bg-zinc-800 rounded border border-zinc-800 hover:border-indigo-500/30 transition-all group"
              title="Model & Prompt Configuration"
            >
               <svg className="w-3.5 h-3.5 group-hover:rotate-45 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
               <span className="truncate max-w-[120px]">{activeGemId === 'default' ? 'Default Config' : savedGems.find(g => g.id === activeGemId)?.name || 'Custom...'}</span>
            </button>
          )}
          <button
            onClick={handleDownloadHistory}
            disabled={messages.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed hover:text-white bg-zinc-800/30 hover:bg-zinc-800 rounded border border-zinc-800 transition-colors"
            title="Download Snapshot JSON"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Backup
          </button>
        </div>
      </header>

      <div className="flex h-full w-full bg-[#0a0a0a] text-zinc-100 font-sans overflow-hidden relative">
      {/* Mobile Backdrop */}
      {(isDissonancePanelOpen || isRightSidebarOpen || isConfigOpen) && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => { setIsDissonancePanelOpen(false); setIsRightSidebarOpen(false); setIsConfigOpen(false); }}
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
      <div className="flex-1 flex flex-col w-full lg:min-w-[400px] max-w-3xl mx-auto lg:border-x border-zinc-800/30 bg-[#0a0a0a] shadow-2xl z-10">
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
            {!isViewMode && (
              <>
                <button 
                  onClick={() => setIsConfigOpen(true)}
                  className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors"
                  title="Gem Configuration"
                >
                  <Settings className="w-5 h-5" />
                </button>
                <button 
                  onClick={handleDownloadHistory}
                  disabled={messages.length === 0}
                  className="p-2 text-zinc-400 hover:text-zinc-100 disabled:opacity-50 disabled:hover:text-zinc-400 transition-colors"
                  title="Download Chat History"
                >
                  <Download className="w-5 h-5" />
                </button>
              </>
            )}
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
              className={cn(
                "flex w-full flex-col",
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
                    "max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed",
                    msg.role === 'user' 
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 rounded-br-sm" 
                      : "bg-zinc-800/80 text-zinc-200 border border-zinc-700/50 rounded-bl-sm prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:m-0"
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
              {selectedModel === '' && (
                <div className="absolute -top-10 left-0 w-full text-center pointer-events-none">
                  <span className="bg-amber-500/10 text-amber-400 text-xs px-3 py-1.5 rounded-full border border-amber-500/20 shadow-lg pointer-events-auto">
                    Please select an available model from the menu above to continue.
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
                disabled={isLoading || selectedModel === ''}
                className="w-full bg-zinc-950 border border-zinc-700/50 rounded-xl pl-4 pr-12 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading || selectedModel === ''}
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
        <div className="flex-1 flex flex-col">
          <p className="text-xs text-zinc-500 mb-4">
            {isViewingHistory 
              ? `Viewing semantic markers for turn ${activeTurnIndex + 1}.` 
              : "Real-time visualization of concepts and their relationships currently active in the model's context window."}
          </p>
          <SemanticGraph nodes={activeState?.semanticNodes ?? []} edges={activeState?.semanticEdges ?? []} />
        </div>
        </div>
      </div>

      {/* Gem Configuration Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsConfigOpen(false)} />
          <div className="relative bg-[#111111] border border-zinc-800/80 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800/50 bg-zinc-900/30">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-indigo-400" />
                <h2 className="font-semibold text-zinc-100">Gem Configuration</h2>
              </div>
              <button onClick={() => setIsConfigOpen(false)} className="text-zinc-400 hover:text-zinc-100 transition-colors p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
              
              <div className="space-y-2.5">
                 <div className="flex justify-between items-center mb-1">
                   <label className="text-sm font-medium text-zinc-300 ml-1">Active Gem</label>
                 </div>
                 <select 
                   value={activeGemId} 
                   onChange={(e) => {
                     if (e.target.value === 'new') {
                       setActiveGemId('new');
                       setDraftName('New Gem Format');
                       setSystemPrompt('');
                     } else {
                       const gem = savedGems.find(g => g.id === e.target.value);
                       if (gem) handleSelectGem(gem);
                     }
                   }}
                   className="w-full bg-zinc-900/50 text-sm text-zinc-200 border border-indigo-500/30 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                 >
                   {savedGems.map(g => (
                     <option key={g.id} value={g.id}>{g.name}</option>
                   ))}
                   <option value="new">+ Create New Gem...</option>
                 </select>
               </div>

               <div className="space-y-4 pt-4 border-t border-zinc-800/50">
                <div className="space-y-2.5">
                  <label className="text-xs font-medium text-zinc-400 ml-1">Gem Name</label>
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="w-full bg-zinc-900/50 text-sm text-zinc-200 border border-zinc-700/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>

                <div className="space-y-2.5">
                  <label className="text-xs font-medium text-zinc-400 ml-1">Base Model</label>
                  <select 
                    value={selectedModel} 
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={false}
                    className="w-full bg-zinc-900/50 text-sm text-zinc-200 border border-zinc-700/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                  >
                    {availableModels.length === 0 && (
                      <>
                        <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview</option>
                        <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                        <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                      </>
                    )}
                    {availableModels.length > 0 && selectedModel === '' && <option value="" disabled>Select a Model...</option>}
                    {availableModels.map((m: any) => (
                      <option key={m.name} value={m.name.replace('models/', '')}>{m.displayName || m.name.replace('models/', '')}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2.5">
                  <label className="text-xs font-medium text-zinc-400 ml-1">System Prompt / Persona</label>
                  <div className="relative">
                    <textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      placeholder="Define the model's persona, rules, and behavior... (e.g. You are a helpful expert software engineer...)"
                      className="w-full bg-zinc-900/50 text-sm text-zinc-200 border border-zinc-700/50 rounded-xl px-4 py-3 min-h-[160px] max-h-[400px] resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-zinc-600 transition-all font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-zinc-800/50 bg-zinc-900/30 flex justify-between gap-3">
              {activeGemId !== 'new' && savedGems.find(g => g.id === activeGemId) ? (
                 <button 
                  onClick={handleDeleteGem}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-950/50 hover:text-red-300 transition-colors"
                 >
                  Delete
                 </button>
              ) : <div></div>}
              
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsConfigOpen(false)}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium text-zinc-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => { handleSaveGem(); setIsConfigOpen(false); }}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                >
                  Save & Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
