import React, { useState, useMemo } from 'react';
import { Dataset, VisualRecommendation } from '../types';
import { InteractiveChart } from './InteractiveChart';
import { Settings2, BarChart2, Plus, AlertCircle } from 'lucide-react';

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

  // Compile visual recomendation model dynamically
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
    <div className="flex flex-col md:flex-row gap-6">
      {/* Configuration Controls Sidebar */}
      <div className="w-full md:w-80 bg-white border border-gray-100 rounded-xl p-5 shadow-xs flex-shrink-0 h-fit space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-50">
          <Settings2 className="w-4 h-4 text-blue-600" />
          <h3 className="font-sans font-medium text-gray-900 text-sm tracking-tight">Manual Chart Studio</h3>
        </div>

        {/* 1. Chart Type Selection */}
        <div className="space-y-2">
          <label className="text-[11px] font-mono uppercase tracking-wider text-gray-500 font-bold block">
            Chart Layout
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['bar', 'line', 'area', 'scatter', 'pie', 'radar'] as const).map(type => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                className={`text-xs capitalize py-2 px-2.5 rounded-lg border font-medium transition duration-150 text-center ${
                  chartType === type
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-gray-50 hover:bg-gray-100/50 border-gray-100 text-gray-600'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Title customization */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono uppercase tracking-wider text-gray-500 font-bold block">
            Chart Headline
          </label>
          <input
            type="text"
            placeholder="Custom title (optional)"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 text-xs rounded-lg bg-gray-50/20"
          />
        </div>

        {/* 3. X-Axis Selection */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono uppercase tracking-wider text-gray-500 font-bold block">
            Dimension Name (X-Axis)
          </label>
          <select
            value={xAxisKey}
            onChange={(e) => setXAxisKey(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 text-xs font-mono rounded-lg bg-white"
          >
            {columns.map(col => (
              <option key={col.name} value={col.name}>
                {col.name} ({col.type})
              </option>
            ))}
          </select>
        </div>

        {/* 4. Y-Axis Multi-metrics */}
        <div className="space-y-2">
          <label className="text-[11px] font-mono uppercase tracking-wider text-gray-500 font-bold block flex items-center justify-between">
            <span>Measure Metrics (Y-Axis)</span>
            <span className="text-[10px] lowercase text-gray-400 font-normal normal-case">
              Select 1 or 2
            </span>
          </label>

          {numericColumns.length === 0 ? (
            <div className="p-3 bg-amber-50 text-amber-800 border border-amber-100 rounded-lg text-xs flex gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Could not detect any continuous numerical columns (e.g., currency, integers, fractions) to plot measures.</span>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
              {numericColumns.map(col => (
                <button
                  key={col.name}
                  onClick={() => handleToggleYKey(col.name)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-mono transition duration-150 flex items-center justify-between ${
                    selectedYKeys.includes(col.name)
                      ? 'bg-blue-50/40 border-blue-200 text-blue-950 font-medium'
                      : 'bg-gray-50 hover:bg-gray-100/50 border-gray-100 text-gray-600'
                  }`}
                >
                  <span className="truncate">{col.name}</span>
                  <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                    {selectedYKeys.includes(col.name) ? 'Selected' : 'Plot'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Render Output Workspace */}
      <div className="flex-1 bg-white border border-gray-100 rounded-xl p-5 shadow-xs flex flex-col justify-center min-h-[380px]">
        {recommendation ? (
          <InteractiveChart
            recommendation={recommendation}
            rows={dataset.rows}
            onPin={onPinChart}
            isPinned={pinnedIds.includes(recommendation.id)}
          />
        ) : (
          <div id="builder-empty-state" className="flex flex-col items-center justify-center p-8 text-center text-gray-400 max-w-sm mx-auto">
            <div className="p-3 bg-gray-50 rounded-full text-gray-300 mb-4 border border-gray-100">
              <BarChart2 className="w-8 h-8" />
            </div>
            <h4 className="font-sans font-medium text-gray-900 text-sm tracking-tight mb-1">
              Awaiting Configuration
            </h4>
            <p className="font-sans text-xs text-gray-500 leading-normal">
              Select at least one continuous dimension (X-Axis) and at least one plotted metric column (Y-Axis) from the studio dashboard to render a beautiful real-time visualization.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
