import React, { useState, useRef, useEffect } from 'react';
import { Dataset, ChatMessage, VisualRecommendation } from '../types';
import { InteractiveChart } from './InteractiveChart';
import { Send, Sparkles, Loader2, User, Bot, Trash2, ArrowUpRight } from 'lucide-react';

interface AgentChatConsoleProps {
  dataset: Dataset;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onPinChart: (rec: VisualRecommendation, chartData?: Record<string, any>[]) => void;
  pinnedIds: string[];
}

export const AgentChatConsole: React.FC<AgentChatConsoleProps> = ({
  dataset,
  messages,
  setMessages,
  onPinChart,
  pinnedIds
}) => {
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll chat to newest messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      // Build clean chat history logs
      const historyContext = messages.map(msg => ({
        role: msg.role,
        text: msg.text
      }));
      // Append current user query
      historyContext.push({ role: 'user', text: textToSend });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyContext,
          columns: dataset.columns,
          // Limit rows representation sent to AI for token compliance
          sampleRows: dataset.rows.slice(0, 15),
          rowCount: dataset.rowCount,
          datasetName: dataset.name
        })
      });

      if (!response.ok) {
        throw new Error("Failed to consult the AI model analyst.");
      }

      const responseData = await response.json();

      const modelMessage: ChatMessage = {
        id: `model_${Date.now()}`,
        role: 'model',
        text: responseData.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        chart: responseData.chart || undefined,
        chartData: responseData.chartData || undefined,
        suggestedQuestions: responseData.suggestedQuestions || []
      };

      setMessages(prev => [...prev.filter(m => m.id !== 'usr_cat_provisional'), modelMessage]);
    } catch (error: any) {
      console.error(error);
      const errorMessage: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'system',
        text: `⚠️ Analysis query failed: ${error.message || "Failed to contact proxy backend. Verify your GEMINI_API_KEY environment variable is declared."}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'greet_init',
        role: 'model',
        text: `Hello! I'm your dedicated AI Data Analyst Agent. I've screened **${dataset.name}** and mapped its column relationships.
What would you like me to calculate or plot? You can ask me to write a correlation report, identify anomalies, or render custom comparative charts!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedQuestions: [
          'Can you explain the main dimensions of this dataset?',
          'Plot the largest anomalies as a line chart.',
          'Identify correlations between the continuous numeric columns.'
        ]
      }
    ]);
  };

  // Helper to format response chunks beautifully into HTML/DOM elements
  const formatText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Bold mapping (**bold**)
      const boldRegex = /\*\*(.*?)\*\*/g;
      const formattedLine = line.replace(boldRegex, '<strong>$1</strong>');

      // Bullets check
      if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        return (
          <li
            key={idx}
            className="ml-5 list-disc text-slate-600 text-sm leading-relaxed mb-1.5 font-sans font-medium"
            dangerouslySetInnerHTML={{ __html: formattedLine.substring(2) }}
          />
        );
      }

      // Plain paragraph spacing
      if (line.trim() === '') return <div key={idx} className="h-2" />;

      return (
        <p
          key={idx}
          className="text-sm text-slate-600 leading-relaxed mb-2 font-sans font-medium"
          dangerouslySetInnerHTML={{ __html: formattedLine }}
        />
      );
    });
  };

  return (
    <div className="flex flex-col h-[640px] bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05),0_10px_30px_-10px_rgba(0,0,0,0.03)]">
      
      {/* Console Header */}
      <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-sans font-bold text-slate-800 text-sm tracking-tight leading-none">AI Data Analyst</h3>
            <span className="text-[10px] text-slate-400 font-mono mt-1 block">Active Workspace Thread</span>
          </div>
          <span className="ml-2 text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-0.5 rounded-full font-mono font-bold">
            online
          </span>
        </div>
        
        <button
          onClick={handleClearHistory}
          className="text-slate-400 hover:text-rose-600 transition p-2 hover:bg-slate-100 rounded-xl cursor-pointer border border-transparent hover:border-slate-200"
          title="Reset chat workflow log"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Message list workspace */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isSystem = msg.role === 'system';

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
            >
              {/* Sender Tag Header */}
              <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                {isUser ? (
                  <>
                    <span>You</span>
                    <div className="p-0.5 bg-slate-100 rounded-full text-slate-500">
                      <User className="w-2.5 h-2.5" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-0.5 bg-indigo-50 rounded-full text-indigo-600">
                      <Bot className="w-2.5 h-2.5" />
                    </div>
                    <span>AI Copilot</span>
                  </>
                )}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[85%] rounded-2xl px-5 py-3.5 shadow-2xs ${
                  isUser
                    ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-tr-xs'
                    : isSystem
                    ? 'bg-rose-50 text-rose-900 border border-rose-100 rounded-tl-xs'
                    : 'bg-white border border-slate-100 text-slate-800 rounded-tl-xs shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)]'
                }`}
              >
                {isUser ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap font-sans font-medium">{msg.text}</p>
                ) : (
                  <div className="space-y-1">{formatText(msg.text)}</div>
                )}

                {/* Bubble Timestamp */}
                <div
                  className={`text-[9px] mt-2.5 font-mono text-right font-medium ${
                    isUser ? 'text-indigo-200' : 'text-slate-400'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>

              {/* Inline Dynamic Charts */}
              {msg.chart && (
                <div className="w-full sm:max-w-xl mt-4 animate-fade-in pl-2">
                  <InteractiveChart
                    recommendation={msg.chart}
                    rows={msg.chartData || dataset.rows}
                    onPin={(rec) => onPinChart(rec, msg.chartData)}
                    isPinned={pinnedIds.includes(msg.chart.id)}
                  />
                </div>
              )}

              {/* Suggestions Chips */}
              {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4 pl-2 max-w-[90%]">
                  {msg.suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(q)}
                      className="text-xs font-sans font-semibold text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 px-3.5 py-1.5 rounded-xl transition duration-150 shadow-2xs hover:shadow-xs hover:scale-[1.01] cursor-pointer flex items-center gap-1"
                    >
                      <span>{q}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Loading placeholder */}
        {loading && (
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">
              <Bot className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
              <span>Analyzing models...</span>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-xs px-5 py-4 shadow-2xs flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span className="text-xs text-slate-500 font-sans font-medium">Crunching tables and crafting dynamic charts...</span>
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Input Action Form Container */}
      <div className="p-4 border-t border-slate-100 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputValue);
          }}
          className="flex items-center gap-3"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask me to aggregate metrics, describe correlations, plot segments..."
            className="flex-1 px-5 py-3.5 border border-slate-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 text-sm rounded-2xl outline-none bg-slate-50/50 transition-all placeholder:text-slate-400 font-sans font-medium text-slate-800"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || loading}
            className="p-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white rounded-2xl transition duration-150 disabled:opacity-45 flex items-center justify-center cursor-pointer shadow-md shadow-indigo-600/10 disabled:shadow-none"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
