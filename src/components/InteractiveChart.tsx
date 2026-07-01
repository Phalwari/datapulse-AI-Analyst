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
  '#2563eb', // blue-600
  '#059669', // emerald-600
  '#d97706', // amber-600
  '#dc2626', // rose-600
  '#7c3aed', // violet-600
  '#0891b2', // cyan-600
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
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey={xAxisKey} tick={{ fill: '#6b7280', fontSize: 11 }} />
            <YAxis tickFormatter={formatYAxis} tick={{ fill: '#6b7280', fontSize: 11 }} />
            <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '6px' }} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            {yAxisKeys.map((yKey, idx) => (
              <Line
                key={yKey}
                type="monotone"
                dataKey={yKey}
                stroke={PALETTE[idx % PALETTE.length]}
                strokeWidth={2.5}
                activeDot={{ r: 6 }}
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
    <div id={`chart-card-${recommendation.id}`} className="bg-white border border-gray-150 rounded-xl p-5 shadow-xs flex flex-col h-full hover:border-gray-300 transition duration-150">
      <div className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-sans font-semibold text-gray-950 text-sm tracking-tight leading-tight">{title}</h3>
            <p className="text-xs text-gray-400 mt-1">{description}</p>
          </div>
          
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {onPin && (
              <button
                onClick={() => onPin(recommendation)}
                className={`p-1.5 rounded-lg border transition duration-150 cursor-pointer ${
                  isPinned
                    ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100'
                    : 'bg-gray-50 border-gray-150 text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
                title={isPinned ? "Pinned to Dashboard" : "Pin to Dashboard"}
              >
                <Pin className="w-3.5 h-3.5 fill-current" />
              </button>
            )}

            <span className="text-[9px] font-mono uppercase bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">
              {aggregation !== 'sum' ? `${aggregation} of ` : ''}{type}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[220px] h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>

      {summary && (
        <div className="mt-3 pt-3 border-t border-gray-100 bg-gray-50/50 p-2.5 rounded-lg text-xs font-sans text-gray-600 flex items-start gap-2">
          <span className="font-mono text-[9px] font-bold text-emerald-600 mt-0.5 whitespace-nowrap bg-emerald-50 px-1.5 py-0.5 rounded">
            TAKEAWAY
          </span>
          <span className="leading-relaxed">{summary}</span>
        </div>
      )}
    </div>
  );
};
