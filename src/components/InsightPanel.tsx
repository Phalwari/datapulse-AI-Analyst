import React, { useEffect, useState } from 'react';
import { Dataset, AutoAnalysis, VisualRecommendation } from '../types';
import { InteractiveChart } from './InteractiveChart';
import { Sparkles, TrendingUp, AlertTriangle, HelpCircle, CheckCircle2, ChevronRight, Info, Loader2, Compass } from 'lucide-react';

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
      <div id="insights-loading" className="space-y-8">
        <div className="bg-white border border-slate-100 rounded-2xl p-8 flex items-center gap-5 shadow-2xs">
          <div className="p-3 bg-indigo-50 rounded-xl">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-800 leading-tight">Screening dataset relationships</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Gemini is running diagnostic queries to formulate optimal visual recommendations and business hypotheses...
            </p>
          </div>
        </div>

        {/* Premium Skeleton Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white border border-slate-100 rounded-2xl h-56 animate-pulse shadow-2xs" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-100 rounded-2xl h-44 animate-pulse shadow-2xs" />
              <div className="bg-white border border-slate-100 rounded-2xl h-44 animate-pulse shadow-2xs" />
              <div className="bg-white border border-slate-100 rounded-2xl h-44 animate-pulse shadow-2xs" />
            </div>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl h-96 animate-pulse shadow-2xs" />
        </div>
      </div>
    );
  }

  if (errorStr) {
    return (
      <div id="insights-error" className="bg-rose-50 border border-rose-100/60 rounded-2xl p-6 text-rose-900 text-sm flex gap-4 shadow-2xs">
        <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-sm">Screening Report Blocked</h4>
          <p className="mt-1 font-sans text-xs text-rose-700 leading-relaxed">{errorStr}</p>
          <div className="mt-4 text-xs bg-white/70 border border-rose-100/55 px-4 py-2.5 rounded-xl font-mono text-slate-600 leading-relaxed">
            Please make sure that your <strong className="text-slate-800">GEMINI_API_KEY</strong> environment variable is defined with a valid Google Developer Token. You can still customize charts via the <strong className="text-slate-800">Visual Studio</strong> tab!
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="space-y-8">
      {/* Premium Gradient Summary Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 text-slate-100 border border-slate-800 rounded-2xl p-8 shadow-lg relative overflow-hidden">
        <div className="absolute right-0 bottom-0 w-80 h-80 bg-gradient-to-tr from-indigo-500/10 via-sky-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 bg-indigo-500/15 rounded-lg border border-indigo-400/20">
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <h3 className="font-mono font-bold text-[10px] tracking-widest text-indigo-400 uppercase">
            Dataset Analytical Narrative
          </h3>
        </div>
        <p className="font-sans text-sm md:text-base text-slate-200 leading-relaxed max-w-5xl font-medium">
          {analysis.summary}
        </p>
      </div>

      {/* Grid: Left Insights & Visuals, Right Catalyst Question Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side (Insights List + Generated Recommended Charts) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Automated Key Insights */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
                Automated Business Insights
              </h4>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {analysis.insights.map((insight, idx) => {
                const getIcon = () => {
                  switch (insight.type) {
                    case 'positive':
                      return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
                    case 'negative':
                      return <AlertTriangle className="w-4 h-4 text-rose-500" />;
                    case 'trend':
                      return <TrendingUp className="w-4 h-4 text-indigo-600" />;
                    case 'anomaly':
                      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
                    default:
                      return <Info className="w-4 h-4 text-slate-400" />;
                  }
                };

                const getColorClass = () => {
                  switch (insight.type) {
                    case 'positive':
                      return 'bg-emerald-50/20 border-emerald-100 hover:border-emerald-200';
                    case 'negative':
                      return 'bg-rose-50/20 border-rose-100 hover:border-rose-200';
                    case 'trend':
                      return 'bg-indigo-50/20 border-indigo-100 hover:border-indigo-200';
                    case 'anomaly':
                      return 'bg-amber-50/20 border-amber-100 hover:border-amber-200';
                    default:
                      return 'bg-slate-50/40 border-slate-100 hover:border-slate-200';
                  }
                };

                return (
                  <div
                    key={idx}
                    className={`p-5 border rounded-2xl flex flex-col justify-between ${getColorClass()} shadow-2xs hover:shadow-xs hover:scale-[1.01] transition-all duration-200`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1 rounded-md bg-white border border-slate-100 shadow-2xs">
                          {getIcon()}
                        </div>
                        <h4 className="font-sans font-bold text-slate-800 text-xs tracking-tight line-clamp-1">
                          {insight.title}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed font-sans font-medium line-clamp-4">
                        {insight.description}
                      </p>
                    </div>

                    {(insight.metric || insight.value) && (
                      <div className="mt-4 pt-3 border-t border-slate-100/60 flex items-center justify-between text-[10px] font-mono">
                        <span className="text-slate-400 uppercase truncate max-w-[100px] font-semibold">{insight.metric}</span>
                        <span className="font-bold text-slate-700 truncate max-w-[100px]">{insight.value}</span>
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
              <div className="flex items-center gap-2 px-1">
                <Sparkles className="w-4 h-4 text-slate-400" />
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
                  Dynamic Recommended Visuals
                </h4>
              </div>
              
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
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm sticky top-24">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100">
              <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                <Compass className="w-4 h-4" />
              </div>
              <h3 className="font-sans font-bold text-xs tracking-wider text-slate-700 uppercase">
                Interactive Exploration
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-5 font-sans">
              Choose one of the core mapped business inquiries below to launch immediate deep-dives with your AI Copilot:
            </p>

            <div className="space-y-2.5">
              {analysis.businessQuestions.map((q, qIdx) => (
                <button
                  key={qIdx}
                  onClick={() => onSelectQuestion(q)}
                  className="w-full text-left text-xs text-slate-600 hover:text-indigo-700 bg-slate-50 hover:bg-indigo-50/50 hover:border-indigo-200/80 border border-slate-100 p-4 rounded-xl transition duration-150 flex items-start gap-2.5 group cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-transform flex-shrink-0 mt-0.5" />
                  <span className="font-sans font-medium leading-relaxed">
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
