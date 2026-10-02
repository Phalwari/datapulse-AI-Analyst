import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { VisualRecommendation } from '../types';
import { Pin } from 'lucide-react';

interface InteractiveChartProps {
  recommendation: VisualRecommendation;
  rows: Record<string, any>[];
  onPin?: (rec: VisualRecommendation) => void;
  isPinned?: boolean;
}

const PALETTE = [
  '#4f46e5', // indigo-600
  '#0d9488', // teal-600
  '#ca8a04', // yellow-600
  '#db2777', // pink-600
  '#7c3aed', // violet-600
  '#0284c7', // sky-600
  '#ea580c', // orange-600
];

export const InteractiveChart: React.FC<InteractiveChartProps> = ({
  recommendation,
  rows,
  onPin,
  isPinned = false
}) => {
  const { type, title, xAxisKey, yAxisKeys, description, summary, aggregation = 'sum' } = recommendation;

  // Aggregate duplicate xAxisKey rows correctly based on selected aggregation metric
  const chartData = useMemo(() => {
    if (!rows || rows.length === 0) return [];

    // Ensure the key exists in data to avoid rendering empty/broken charts with "Unknown" or NaNs
    const firstRow = rows[0];
    if (!(xAxisKey in firstRow) || !yAxisKeys.every(yKey => yKey in firstRow)) {
      return [];
    }

    const groupedMap = new Map<string, Record<string, { sum: number; count: number; min: number; max: number }>>();
    
    rows.forEach(row => {
      // Coerce X-axis label to string
      const rawXVal = row[xAxisKey];
      const xVal = rawXVal === undefined || rawXVal === null ? 'Unknown' : String(rawXVal);
      
      if (!groupedMap.has(xVal)) {
        groupedMap.set(xVal, {});
      }
      
      const group = groupedMap.get(xVal)!;
      
      yAxisKeys.forEach(yKey => {
        const val = parseFloat(row[yKey]);
        if (!isNaN(val)) {
          if (!group[yKey]) {
            group[yKey] = { sum: 0, count: 0, min: Infinity, max: -Infinity };
          }
          group[yKey].sum += val;
          group[yKey].count += 1;
          if (val < group[yKey].min) group[yKey].min = val;
          if (val > group[yKey].max) group[yKey].max = val;
        }
      });
    });

    // Transform map to array of objects applying specific math functions
    const result: Record<string, any>[] = [];
    groupedMap.forEach((metrics, key) => {
      const rowItem: Record<string, any> = { [xAxisKey]: key };
      yAxisKeys.forEach(yKey => {
        const met = metrics[yKey];
        if (!met || met.count === 0) {
          rowItem[yKey] = 0;
          return;
        }

        switch (aggregation) {
          case 'mean':
            rowItem[yKey] = parseFloat((met.sum / met.count).toFixed(2));
            break;
          case 'count':
            rowItem[yKey] = met.count;
            break;
          case 'min':
            rowItem[yKey] = met.min;
            break;
          case 'max':
            rowItem[yKey] = met.max;
            break;
          case 'sum':
          default:
            rowItem[yKey] = parseFloat(met.sum.toFixed(2));
            break;
        }
      });
      result.push(rowItem);
    });

    // If it's a numeric X-axis, sort it chronologically/sequentially
    const isXNumeric = result.every(item => {
      const parsed = parseFloat(item[xAxisKey]);
      return !isNaN(parsed) && String(parsed) === String(item[xAxisKey]);
    });

    if (isXNumeric) {
      result.sort((a, b) => parseFloat(a[xAxisKey]) - parseFloat(b[xAxisKey]));
    }

    // Limit to top 25 records to keep the chart clean
    if (result.length > 25 && type !== 'scatter') {
      return result.slice(0, 25);
    }

    return result;
  }, [rows, xAxisKey, yAxisKeys, type, aggregation]);

  // Format tick labels
  const formatYAxis = (tick: any) => {
    if (typeof tick === 'number') {
      if (tick >= 1_000_000) return `${(tick / 1_000_000).toFixed(1)}M`;
      if (tick >= 1_000) return `${(tick / 1_000).toFixed(1)}K`;
      return String(tick);
    }
    return String(tick);
  };

  const renderChart = () => {
    if (chartData.length === 0) {
      return (
        <div id="chart-no-data" className="h-64 flex items-center justify-center text-sm font-mono text-gray-500 bg-gray-50 rounded-lg">
          No data available for rendering variables: {xAxisKey} vs {yAxisKeys.join(', ')}
        </div>
      );
    }

    switch (type) {
      case 'bar':
        return (
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey={xAxisKey} tick={{ fill: '#6b7280', fontSize: 11 }} />
            <YAxis tickFormatter={formatYAxis} tick={{ fill: '#6b7280', fontSize: 11 }} />
            <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '6px' }} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            {yAxisKeys.map((yKey, idx) => (
              <Bar
                key={yKey}
                dataKey={yKey}
                fill={PALETTE[idx % PALETTE.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        );

      case 'line':
        return (
          <LineChart data={chartData} margin={{ top: 15, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey={xAxisKey} tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis tickFormatter={formatYAxis} tick={{ fill: '#64748b', fontSize: 11 }} />
            <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px -2px rgba(0,0,0,0.05)' }} />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
            {yAxisKeys.map((yKey, idx) => (
              <Line
                key={yKey}
                type="monotone"
                dataKey={yKey}
                stroke={PALETTE[idx % PALETTE.length]}
                strokeWidth={3}
                dot={{ stroke: PALETTE[idx % PALETTE.length], strokeWidth: 2, r: 4, fill: '#ffffff' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey={xAxisKey} tick={{ fill: '#6b7280', fontSize: 11 }} />
            <YAxis tickFormatter={formatYAxis} tick={{ fill: '#6b7280', fontSize: 11 }} />
            <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '6px' }} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            {yAxisKeys.map((yKey, idx) => (
              <Area
                key={yKey}
                type="monotone"
                dataKey={yKey}
                stroke={PALETTE[idx % PALETTE.length]}
                fill={PALETTE[idx % PALETTE.length]}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        );

      case 'pie':
        const pieKey = yAxisKeys[0];
        return (
          <PieChart>
            <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '6px' }} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Pie
              data={chartData}
              dataKey={pieKey}
              nameKey={xAxisKey}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#2563eb"
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              labelLine={false}
            >
              {chartData.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
              ))}
            </Pie>
          </PieChart>
        );

      case 'scatter':
        return (
          <ScatterChart margin={{ top: 15, right: 15, left: 0, bottom: 15 }}>
            <CartesianGrid stroke="#f3f4f6" />
            <XAxis
              type="category"
              dataKey={xAxisKey}
              name={xAxisKey}
              tick={{ fill: '#6b7280', fontSize: 11 }}
            />
            <YAxis
              type="number"
              tickFormatter={formatYAxis}
              tick={{ fill: '#6b7280', fontSize: 11 }}
            />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            {yAxisKeys.map((yKey, idx) => (
              <Scatter
                key={yKey}
                name={yKey}
                dataKey={yKey}
                data={chartData}
                fill={PALETTE[idx % PALETTE.length]}
              />
            ))}
          </ScatterChart>
        );

      case 'radar':
        return (
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis dataKey={xAxisKey} tick={{ fill: '#6b7280', fontSize: 10 }} />
            <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 9 }} />
            {yAxisKeys.map((yKey, idx) => (
              <Radar
                key={yKey}
                name={yKey}
                dataKey={yKey}
                stroke={PALETTE[idx % PALETTE.length]}
                fill={PALETTE[idx % PALETTE.length]}
                fillOpacity={0.3}
              />
            ))}
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
          </RadarChart>
        );

      default:
        return null;
    }
  };

  return (
    <div id={`chart-card-${recommendation.id}`} className="bg-white border border-slate-100 hover:border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05),0_10px_20px_-10px_rgba(0,0,0,0.03)] flex flex-col min-h-[380px] transition-all duration-250 hover:shadow-md hover:scale-[1.005]">
      <div className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-sans font-bold text-slate-900 text-sm tracking-tight leading-snug">{title}</h3>
            <p className="text-[11px] text-slate-400 mt-1 font-sans leading-relaxed">{description}</p>
          </div>
          
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {onPin && (
              <button
                onClick={() => onPin(recommendation)}
                className={`p-1.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                  isPinned
                    ? 'bg-amber-500 border-amber-500 text-white shadow-xs hover:bg-amber-600'
                    : 'bg-slate-50 border-slate-200/60 text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
                title={isPinned ? "Pinned to Dashboard" : "Pin to Dashboard"}
              >
                <Pin className="w-3.5 h-3.5" />
              </button>
            )}

            <span className="text-[9px] font-mono uppercase bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg font-extrabold border border-indigo-100/50">
              {aggregation !== 'sum' ? `${aggregation} of ` : ''}{type}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[220px] h-[220px] py-1 relative">
        <ResponsiveContainer width="100%" height={220} minWidth={0}>
          {renderChart()}
        </ResponsiveContainer>
      </div>

      {summary && (
        <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50/45 p-3 rounded-xl text-xs font-sans text-slate-600 flex items-start gap-2.5">
          <span className="font-mono text-[9px] font-bold text-teal-700 mt-0.5 shrink-0 whitespace-nowrap bg-teal-50 border border-teal-100/60 px-2 py-0.5 rounded-md uppercase">
            Insight
          </span>
          <span className="leading-relaxed font-sans font-medium text-slate-500">{summary}</span>
        </div>
      )}
    </div>
  );
};
