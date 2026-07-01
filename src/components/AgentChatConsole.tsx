import React, { useState, useRef, useEffect } from 'react';
import { Dataset, ChatMessage, VisualRecommendation } from '../types';
import { InteractiveChart } from './InteractiveChart';
import { Send, Sparkles, Loader2, User, Bot, Trash2, ArrowUpCircle } from 'lucide-react';

interface AgentChatConsoleProps {
  dataset: Dataset;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onPinChart: (rec: VisualRecommendation) => void;
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
        suggestedQuestions: responseData.suggestedQuestions || []
      };

      setMessages(prev => [...prev, modelMessage]);
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
            className="ml-4 list-disc text-sm leading-relaxed mb-1"
            dangerouslySetInnerHTML={{ __html: formattedLine.substring(2) }}
          />
        );
      }

      // Plain paragraph spacing
      if (line.trim() === '') return <div key={idx} className="h-2" />;

      return (
        <p
          key={idx}
          className="text-sm leading-relaxed mb-2"
          dangerouslySetInnerHTML={{ __html: formattedLine }}
        />
      );
    });
  };

  return (
    <div className="flex flex-col h-[580px] bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-xs">
      {/* Console Header */}
      <div className="bg-gray-50/50 border-b border-gray-100 px-5 py-4.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <h3 className="font-sans font-medium text-gray-900 text-sm tracking-tight">AI Co-Analyst Agent</h3>
          <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-mono font-bold animate-pulse">
            Ready
          </span>
        </div>
        
        <button
          onClick={handleClearHistory}
          className="text-gray-400 hover:text-rose-600 transition p-1.5 hover:bg-gray-100 rounded-lg cursor-pointer"
          title="Reset chat workflow log"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Message list workspace */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-gray-50/40">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            {/* Sender header */}
            <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-mono text-gray-400 font-semibold uppercase">
              {msg.role === 'user' ? (
                <>
                  <span>You</span>
                  <User className="w-3 h-3" />
                </>
              ) : (
                <>
                  <Bot className="w-3.5 h-3.5 text-blue-600" />
                  <span>Agent Analyst</span>
                </>
              )}
            </div>

            {/* Bubble body */}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-2xs ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-xs'
                  : msg.role === 'system'
                  ? 'bg-amber-50 text-amber-900 border border-amber-100 rounded-tl-xs'
                  : 'bg-white border border-gray-100 text-gray-800 rounded-tl-xs'
              }`}
            >
              {msg.role === 'user' ? (
                <p className="text-sm leading-normal whitespace-pre-wrap">{msg.text}</p>
              ) : (
                <div className="space-y-1">{formatText(msg.text)}</div>
              )}

              {/* Timestamp footer code */}
              <div
                className={`text-[9px] mt-2 font-mono text-right ${
                  msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'
                }`}
              >
                {msg.timestamp}
              </div>
            </div>

            {/* Inline dynamic Recharts recommendations */}
            {msg.chart && (
              <div className="w-full sm:max-w-xl mt-3 animate-fade-in pl-5">
                <InteractiveChart
                  recommendation={msg.chart}
                  rows={dataset.rows}
                  onPin={onPinChart}
                  isPinned={pinnedIds.includes(msg.chart.id)}
                />
              </div>
            )}

            {/* Dynamic dynamic suggestion catalysts */}
            {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 pl-5 max-w-[90%]">
                {msg.suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(q)}
                    className="text-[11px] font-sans font-medium text-blue-600 hover:text-blue-800 bg-blue-50/40 hover:bg-blue-50 border border-blue-100/40 hover:border-blue-200 px-3 py-1.5 rounded-full transition cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-mono text-gray-400 uppercase">
              <Bot className="w-3.5 h-3.5 text-blue-600 animate-spin" />
              <span>Analyzing spreadsheet patterns...</span>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-xs px-4 py-3 shadow-2xs flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-xs text-gray-500 font-sans">Synthesizing visual queries...</span>
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Input controls block */}
      <div className="p-4 border-t border-gray-100 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputValue);
          }}
          className="flex items-center gap-2.5"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask me to aggregate metrics, describe correlations, plot segments..."
            className="flex-1 px-4 py-3 border border-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-100/50 text-sm rounded-xl outline-none bg-gray-50/70"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || loading}
            className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition duration-150 disabled:opacity-45 flex items-center justify-center cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
