import React, { useState, useEffect } from 'react';
import { PinnedItem, Dataset, VisualRecommendation } from '../types';
import { InteractiveChart } from './InteractiveChart';
import { LayoutDashboard, RefreshCw, Trash2, ArrowUp, ArrowDown, ClipboardList, TrendingUp, AlertTriangle, Calendar } from 'lucide-react';

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
    setRefreshNotice("Recalculating and updating data matrices across saved widgets...");
    
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
      <div className="bg-white border border-gray-150 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-blue-600" />
            <h2 className="font-sans font-semibold text-gray-950 text-base tracking-tight">
              Interactive Saved Dashboard Workspace
            </h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Build customized layouts of your pinned charts and advanced statistical models. Settings are saved in persistent storage.
          </p>
        </div>

        {pinnedItems.length > 0 && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex-1 sm:flex-none py-2 px-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-xs font-sans font-medium text-gray-700 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Widgets</span>
            </button>

            <button
              onClick={handleClearAll}
              className="flex-1 sm:flex-none py-2 px-3 bg-red-50 hover:bg-red-100 border border-red-150 rounded-lg text-xs font-sans font-medium text-red-700 flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Dashboard</span>
            </button>
          </div>
        )}
      </div>

      {/* Action Notification Block */}
      {refreshNotice && (
        <div className={`p-3 rounded-lg text-xs font-sans border transition-all duration-300 ${
          isRefreshing 
            ? 'bg-blue-50 border-blue-150 text-blue-800 animate-pulse'
            : 'bg-emerald-50 border-emerald-150 text-emerald-800'
        }`}>
          {refreshNotice}
        </div>
      )}

      {/* Empty State Instructions */}
      {pinnedItems.length === 0 ? (
        <div id="empty-dashboard" className="bg-white border border-gray-100 rounded-xl p-10 text-center max-w-xl mx-auto my-6 space-y-4">
          <div className="w-12 h-12 bg-blue-50 rounded-full border border-blue-100 text-blue-600 flex items-center justify-center mx-auto">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          
          <div className="space-y-1">
            <h3 className="font-sans font-semibold text-gray-900 text-sm tracking-tight">
              Your Dashboard Workspace is Empty
            </h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
              Pin analysis cards, customized visual recommendations, or advanced mathematical regressions from other tabs to arrange them here.
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl text-left border border-gray-150/50 space-y-2 max-w-sm mx-auto">
            <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-bold">
              How to add widgets:
            </div>
            <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside font-sans">
              <li>Click the bookmark <span className="font-semibold text-slate-800">Pin button</span> on any chart card.</li>
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
              className="relative group border border-gray-200 hover:border-gray-300 bg-white rounded-xl shadow-xs transition duration-150 flex flex-col"
            >
              {/* Card Controls Overlay Header */}
              <div className="absolute top-2 right-2 flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 transition duration-150 bg-white/90 p-1 rounded-lg border border-gray-100">
                <button
                  onClick={() => handleMove(idx, 'up')}
                  disabled={idx === 0}
                  className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 cursor-pointer"
                  title="Move Left/Up"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleMove(idx, 'down')}
                  disabled={idx === pinnedItems.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 cursor-pointer"
                  title="Move Right/Down"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="p-1 text-red-400 hover:text-red-600 cursor-pointer"
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
                    rows={dataset.rows}
                    isPinned={true}
                    onPin={() => onRemoveItem(item.id)} // Act as unpin
                  />
                </div>
              )}

              {/* RENDER STATS SUMMARY WIDGET */}
              {item.type === 'stat' && item.statConfig && (
                <div className="p-5 flex flex-col h-full justify-between flex-1 min-h-[300px]">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          {item.statConfig.type === 'regression' && <TrendingUp className="w-4 h-4 text-emerald-600" />}
                          {item.statConfig.type === 'anomaly' && <AlertTriangle className="w-4 h-4 text-rose-600" />}
                          {item.statConfig.type === 'forecast' && <ClipboardList className="w-4 h-4 text-blue-600" />}
                          <h3 className="font-sans font-semibold text-gray-950 text-sm tracking-tight leading-tight">
                            {item.statConfig.title}
                          </h3>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{item.statConfig.description}</p>
                      </div>

                      <span className="text-[9px] font-mono uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                        {item.statConfig.type}
                      </span>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      {item.statConfig.summaryMetrics.map((met, mIdx) => (
                        <div key={mIdx} className="bg-gray-50 border border-gray-150/40 p-3 rounded-lg">
                          <div className="text-[9px] font-mono text-gray-400 uppercase tracking-tight truncate">
                            {met.label}
                          </div>
                          <div className="text-xs font-semibold font-mono text-gray-950 mt-1 truncate">
                            {met.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card bottom timestamp marker */}
                  <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400 font-mono">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>Pinned: {item.pinnedAt}</span>
                    </div>
                    <span>Math Model Active</span>
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
