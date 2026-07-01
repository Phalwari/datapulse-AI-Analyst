import { useState, useEffect } from 'react';
import { Dataset, ChatMessage, AutoAnalysis, PinnedItem, VisualRecommendation } from './types';
import { DatasetSelector } from './components/DatasetSelector';
import { TablePreview } from './components/TablePreview';
import { InsightPanel } from './components/InsightPanel';
import { CustomChartBuilder } from './components/CustomChartBuilder';
import { AgentChatConsole } from './components/AgentChatConsole';
import { AdvancedStats } from './components/AdvancedStats';
import { CustomDashboard } from './components/CustomDashboard';

import {
  FileSpreadsheet,
  LayoutDashboard,
  MessageSquareCode,
  Settings2,
  Table,
  Sparkles,
  ArrowRight,
  Database,
  RefreshCw,
  TrendingUp,
  Pin
} from 'lucide-react';

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'custom_dashboard' | 'chat' | 'builder' | 'advanced_stats' | 'table'>('dashboard');

  // Cache automatic analysis per dataset load
  const [cachedAnalysis, setCachedAnalysis] = useState<AutoAnalysis | null>(null);

  // Maintain conversational thread
  const [chatLogs, setChatLogs] = useState<ChatMessage[]>([]);

  // Local storage synchronization for saved custom dashboards
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>(() => {
    try {
      const saved = localStorage.getItem('analyst_pinned_dashboard');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('analyst_pinned_dashboard', JSON.stringify(pinnedItems));
  }, [pinnedItems]);

  const handlePinChart = (rec: VisualRecommendation) => {
    const isAlreadyPinned = pinnedItems.some(item => item.id === rec.id);
    if (isAlreadyPinned) {
      setPinnedItems(prev => prev.filter(item => item.id !== rec.id));
    } else {
      const newItem: PinnedItem = {
        id: rec.id,
        type: 'chart',
        chartConfig: rec,
        pinnedAt: new Date().toLocaleDateString()
      };
      setPinnedItems(prev => [...prev, newItem]);
    }
  };

  const handlePinStatItem = (newItem: PinnedItem) => {
    setPinnedItems(prev => {
      if (prev.some(item => item.id === newItem.id)) return prev;
      return [...prev, newItem];
    });
  };

  const handleRemovePinnedItem = (id: string) => {
    setPinnedItems(prev => prev.filter(item => item.id !== id));
  };

  // Callback when a dataset loads (via picker or uploader)
  const handleDatasetLoaded = (newDataset: Dataset) => {
    setDataset(newDataset);
    setCachedAnalysis(null); // Clear cached analysis for another dataset
    setActiveTab('dashboard'); // Focus on automatic screen first
    
    // Initialize standard greeting with sample context
    setChatLogs([
      {
        id: 'greet_init',
        role: 'model',
        text: `Hello! I'm your dedicated AI Data Analyst Agent. I've screened **${newDataset.name}** and mapped its column relationships.
What would you like me to calculate or plot? You can ask me to write a correlation report, identify anomalies, or render custom comparative charts!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedQuestions: [
          'Can you explain the main dimensions of this dataset?',
          'Plot the largest elements as a line chart.',
          'Identify correlations between the continuous columns.'
        ]
      }
    ]);
  };

  // Triggers when user clicks on a custom catalysis question from the automatic screening page
  const handleTriggerCatalystQuestion = (question: string) => {
    setActiveTab('chat');
    // We delegate the question execution directly inside the chat log!
    // Since we want the chatbot to execute this immediately:
    // Create actual user chat message
    const userMsg: ChatMessage = {
      id: `usr_cat_${Date.now()}`,
      role: 'user',
      text: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatLogs(prev => [...prev, userMsg]);
    
    // Fire the API call
    triggerInstantChatAnalysis(question);
  };

  const triggerInstantChatAnalysis = async (query: string) => {
    if (!dataset) return;
    
    // Create provisional model processing bubble
    const searchLogs = [...chatLogs, {
      id: `usr_cat_${Date.now()}`,
      role: 'user' as const,
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }];

    try {
      const historyContext = searchLogs.map(msg => ({
        role: msg.role,
        text: msg.text
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyContext,
          columns: dataset.columns,
          sampleRows: dataset.rows.slice(0, 15),
          rowCount: dataset.rowCount,
          datasetName: dataset.name
        })
      });

      if (!response.ok) {
        throw new Error("Analysis failed");
      }

      const responseData = await response.json();

      const modelMessage: ChatMessage = {
        id: `model_cat_${Date.now()}`,
        role: 'model',
        text: responseData.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        chart: responseData.chart || undefined,
        suggestedQuestions: responseData.suggestedQuestions || []
      };

      setChatLogs(prev => [...prev.filter(m => m.id !== 'usr_cat_provisional'), modelMessage]);
    } catch (err: any) {
      console.error(err);
      const errMessage: ChatMessage = {
        id: `err_cat_${Date.now()}`,
        role: 'system',
        text: `⚠️ Automatic investigation query blocked: ${err.message || "Failed to contact proxy server. Double check that GEMINI_API_KEY holds a valid token."}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatLogs(prev => [...prev, errMessage]);
    }
  };

  const handleResetDataset = () => {
    setDataset(null);
    setCachedAnalysis(null);
    setChatLogs([]);
  };

  // If no dataset loaded, display the gorgeous Landing Dashboard Selector
  if (!dataset) {
    return (
      <div id="landing-page" className="min-h-screen bg-slate-50/50 flex flex-col justify-between">
        <DatasetSelector onDatasetLoaded={handleDatasetLoaded} />
        
        {/* Humble Footer */}
        <footer className="py-6 border-t border-gray-150/55 text-center bg-white/50 text-xs font-mono text-gray-400">
          Powered by Gemini 3.5 & Recharts. Built cleanly on React.
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      {/* Top Navigation Workspace Bar */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Active dataset stats */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-sans font-medium text-gray-900 text-sm tracking-tight truncate max-w-xs block sm:max-w-md">
                  {dataset.name}
                </span>
                <span className="text-[10px] font-mono font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  active
                </span>
              </div>
              <p className="text-[11px] font-mono text-gray-400 mt-0.5">
                {dataset.rowCount} rows • {dataset.columns.length} features mapped
              </p>
            </div>
          </div>

          {/* Change Spreadsheet Actions */}
          <button
            onClick={handleResetDataset}
            className="flex items-center gap-2 px-3.5 py-1.5 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-xs text-gray-600 font-sans font-medium rounded-lg transition duration-150 shadow-2xs cursor-pointer bg-white"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Load Different Sheet</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        
        {/* Tabs Console Switcher */}
        <div className="border-b border-gray-150/60 pb-px flex gap-6 overflow-x-auto scroller-none">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`pb-3 text-xs tracking-tight font-sans font-medium relative transition duration-150 flex items-center gap-2 cursor-pointer ${
              activeTab === 'dashboard'
                ? 'text-blue-600 font-semibold'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Screening Dashboard</span>
            {activeTab === 'dashboard' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('custom_dashboard')}
            className={`pb-3 text-xs tracking-tight font-sans font-medium relative transition duration-150 flex items-center gap-2 cursor-pointer ${
              activeTab === 'custom_dashboard'
                ? 'text-blue-600 font-semibold'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Pin className="w-4 h-4" />
            <span>Custom Saved Dashboard</span>
            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[9px] font-mono rounded-full font-bold border border-amber-100">
              {pinnedItems.length}
            </span>
            {activeTab === 'custom_dashboard' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`pb-3 text-xs tracking-tight font-sans font-medium relative transition duration-150 flex items-center gap-2 cursor-pointer ${
              activeTab === 'chat'
                ? 'text-blue-600 font-semibold'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <MessageSquareCode className="w-4 h-4" />
            <span>AI Copilot Agent</span>
            {activeTab === 'chat' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('builder')}
            className={`pb-3 text-xs tracking-tight font-sans font-medium relative transition duration-150 flex items-center gap-2 cursor-pointer ${
              activeTab === 'builder'
                ? 'text-blue-600 font-semibold'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span>Custom Visual Studio</span>
            {activeTab === 'builder' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('advanced_stats')}
            className={`pb-3 text-xs tracking-tight font-sans font-medium relative transition duration-150 flex items-center gap-2 cursor-pointer ${
              activeTab === 'advanced_stats'
                ? 'text-blue-600 font-semibold'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Advanced Stats</span>
            {activeTab === 'advanced_stats' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('table')}
            className={`pb-3 text-xs tracking-tight font-sans font-medium relative transition duration-150 flex items-center gap-2 cursor-pointer ${
              activeTab === 'table'
                ? 'text-blue-600 font-semibold'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>Raw Table Viewer</span>
            {activeTab === 'table' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
        </div>

        {/* Tab view containers */}
        <div className="animate-fade-in">
          {activeTab === 'dashboard' && (
            <InsightPanel
              dataset={dataset}
              onSelectQuestion={handleTriggerCatalystQuestion}
              analysis={cachedAnalysis}
              setAnalysis={setCachedAnalysis}
              onPinChart={handlePinChart}
              pinnedIds={pinnedItems.map(i => i.id)}
            />
          )}

          {activeTab === 'custom_dashboard' && (
            <CustomDashboard
              dataset={dataset}
              pinnedItems={pinnedItems}
              onRemoveItem={handleRemovePinnedItem}
              onSetPinnedItems={setPinnedItems}
            />
          )}

          {activeTab === 'chat' && (
            <AgentChatConsole
              dataset={dataset}
              messages={chatLogs}
              setMessages={setChatLogs}
              onPinChart={handlePinChart}
              pinnedIds={pinnedItems.map(i => i.id)}
            />
          )}

          {activeTab === 'builder' && (
            <CustomChartBuilder
              dataset={dataset}
              onPinChart={handlePinChart}
              pinnedIds={pinnedItems.map(i => i.id)}
            />
          )}

          {activeTab === 'advanced_stats' && (
            <AdvancedStats
              dataset={dataset}
              onPinItem={handlePinStatItem}
              pinnedIds={pinnedItems.map(i => i.id)}
            />
          )}

          {activeTab === 'table' && (
            <TablePreview dataset={dataset} />
          )}
        </div>
      </main>

      {/* Common footer */}
      <footer className="py-6 border-t border-gray-100 bg-white text-center text-[10px] font-mono text-gray-400 mt-12">
        Active Environment: Cloud Ingress @3000 • CSV Analytical Agent Framework.
      </footer>
    </div>
  );
}
