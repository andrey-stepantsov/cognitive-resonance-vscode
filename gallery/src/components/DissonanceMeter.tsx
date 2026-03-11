import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface DissonanceMeterProps {
  currentScore: number | null;
  reason: string | null;
  history: { turn: number; score: number }[];
  activeTurnIndex: number;
  isViewingHistory: boolean;
  onSelectTurn: (index: number) => void;
}

export const DissonanceMeter: React.FC<DissonanceMeterProps> = ({ 
  currentScore, 
  reason, 
  history, 
  activeTurnIndex,
  isViewingHistory,
  onSelectTurn 
}) => {
  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-zinc-500';
    if (score < 30) return 'text-emerald-400';
    if (score < 70) return 'text-amber-400';
    return 'text-rose-500';
  };

  const getScoreBg = (score: number | null) => {
    if (score === null) return 'bg-zinc-800';
    if (score < 30) return 'bg-emerald-500';
    if (score < 70) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-2">
          {isViewingHistory ? "Historical Dissonance" : "Current Dissonance"}
        </div>
        <div className={cn("text-6xl font-mono font-light tracking-tighter", getScoreColor(currentScore))}>
          {currentScore !== null ? currentScore : '--'}
        </div>
        
        {currentScore !== null && (
          <div className="w-full h-1.5 bg-zinc-800 rounded-full mt-6 overflow-hidden">
            <div 
              className={cn("h-full transition-all duration-1000 ease-out", getScoreBg(currentScore))}
              style={{ width: `${currentScore}%` }}
            />
          </div>
        )}
      </div>

      <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-xl p-5 flex-1 flex flex-col">
        <div className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">Analysis</div>
        <p className="text-sm text-zinc-300 leading-relaxed flex-1">
          {reason || "Awaiting input to analyze cognitive state..."}
        </p>
      </div>

      <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-xl p-5 h-64 flex flex-col">
        <div className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">History</div>
        <div className="flex-1 w-full -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={history}
              onClick={(state) => {
                if (state && state.activeTooltipIndex !== undefined) {
                  onSelectTurn(Number(state.activeTooltipIndex));
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="turn" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                itemStyle={{ color: '#e4e4e7' }}
                cursor={{ stroke: '#3f3f46', strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              {activeTurnIndex >= 0 && history[activeTurnIndex] && (
                <ReferenceLine x={history[activeTurnIndex].turn} stroke="#818cf8" strokeDasharray="3 3" />
              )}
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke="#6366f1" 
                strokeWidth={2}
                dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#818cf8' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
