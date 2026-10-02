import React, { useState } from 'react';
import { Cpu, CheckCircle, Code, Database, ChevronDown, ChevronUp, Terminal } from 'lucide-react';

interface AgentStep {
  node: string;
  title: string;
  detail: string;
  sql?: string;
  retry?: number;
}

interface AgentThoughtVisualizerProps {
  steps: AgentStep[];
}

export const AgentThoughtVisualizer: React.FC<AgentThoughtVisualizerProps> = ({ steps }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!steps || steps.length === 0) return null;

  return (
    <div className="w-full my-3 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 shadow-md overflow-hidden text-xs font-mono">
      {/* Header bar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-slate-950/70 hover:bg-slate-950 flex items-center justify-between transition cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1 bg-indigo-500/20 text-indigo-400 rounded-md border border-indigo-500/30">
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold tracking-tight text-slate-200">
            LangGraph Multi-Agent Thought Execution Path ({steps.length} nodes)
          </span>
          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-extrabold">
            COMPLETED
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400 hover:text-white">
          <span>{isOpen ? 'Hide Timeline' : 'Inspect Steps'}</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {/* Expandable Step Nodes Timeline */}
      {isOpen && (
        <div className="p-4 space-y-3 bg-slate-900/90 border-t border-slate-800 animate-fade-in">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-3 relative pl-2">
              {/* Connector vertical line */}
              {idx < steps.length - 1 && (
                <div className="absolute left-[15px] top-6 bottom-0 w-0.5 bg-slate-800" />
              )}

              <div className="p-1 bg-slate-800 border border-slate-700 text-emerald-400 rounded-full z-10 shrink-0 mt-0.5">
                <CheckCircle className="w-3 h-3" />
              </div>

              <div className="flex-1 min-w-0 bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-300">{step.title}</span>
                  <span className="text-[9px] text-slate-500 uppercase">{step.node}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 font-sans leading-relaxed">{step.detail}</p>

                {step.sql && (
                  <div className="mt-2 p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 text-[10px] font-mono text-emerald-300 overflow-x-auto">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[9px] mb-1 font-bold">
                      <Terminal className="w-3 h-3 text-indigo-400" />
                      <span>Formulated DuckDB SQL Query:</span>
                    </div>
                    <code>{step.sql}</code>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
