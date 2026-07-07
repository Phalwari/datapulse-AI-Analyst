import React, { useState, useMemo } from 'react';
import { Dataset, VisualRecommendation } from '../types';
import { InteractiveChart } from './InteractiveChart';
import { Settings2, BarChart2, AlertCircle, Sparkles, Sliders } from 'lucide-react';

interface CustomChartBuilderProps {
  dataset: Dataset;
  onPinChart: (rec: VisualRecommendation) => void;
  pinnedIds: string[];
}

export const CustomChartBuilder: React.FC<CustomChartBuilderProps> = ({
  dataset,
  onPinChart,
  pinnedIds
}) => {
  const { columns } = dataset;

  const [chartType, setChartType] = useState<'bar' | 'line' | 'area' | 'scatter' | 'pie' | 'radar'>('bar');
  const [xAxisKey, setXAxisKey] = useState<string>(columns[0]?.name || '');
  const [selectedYKeys, setSelectedYKeys] = useState<string[]>([]);
  const [customTitle, setCustomTitle] = useState('');

  // Extract list of potential numeric column options
  const numericColumns = useMemo(() => {
    return columns.filter(col => col.type === 'numeric');
  }, [columns]);

  // Handle toggling of Y-axis numeric metrics
  const handleToggleYKey = (yKey: string) => {
    if (selectedYKeys.includes(yKey)) {
      setSelectedYKeys(prev => prev.filter(k => k !== yKey));
    } else {
      // Limit to max 2 Y keys to avoid cluttering the visualization dimensions
      if (selectedYKeys.length >= 2) {
        setSelectedYKeys(prev => [prev[1], yKey]);
      } else {
        setSelectedYKeys(prev => [...prev, yKey]);
      }
    }
  };

  // Compile visual recommendation model dynamically
  const recommendation = useMemo<VisualRecommendation | null>(() => {
    if (!xAxisKey || selectedYKeys.length === 0) return null;

    const dynamicId = `custom_${xAxisKey}_${selectedYKeys.join('_')}_${chartType}`;

    return {
      id: dynamicId,
      type: chartType,
      title: customTitle || `${selectedYKeys.join(' & ')} by ${xAxisKey}`,
      xAxisKey: xAxisKey,
      yAxisKeys: selectedYKeys,
      description: `Manual visual representation of ${selectedYKeys.join(' & ')} plotted against ${xAxisKey}.`,
      summary: ''
    };
  }, [chartType, xAxisKey, selectedYKeys, customTitle]);

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Configuration Controls Sidebar */}
      <div className="w-full lg:w-80 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex-shrink-0 h-fit space-y-6">
        <div className="flex items-center gap-2.5 pb-3.5 border-b border-slate-100">
          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Settings2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-sans font-bold text-slate-800 text-sm tracking-tight">Manual Chart Studio</h3>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">VISUAL WORKBENCH</p>
          </div>
        </div>

        {/* 1. Chart Type Selection */}
        <div className="space-y-2.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-extrabold block">
            Chart Layout
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['bar', 'line', 'area', 'scatter', 'pie', 'radar'] as const).map(type => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                className={`text-xs capitalize py-2.5 px-3 rounded-xl border font-semibold transition-all duration-150 text-center cursor-pointer ${
                  chartType === type
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100/70 border-slate-100 text-slate-600 hover:text-slate-800'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Title customization */}
        <div className="space-y-2">
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-extrabold block">
            Chart Headline
          </label>
          <input
            type="text"
            placeholder="Custom title (optional)"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 text-xs rounded-xl bg-slate-50/50 font-sans font-medium text-slate-700 outline-none"
          />
        </div>

        {/* 3. X-Axis Selection */}
        <div className="space-y-2">
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-extrabold block">
            Dimension Name (X-Axis)
          </label>
          <select
            value={xAxisKey}
            onChange={(e) => setXAxisKey(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 text-xs font-mono rounded-xl bg-white text-slate-700 outline-none cursor-pointer"
          >
            {columns.map(col => (
              <option key={col.name} value={col.name}>
                {col.name} ({col.type})
              </option>
            ))}
          </select>
        </div>

        {/* 4. Y-Axis Multi-metrics */}
        <div className="space-y-2.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-extrabold block flex items-center justify-between">
            <span>Measure Metrics (Y-Axis)</span>
            <span className="text-[9px] lowercase text-slate-400 font-normal font-sans normal-case">
              Select 1 or 2
            </span>
          </label>

          {numericColumns.length === 0 ? (
            <div className="p-4 bg-amber-50 text-amber-800 border border-amber-100/85 rounded-2xl text-xs flex gap-2.5 font-sans">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">Could not detect any continuous numerical columns (e.g., currency, integers, fractions) to plot measures.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
              {numericColumns.map(col => {
                const isSelected = selectedYKeys.includes(col.name);
                return (
                  <button
                    key={col.name}
                    onClick={() => handleToggleYKey(col.name)}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border text-xs font-mono transition-all duration-150 flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950 font-bold'
                        : 'bg-slate-50 hover:bg-slate-100/70 border-slate-100 text-slate-600'
                    }`}
                  >
                    <span className="truncate pr-2">{col.name}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-sans font-bold uppercase shrink-0 ${isSelected ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-100 text-slate-400'}`}>
                      {isSelected ? 'Selected' : 'Plot'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Render Output Workspace */}
      <div className="flex-1 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-center min-h-[460px]">
        {recommendation ? (
          <InteractiveChart
            recommendation={recommendation}
            rows={dataset.rows}
            onPin={onPinChart}
            isPinned={pinnedIds.includes(recommendation.id)}
          />
        ) : (
          <div id="builder-empty-state" className="flex flex-col items-center justify-center p-8 text-center text-slate-400 max-w-sm mx-auto">
            <div className="relative mb-6">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100/55 shadow-2xs">
                <BarChart2 className="w-8 h-8 text-slate-400" />
              </div>
              <div className="absolute -top-1 -right-1 p-1 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-500 shadow-2xs">
                <Sliders className="w-3.5 h-3.5" />
              </div>
            </div>
            
            <h4 className="font-sans font-bold text-slate-800 text-base tracking-tight mb-2">
              Awaiting Configuration
            </h4>
            <p className="font-sans text-xs text-slate-400 leading-relaxed font-medium">
              Select a continuous dimension for your X-Axis and choose up to two metrics for the Y-Axis in the controls sidebar to render a beautiful chart.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
