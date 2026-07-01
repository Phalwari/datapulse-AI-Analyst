import React, { useEffect, useState } from 'react';
import { Dataset, AutoAnalysis, VisualRecommendation } from '../types';
import { InteractiveChart } from './InteractiveChart';
import { Sparkles, TrendingUp, AlertTriangle, HelpCircle, CheckCircle2, ChevronRight, Info, Loader2 } from 'lucide-react';

interface InsightPanelProps {
  dataset: Dataset;
  onSelectQuestion: (question: string) => void;
  // Hold onto insights across component mount
  analysis: AutoAnalysis | null;
  setAnalysis: React.Dispatch<React.SetStateAction<AutoAnalysis | null>>;
  onPinChart: (rec: VisualRecommendation) => void;
  pinnedIds: string[];
}

export const InsightPanel: React.FC<InsightPanelProps> = ({
  dataset,
  onSelectQuestion,
  analysis,
  setAnalysis,
  onPinChart,
  pinnedIds
}) => {
  const [loading, setLoading] = useState(false);
  const [errorStr, setErrorStr] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch if we don't have analysis cached for this dataset name
    if (analysis) return;

    const fetchAnalysis = async () => {
      setLoading(true);
      setErrorStr(null);
      try {
        const response = await fetch('/api/analyze-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            datasetSummary: { name: dataset.name },
            columns: dataset.columns,
            // Grab a representative sample of 15 rows to give context without hitting token limits
            sampleRows: dataset.rows.slice(0, 15),
            rowCount: dataset.rowCount
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Failed to analyze data.");
        }

        const data = await response.json();
        setAnalysis(data);
      } catch (err: any) {
        console.error(err);
        setErrorStr(err.message || "An error occurred during dataset screening.");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [dataset, analysis, setAnalysis]);

  if (loading) {
    return (
      <div id="insights-loading" className="space-y-6">
        <div className="bg-white border border-gray-150 rounded-xl p-6 flex items-center gap-4">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 leading-tight">Screening dataset metadata</h3>
            <p className="text-xs text-gray-500 mt-0.5">Gemini is running diagnostic queries to formulate optimal charts and business questions...</p>
          </div>
        </div>

        {/* Skeleton grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-gray-100/50 border border-gray-100 rounded-xl h-48 animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-100/50 border border-gray-100 rounded-xl h-40 animate-pulse" />
              <div className="bg-gray-100/50 border border-gray-100 rounded-xl h-40 animate-pulse" />
            </div>
          </div>
          <div className="bg-gray-100/50 border border-gray-100 rounded-xl h-96 animate-pulse" />
        </div>
      </div>
    );
  }

  if (errorStr) {
    return (
      <div id="insights-error" className="bg-amber-50 border border-amber-100 rounded-xl p-5 text-amber-900 text-sm flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold">Screening Report Blocked</h4>
          <p className="mt-1 font-sans text-xs text-amber-800">{errorStr}</p>
          <div className="mt-3 text-xs bg-amber-100/50 px-3 py-1.5 rounded font-mono font-medium text-amber-900">
            Make sure your GEMINI_API_KEY is configured in Secrets. You can still compile charts using the manual visual builder!
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="space-y-8">
      {/* Dynamic Summary Block */}
      <div className="bg-slate-900 text-slate-100 border border-slate-800 rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 w-48 h-48 bg-gradient-to-br from-blue-500/10 to-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <h3 className="font-sans font-semibold text-xs tracking-wider text-blue-400 uppercase">
            Dataset Screening Summary
          </h3>
        </div>
        <p className="font-sans text-sm md:text-base text-slate-200 leading-relaxed max-w-4xl font-medium">
          {analysis.summary}
        </p>
      </div>

      {/* Grid: Left Insights & Visuals, Right Catalyst Question Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side (Insights List + Generated Recommended Charts) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Automated Key Insights */}
          <div className="space-y-4">
            <h4 className="text-xs font-mono uppercase tracking-wider text-gray-500 font-bold">
              Automated Business Insights
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {analysis.insights.map((insight, idx) => {
                const getIcon = () => {
                  switch (insight.type) {
                    case 'positive':
                      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
                    case 'negative':
                      return <AlertTriangle className="w-4 h-4 text-rose-500" />;
                    case 'trend':
                      return <TrendingUp className="w-4 h-4 text-blue-500" />;
                    case 'anomaly':
                      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
                    default:
                      return <Info className="w-4 h-4 text-slate-400" />;
                  }
                };

                const getColorClass = () => {
                  switch (insight.type) {
                    case 'positive':
                      return 'bg-emerald-50/50 border-emerald-100';
                    case 'negative':
                      return 'bg-rose-50/50 border-rose-100';
                    case 'trend':
                      return 'bg-blue-50/50 border-blue-100';
                    case 'anomaly':
                      return 'bg-amber-50/50 border-amber-100';
                    default:
                      return 'bg-gray-50/50 border-gray-100';
                  }
                };

                return (
                  <div
                    key={idx}
                    className={`p-4 border rounded-xl flex flex-col justify-between ${getColorClass()} shadow-2xs hover:shadow-xs transition duration-150`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 mb-2.5">
                        {getIcon()}
                        <h4 className="font-sans font-semibold text-gray-900 text-xs tracking-tight line-clamp-1">
                          {insight.title}
                        </h4>
                      </div>
                      <p className="text-xs text-gray-500 leading-normal line-clamp-4">
                        {insight.description}
                      </p>
                    </div>

                    {(insight.metric || insight.value) && (
                      <div className="mt-3.5 pt-2 border-t border-gray-150/40 flex items-center justify-between text-[10px] font-mono">
                        <span className="text-gray-400 uppercase truncate max-w-[100px]">{insight.metric}</span>
                        <span className="font-semibold text-gray-700 truncate max-w-[100px]">{insight.value}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI-Generated Recommended Charts */}
          {analysis.charts && analysis.charts.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-xs font-mono uppercase tracking-wider text-gray-500 font-bold">
                Dynamic Recommended Visuals
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-fade-in">
                {analysis.charts.map((rec) => (
                  <InteractiveChart
                    key={rec.id}
                    recommendation={rec}
                    rows={dataset.rows}
                    onPin={onPinChart}
                    isPinned={pinnedIds.includes(rec.id)}
                  />
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right Side (Business Questions Catalyst Pane) */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-xs sticky top-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-50">
              <HelpCircle className="w-4 h-4 text-blue-600" />
              <h3 className="font-sans font-semibold text-xs tracking-wider text-gray-500 uppercase">
                Explore Hypotheses Guide
              </h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Select any question below to immediately let the AI agent investigate this specific stream of insights:
            </p>

            <div className="space-y-2.5">
              {analysis.businessQuestions.map((q, qIdx) => (
                <button
                  key={qIdx}
                  onClick={() => onSelectQuestion(q)}
                  className="w-full text-left text-xs text-slate-700 hover:text-blue-700 bg-gray-50 hover:bg-blue-50/40 hover:border-blue-200 border border-transparent p-3.5 rounded-xl transition duration-150 flex items-start gap-2 group cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 flex-shrink-0 mt-0.5 transition-colors" />
                  <span className="font-sans leading-relaxed group-hover:underline">
                    {q}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
