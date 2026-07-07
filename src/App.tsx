import React, { useState, useEffect } from 'react';
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
  RefreshCw,
  TrendingUp,
  Pin,
  ChevronRight,
  Database,
  HelpCircle
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

  const handlePinChart = (rec: VisualRecommendation, chartData?: Record<string, any>[]) => {
    const isAlreadyPinned = pinnedItems.some(item => item.id === rec.id);
    if (isAlreadyPinned) {
      setPinnedItems(prev => prev.filter(item => item.id !== rec.id));
    } else {
      const newItem: PinnedItem = {
        id: rec.id,
        type: 'chart',
        chartConfig: rec,
        chartData: chartData,
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
        chartData: responseData.chartData || undefined,
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
      <div id="landing-page" className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <DatasetSelector onDatasetLoaded={handleDatasetLoaded} />
        
        {/* Elegant Minimal Footer */}
        <footer className="py-8 border-t border-slate-100 text-center bg-white text-xs font-mono text-slate-400">
          Powered by Gemini 3.5 & Recharts • Sandbox Node Environment v2
        </footer>
      </div>
    );
  }

  interface NavItem {
    id: string;
    label: string;
    description: string;
    icon: React.ComponentType<any>;
    badge: string | number | null;
    badgeColor?: string;
  }

  // Sidebar Menu Items Specification
  const navItems: readonly NavItem[] = [
    {
      id: 'dashboard',
      label: 'Screening Dashboard',
      description: 'Auto anomalies & recommendations',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'custom_dashboard',
      label: 'Custom Dashboard',
      description: 'Your pinned graphs & statistics',
      icon: Pin,
      badge: pinnedItems.length > 0 ? pinnedItems.length : null,
      badgeColor: 'bg-amber-100 text-amber-800 font-mono font-bold'
    },
    {
      id: 'chat',
      label: 'AI Copilot Agent',
      description: 'Conversational calculations & queries',
      icon: MessageSquareCode,
      badge: null
    },
    {
      id: 'builder',
      label: 'Visual Studio',
      description: 'Build custom interactive charts',
      icon: Settings2,
      badge: null
    },
    {
      id: 'advanced_stats',
      label: 'Advanced Stats',
      description: 'Statistical summary metrics',
      icon: TrendingUp,
      badge: null
    },
    {
      id: 'table',
      label: 'Raw Table Viewer',
      description: 'Full spreadsheet explorer',
      icon: Table,
      badge: `${dataset.rowCount} r`
    }
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50/70 flex flex-col lg:flex-row">
      
      {/* LEFT SIDEBAR - Responsive Side-Console (Sticky/Fixed on large viewports, hidden/collapsed on mobile) */}
      <aside className="w-full lg:w-80 bg-slate-900 text-slate-100 border-r border-slate-800 flex flex-col shrink-0">
        
        {/* Brand Banner */}
        <div className="p-6 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-sans font-extrabold text-base tracking-tight text-white leading-none">
                Analyst Agent
              </h2>
              <span className="text-[10px] text-slate-400 font-mono tracking-wider mt-1 block">
                VERSION 2.5 • LIVE
              </span>
            </div>
          </div>
        </div>

        {/* Workspace Quick Stats Box */}
        <div className="p-5 border-b border-slate-800/60 bg-slate-950/45 m-4 rounded-2xl border border-slate-800/50">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-slate-800 text-slate-300 rounded-lg">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider font-bold">
                ACTIVE DATASET
              </span>
              <h3 className="font-sans font-semibold text-white text-sm tracking-tight truncate mt-0.5" title={dataset.name}>
                {dataset.name}
              </h3>
              <div className="flex items-center gap-2 mt-1.5 font-mono text-[11px] text-slate-400">
                <span className="px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                  {dataset.rowCount} rows
                </span>
                <span>•</span>
                <span>{dataset.columns.length} columns</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleResetDataset}
            className="w-full mt-4 flex items-center justify-center gap-2 py-2 px-3 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium rounded-xl transition duration-150 border border-slate-700/60 hover:text-white cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin-hover" />
            <span>Load Different File</span>
          </button>
        </div>

        {/* NAVIGATION LINKS */}
        <nav className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto">
          <span className="px-3 text-[10px] font-mono tracking-wider uppercase text-slate-500 font-bold block mb-2">
            Workspace Tools
          </span>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-150 group text-left cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/10 font-medium'
                    : 'text-slate-400 hover:bg-slate-800/55 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />
                  <div className="min-w-0">
                    <p className={`text-xs tracking-tight leading-none ${isActive ? 'font-semibold' : 'font-medium'}`}>
                      {item.label}
                    </p>
                    <p className={`text-[10px] mt-1 truncate ${isActive ? 'text-indigo-100' : 'text-slate-500 group-hover:text-slate-400'}`}>
                      {item.description}
                    </p>
                  </div>
                </div>
                {item.badge !== null ? (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : item.badgeColor || 'bg-slate-800 text-slate-400 border border-slate-700/50'}`}>
                    {item.badge}
                  </span>
                ) : (
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isActive ? 'opacity-100 translate-x-0.5' : 'opacity-0 group-hover:opacity-100'}`} />
                )}
              </button>
            );
          })}
        </nav>

        {/* Small Ambient Credits */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/20 flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span>PORT: 3000 • TLS</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span>Ready</span>
          </span>
        </div>
      </aside>

      {/* MOBILE TOP RAIL - Renders only on smaller displays */}
      <div className="lg:hidden bg-slate-900 text-white p-4 border-b border-slate-800 sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-600 rounded-lg">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-sans font-bold text-sm tracking-tight text-white leading-none">
              Analyst Agent
            </h2>
            <p className="text-[9px] font-mono text-slate-400 truncate max-w-xs mt-0.5">
              {dataset.name} ({dataset.rowCount} rows)
            </p>
          </div>
        </div>
        
        <button
          onClick={handleResetDataset}
          className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-slate-300 hover:text-white rounded-lg transition"
          title="Load Different Dataset"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* MOBILE TABS CONTROLLER BAR - Renders only on smaller displays */}
      <div className="lg:hidden bg-white border-b border-slate-100 flex items-center overflow-x-auto px-4 py-2 sticky top-[53px] z-35 shadow-xs scrollbar-none">
        <div className="flex items-center gap-2 shrink-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {item.badge !== null && (
                  <span className={`text-[9px] font-mono px-1 rounded-full ${isActive ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-100 text-slate-500'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT MAIN CANVAS CONTAINER */}
      <main className="flex-1 flex flex-col min-w-0">
        
        {/* Modern Workspace Canvas Inner Frame */}
        <div className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto space-y-6">
          
          {/* Active Workspace Header Accent */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-200/80 gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono tracking-wider">
                <span>PROJECT WORKSPACE</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-indigo-600 font-semibold uppercase">{activeTab.replace('_', ' ')}</span>
              </div>
              <h1 className="font-sans font-extrabold text-2xl md:text-3xl text-slate-900 tracking-tight mt-1">
                {activeTab === 'dashboard' && "Screening & Insights"}
                {activeTab === 'custom_dashboard' && "Saved Custom Dashboard"}
                {activeTab === 'chat' && "AI Data Copilot"}
                {activeTab === 'builder' && "Interactive Visualizer"}
                {activeTab === 'advanced_stats' && "Advanced Statistical Analytics"}
                {activeTab === 'table' && "Spreadsheet Records Explorer"}
              </h1>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 bg-slate-100 border border-slate-200/55 px-2.5 py-1 rounded-lg font-mono">
                Environment: Development
              </span>
            </div>
          </div>

          {/* Active Tab Component Render Frame with gorgeous micro-animations */}
          <div className="animate-fade-in duration-200">
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
        </div>

        {/* Global Footer in main space */}
        <footer className="py-6 border-t border-slate-150/70 bg-white/40 text-center text-[10px] font-mono text-slate-400 mt-auto">
          Active Space: Cloud Container Workspace • UTF-8 CSV Stream • Engine Port 3000
        </footer>
      </main>

    </div>
  );
}
