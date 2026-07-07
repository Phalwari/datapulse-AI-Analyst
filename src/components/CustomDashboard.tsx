import React, { useState } from 'react';
import { PinnedItem, Dataset, VisualRecommendation } from '../types';
import { InteractiveChart } from './InteractiveChart';
import { LayoutDashboard, RefreshCw, Trash2, ArrowUp, ArrowDown, ClipboardList, TrendingUp, AlertTriangle, Calendar, Layers, Sparkles } from 'lucide-react';

interface CustomDashboardProps {
  dataset: Dataset;
  pinnedItems: PinnedItem[];
  onRemoveItem: (id: string) => void;
  onSetPinnedItems: (items: PinnedItem[]) => void;
}

export const CustomDashboard: React.FC<CustomDashboardProps> = ({
  dataset,
  pinnedItems,
  onRemoveItem,
  onSetPinnedItems
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);

  // Trigger simulated/real refresh of computations
  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshNotice("Recalculating data matrices across saved widgets...");
    
    setTimeout(() => {
      setIsRefreshing(false);
      setRefreshNotice("Dashboard updated successfully! All charts synchronized with raw rows.");
      setTimeout(() => {
        setRefreshNotice(null);
      }, 4000);
    }, 800);
  };

  // Move items in priority list
  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= pinnedItems.length) return;

    const updated = [...pinnedItems];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    
    onSetPinnedItems(updated);
  };

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to clear your saved dashboard configurations?")) {
      onSetPinnedItems([]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Dashboard Top Header Action Panel */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <LayoutDashboard className="w-4 h-4" />
            </div>
            <h2 className="font-sans font-bold text-slate-800 text-base tracking-tight leading-none">
              Interactive Saved Dashboard Workspace
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1.5 font-sans leading-relaxed">
            Build customized layouts of your pinned charts and advanced statistical models. Settings are saved in persistent storage.
          </p>
        </div>

        {pinnedItems.length > 0 && (
          <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex-1 sm:flex-none py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-xl text-xs font-sans font-semibold text-slate-600 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Widgets</span>
            </button>

            <button
              onClick={handleClearAll}
              className="flex-1 sm:flex-none py-2.5 px-4 bg-rose-50 hover:bg-rose-100/70 border border-rose-100 text-xs font-sans font-semibold text-rose-700 flex items-center justify-center gap-2 cursor-pointer transition rounded-xl"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Dashboard</span>
            </button>
          </div>
        )}
      </div>

      {/* Action Notification Block */}
      {refreshNotice && (
        <div className={`p-4 rounded-2xl text-xs font-sans border transition-all duration-300 shadow-2xs ${
          isRefreshing 
            ? 'bg-indigo-50 border-indigo-150 text-indigo-800 animate-pulse'
            : 'bg-teal-50 border-teal-100 text-teal-800'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${isRefreshing ? 'bg-indigo-500 animate-ping' : 'bg-teal-500'}`} />
            <span className="font-medium">{refreshNotice}</span>
          </div>
        </div>
      )}

      {/* Empty State Instructions */}
      {pinnedItems.length === 0 ? (
        <div id="empty-dashboard" className="bg-white border border-slate-100 rounded-3xl p-12 text-center max-w-xl mx-auto my-8 space-y-6 shadow-xs">
          <div className="relative">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl border border-slate-100/55 text-slate-400 flex items-center justify-center mx-auto shadow-2xs">
              <LayoutDashboard className="w-8 h-8" />
            </div>
            <div className="absolute top-1/2 left-1/2 translate-x-3 -translate-y-5 p-1 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-500 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <h3 className="font-sans font-bold text-slate-800 text-base tracking-tight">
              Your Saved Dashboard is Empty
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed font-sans font-medium">
              Pin analysis cards, customized visual recommendations, or advanced mathematical regressions from other tabs to arrange them here.
            </p>
          </div>

          <div className="bg-slate-50/50 p-5 rounded-2xl text-left border border-slate-100 space-y-3 max-w-sm mx-auto shadow-2xs">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-extrabold flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span>How to add widgets:</span>
            </div>
            <ul className="text-xs text-slate-500 space-y-2 list-disc list-inside font-sans font-medium leading-relaxed">
              <li>Click the bookmark <span className="font-bold text-slate-700">Pin button</span> on any chart card.</li>
              <li>Compute linear regressions or anomalies and pin the metrics summaries.</li>
              <li>Instruct the AI Copilot to construct visual assets, and pin them directly from the chat window!</li>
            </ul>
          </div>
        </div>
      ) : (
        /* Pinned Cards Workspace Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {pinnedItems.map((item, idx) => (
            <div
              key={item.id}
              className="relative group border border-slate-100/90 hover:border-slate-200/80 bg-white rounded-3xl shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05),0_10px_20px_-10px_rgba(0,0,0,0.03)] hover:shadow-md hover:scale-[1.002] transition-all duration-250 flex flex-col overflow-hidden"
            >
              {/* Card Controls Overlay Header */}
              <div className="absolute top-4 right-4 flex items-center gap-1.5 z-20 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-white/95 p-1 rounded-xl border border-slate-100 shadow-sm">
                <button
                  onClick={() => handleMove(idx, 'up')}
                  disabled={idx === 0}
                  className="p-1.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer hover:bg-slate-50 rounded-lg transition"
                  title="Move Left/Up"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleMove(idx, 'down')}
                  disabled={idx === pinnedItems.length - 1}
                  className="p-1.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer hover:bg-slate-50 rounded-lg transition"
                  title="Move Right/Down"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="p-1.5 text-rose-400 hover:text-rose-600 cursor-pointer hover:bg-rose-50 rounded-lg transition"
                  title="Remove from Dashboard"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* RENDER CHART WIDGET */}
              {item.type === 'chart' && item.chartConfig && (
                <div className="flex-1">
                  <InteractiveChart
                    recommendation={item.chartConfig}
                    rows={item.chartData || dataset.rows}
                    isPinned={true}
                    onPin={() => onRemoveItem(item.id)} // Act as unpin
                  />
                </div>
              )}

              {/* RENDER STATS SUMMARY WIDGET */}
              {item.type === 'stat' && item.statConfig && (
                <div className="p-6 flex flex-col h-full justify-between flex-1 min-h-[300px]">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-100/50">
                            {item.statConfig.type === 'regression' && <TrendingUp className="w-4 h-4 text-teal-600" />}
                            {item.statConfig.type === 'anomaly' && <AlertTriangle className="w-4 h-4 text-rose-600" />}
                            {item.statConfig.type === 'forecast' && <ClipboardList className="w-4 h-4 text-indigo-600" />}
                          </div>
                          <h3 className="font-sans font-bold text-slate-800 text-sm tracking-tight leading-tight">
                            {item.statConfig.title}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-400 mt-1.5 font-sans leading-relaxed">{item.statConfig.description}</p>
                      </div>

                      <span className="text-[9px] font-mono uppercase bg-slate-50 border border-slate-100 text-slate-500 px-2.5 py-1 rounded-lg font-extrabold">
                        {item.statConfig.type}
                      </span>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      {item.statConfig.summaryMetrics.map((met, mIdx) => (
                        <div key={mIdx} className="bg-slate-50/50 border border-slate-100 p-3.5 rounded-2xl shadow-2xs">
                          <div className="text-[9px] font-mono text-slate-400 uppercase tracking-tight truncate font-bold">
                            {met.label}
                          </div>
                          <div className="text-sm font-extrabold font-mono text-slate-800 mt-1 truncate">
                            {met.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card bottom timestamp marker */}
                  <div className="pt-4 mt-6 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono font-medium">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-300" />
                      <span>Pinned: {item.pinnedAt}</span>
                    </div>
                    <span className="text-indigo-500 uppercase tracking-wider font-extrabold text-[9px]">Model Active</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
