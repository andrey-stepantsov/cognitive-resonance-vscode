import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Send, BrainCircuit, Activity, Network, Loader2, X, Download } from 'lucide-react';
import { SemanticGraph, Node, Edge } from './components/SemanticGraph';
import { DissonanceMeter } from './components/DissonanceMeter';
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

interface Message {
  role: 'user' | 'model';
  content: string;
  internalState?: InternalState;
  modelTurnIndex?: number;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTurnIndex, setSelectedTurnIndex] = useState<number | null>(null);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

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
        setMessages(prev => [...prev, { role: 'model', content: "Error: Could not process request from Extension Host." }]);
        setIsLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const modelMessages = messages.filter(m => m.role === 'model');
  const latestTurnIndex = modelMessages.length > 0 ? modelMessages.length - 1 : -1;
  const activeTurnIndex = selectedTurnIndex !== null ? selectedTurnIndex : latestTurnIndex;
  const activeState = activeTurnIndex >= 0 ? modelMessages[activeTurnIndex].internalState : null;
  const isViewingHistory = selectedTurnIndex !== null && selectedTurnIndex !== latestTurnIndex;

  const historyData = modelMessages.map((msg, idx) => ({
    turn: idx + 1,
    score: msg.internalState?.dissonanceScore ?? 0
  }));

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
      history: newMessages,
      responseSchema: responseSchema
    });
  };

  const handleDownloadHistory = () => {
    if (messages.length === 0) return;
    
    const exportData = {
      timestamp: new Date().toISOString(),
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        ...(msg.internalState ? { internalState: msg.internalState } : {})
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cognitive-resonance-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen w-full bg-[#0a0a0a] text-zinc-100 font-sans overflow-hidden relative">
      {/* Mobile Backdrop */}
      {(isLeftSidebarOpen || isRightSidebarOpen) && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => { setIsLeftSidebarOpen(false); setIsRightSidebarOpen(false); }}
        />
      )}

      {/* Left Sidebar: Dissonance */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-[85vw] sm:w-80 bg-zinc-950 lg:bg-zinc-900/30 border-r border-zinc-800/50 flex flex-col p-6",
        "transform transition-transform duration-300 ease-in-out lg:relative lg:transform-none lg:z-auto",
        isLeftSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
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
            <button className="lg:hidden p-1.5 text-zinc-400 hover:text-zinc-100 bg-zinc-800/50 rounded-md" onClick={() => setIsLeftSidebarOpen(false)}>
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
            <button className="lg:hidden p-2 -ml-2 text-zinc-400 hover:text-zinc-100" onClick={() => setIsLeftSidebarOpen(true)}>
              <Activity className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-3 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <BrainCircuit className="w-6 h-6 text-indigo-500" />
            <h1 className="text-lg lg:text-xl font-semibold tracking-tight whitespace-nowrap hidden sm:block">Cognitive Resonance</h1>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={handleDownloadHistory}
              disabled={messages.length === 0}
              className="p-2 text-zinc-400 hover:text-zinc-100 disabled:opacity-50 disabled:hover:text-zinc-400 transition-colors"
              title="Download Chat History"
            >
              <Download className="w-5 h-5" />
            </button>
            <button className="lg:hidden p-2 -mr-2 text-zinc-400 hover:text-zinc-100" onClick={() => setIsRightSidebarOpen(true)}>
              <Network className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-4">
              <BrainCircuit className="w-12 h-12 opacity-20" />
              <p className="text-sm">Initiate conversation to observe internal state.</p>
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
              <div 
                className={cn(
                  "max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed",
                  msg.role === 'user' 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 rounded-br-sm" 
                    : "bg-zinc-800/80 text-zinc-200 border border-zinc-700/50 rounded-bl-sm"
                )}
              >
                {msg.content}
              </div>
              {msg.role === 'model' && msg.modelTurnIndex !== undefined && (
                <button 
                  onClick={() => {
                    setSelectedTurnIndex(msg.modelTurnIndex!);
                    setIsLeftSidebarOpen(true);
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

        <div className="p-4 bg-zinc-900/50 border-t border-zinc-800/50">
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Send a message..."
              disabled={isLoading}
              className="w-full bg-zinc-950 border border-zinc-700/50 rounded-xl pl-4 pr-12 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:hover:bg-indigo-600"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
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
  );
}
