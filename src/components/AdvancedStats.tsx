import React, { useState, useMemo } from 'react';
import { Dataset, PinnedItem, VisualRecommendation } from '../types';
import {
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { TrendingUp, AlertTriangle, Activity, Pin, HelpCircle, Check, Play, ChevronRight, Sparkles } from 'lucide-react';

interface AdvancedStatsProps {
  dataset: Dataset;
  onPinItem: (item: PinnedItem) => void;
  pinnedIds: string[];
}

export const AdvancedStats: React.FC<AdvancedStatsProps> = ({ dataset, onPinItem, pinnedIds }) => {
  const { columns, rows } = dataset;

  // Active analytical tab selection
  const [statTab, setStatTab] = useState<'regression' | 'forecasting' | 'anomaly'>('regression');

  // --- Regression State ---
  const numericColumns = useMemo(() => columns.filter(c => c.type === 'numeric'), [columns]);
  const [regX, setRegX] = useState(numericColumns[0]?.name || '');
  const [regY, setRegY] = useState(numericColumns[1]?.name || numericColumns[0]?.name || '');

  // --- Forecasting State ---
  // Prefer chronological columns (date or string date representations) if they exist
  const dateAndNumColumns = useMemo(() => columns.filter(c => c.type === 'date' || c.type === 'string' || c.type === 'numeric'), [columns]);
  const [forecastX, setForecastX] = useState(dateAndNumColumns[0]?.name || '');
  const [forecastY, setForecastY] = useState(numericColumns[0]?.name || '');
  const [forecastPeriods, setForecastPeriods] = useState(3); // Number of periods to predict
  const [forecastMethod, setForecastMethod] = useState<'sma' | 'linear'>('linear');

  // --- Anomaly State ---
  const [anomalyCol, setAnomalyCol] = useState(numericColumns[0]?.name || '');
  const [zThreshold, setZThreshold] = useState(2.0); // Z-score threshold

  // -------------------------------------------------------------
  // REGRESSION MATHEMATICS
  // -------------------------------------------------------------
  const regressionResults = useMemo(() => {
    if (!regX || !regY || rows.length < 2) return null;

    const xVals: number[] = [];
    const yVals: number[] = [];

    rows.forEach(row => {
      const x = parseFloat(row[regX]);
      const y = parseFloat(row[regY]);
      if (!isNaN(x) && !isNaN(y)) {
        xVals.push(x);
        yVals.push(y);
      }
    });

    const N = xVals.length;
    if (N < 2) return null;

    // Mean values
    const meanX = xVals.reduce((a, b) => a + b, 0) / N;
    const meanY = yVals.reduce((a, b) => a + b, 0) / N;

    // Covariance & Variance
    let num = 0;
    let den = 0;
    for (let i = 0; i < N; i++) {
      num += (xVals[i] - meanX) * (yVals[i] - meanY);
      den += Math.pow(xVals[i] - meanX, 2);
    }

    const slope = den === 0 ? 0 : num / den;
    const intercept = meanY - slope * meanX;

    // R-Squared calculation
    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < N; i++) {
      const prediction = slope * xVals[i] + intercept;
      ssRes += Math.pow(yVals[i] - prediction, 2);
      ssTot += Math.pow(yVals[i] - meanY, 2);
    }

    const rSquared = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);

    // Pearson Correlation Coefficient
    const correlation = Math.sign(slope) * Math.sqrt(rSquared);

    // Generate scatter plot data including trendline values
    const minX = Math.min(...xVals);
    const maxX = Math.max(...xVals);

    const scatterPoints = rows.map((row, idx) => {
      const x = parseFloat(row[regX]);
      const y = parseFloat(row[regY]);
      if (isNaN(x) || isNaN(y)) return null;
      return {
        id: idx,
        xVal: x,
        yVal: y,
        trendVal: parseFloat((slope * x + intercept).toFixed(2))
      };
    }).filter(Boolean) as { xVal: number; yVal: number; trendVal: number }[];

    return {
      slope: parseFloat(slope.toFixed(4)),
      intercept: parseFloat(intercept.toFixed(4)),
      rSquared: parseFloat(rSquared.toFixed(4)),
      correlation: parseFloat(correlation.toFixed(4)),
      nSize: N,
      points: scatterPoints,
      minX,
      maxX
    };
  }, [regX, regY, rows]);

  // -------------------------------------------------------------
  // FORECASTING MATHEMATICS (Linear Regression & Simple Moving Average)
  // -------------------------------------------------------------
  const forecastResults = useMemo(() => {
    if (!forecastX || !forecastY || rows.length < 3) return null;

    // Extrapolate series chronologically
    const cleanSeries = rows.map((row, index) => {
      const xLabel = String(row[forecastX] || `Period ${index + 1}`);
      const yValue = parseFloat(row[forecastY]);
      return { index, xLabel, yValue };
    }).filter(item => !isNaN(item.yValue));

    const N = cleanSeries.length;
    if (N < 3) return null;

    const actualData = cleanSeries.map(item => ({
      label: item.xLabel,
      actual: item.yValue,
      forecast: null as number | null
    }));

    const projectedData: { label: string; actual: number | null; forecast: number }[] = [];

    if (forecastMethod === 'linear') {
      // Linear extrapolation forecast
      const xVals = cleanSeries.map(item => item.index);
      const yVals = cleanSeries.map(item => item.yValue);

      const meanX = xVals.reduce((a, b) => a + b, 0) / N;
      const meanY = yVals.reduce((a, b) => a + b, 0) / N;

      let num = 0;
      let den = 0;
      for (let i = 0; i < N; i++) {
        num += (xVals[i] - meanX) * (yVals[i] - meanY);
        den += Math.pow(xVals[i] - meanX, 2);
      }

      const slope = den === 0 ? 0 : num / den;
      const intercept = meanY - slope * meanX;

      // Fill in backcast fits
      actualData.forEach((item, idx) => {
        item.forecast = parseFloat((slope * idx + intercept).toFixed(2));
      });

      // Extrapolate future projections
      for (let p = 1; p <= forecastPeriods; p++) {
        const nextIdx = N + p - 1;
        projectedData.push({
          label: `Forecast +${p}`,
          actual: null,
          forecast: parseFloat((slope * nextIdx + intercept).toFixed(2))
        });
      }
    } else {
      // Simple Moving Average forecasting (window size 3)
      const windowSize = 3;
      
      // Calculate historical rolling SMA fit
      actualData.forEach((item, idx) => {
        if (idx < windowSize) {
          item.forecast = item.actual;
        } else {
          const slice = actualData.slice(idx - windowSize, idx);
          const sum = slice.reduce((acc, curr) => acc + (curr.actual || 0), 0);
          item.forecast = parseFloat((sum / windowSize).toFixed(2));
        }
      });

      // Project future periods iteratively using the latest moving average
      const historyBuffer = [...cleanSeries.map(item => item.yValue)];
      for (let p = 1; p <= forecastPeriods; p++) {
        const slice = historyBuffer.slice(-windowSize);
        const forecastVal = slice.reduce((a, b) => a + b, 0) / slice.length;
        historyBuffer.push(forecastVal);
        projectedData.push({
          label: `Forecast +${p}`,
          actual: null,
          forecast: parseFloat(forecastVal.toFixed(2))
        });
      }
    }

    return {
      combinedSeries: [...actualData, ...projectedData],
      methodName: forecastMethod === 'linear' ? 'Linear Trend Regression' : 'Simple Rolling Moving Average (3P)'
    };
  }, [forecastX, forecastY, forecastPeriods, forecastMethod, rows]);

  // -------------------------------------------------------------
  // ANOMALY DETECTION MATHEMATICS (Z-Score)
  // -------------------------------------------------------------
  const anomalyResults = useMemo(() => {
    if (!anomalyCol || rows.length === 0) return null;

    const values = rows.map(row => parseFloat(row[anomalyCol])).filter(v => !isNaN(v));
    const N = values.length;
    if (N < 2) return null;

    // Mean
    const mean = values.reduce((a, b) => a + b, 0) / N;

    // Variance & Standard Deviation
    const sqDiffSum = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
    const stdDev = Math.sqrt(sqDiffSum / N);

    if (stdDev === 0) {
      return { mean, stdDev, anomalies: [] };
    }

    // Flag rows exceeding standard deviations threshold
    const detectedAnomalies: { rowIndex: number; val: number; zScore: number; desc: string; originalRow: Record<string, any> }[] = [];

    rows.forEach((row, index) => {
      const val = parseFloat(row[anomalyCol]);
      if (isNaN(val)) return;

      const zScore = (val - mean) / stdDev;
      if (Math.abs(zScore) >= zThreshold) {
        detectedAnomalies.push({
          rowIndex: index + 1,
          val: parseFloat(val.toFixed(2)),
          zScore: parseFloat(zScore.toFixed(2)),
          desc: zScore > 0 ? `${zScore.toFixed(1)}σ Above Mean` : `${Math.abs(zScore).toFixed(1)}σ Below Mean`,
          originalRow: row
        });
      }
    });

    return {
      mean: parseFloat(mean.toFixed(2)),
      stdDev: parseFloat(stdDev.toFixed(2)),
      anomalies: detectedAnomalies
    };
  }, [anomalyCol, zThreshold, rows]);

  // -------------------------------------------------------------
  // PINNING DIRECTIVES
  // -------------------------------------------------------------
  const handlePinRegression = () => {
    if (!regressionResults) return;
    const pinId = `reg_${regX}_vs_${regY}`;
    
    onPinItem({
      id: pinId,
      type: 'stat',
      statConfig: {
        type: 'regression',
        title: `Regression Analysis: ${regY} vs ${regX}`,
        description: `Mathematical relationship between independent variable ${regX} and dependent variable ${regY}.`,
        xAxisKey: regX,
        yAxisKeys: [regY],
        summaryMetrics: [
          { label: 'Pearson correlation (r)', value: regressionResults.correlation },
          { label: 'Coefficient of Determination (R²)', value: regressionResults.rSquared },
          { label: 'Trend Slope (m)', value: regressionResults.slope },
          { label: 'Intercept (c)', value: regressionResults.intercept }
        ]
      },
      pinnedAt: new Date().toLocaleDateString()
    });
  };

  const handlePinForecast = () => {
    if (!forecastResults) return;
    const pinId = `fc_${forecastX}_${forecastY}`;
    
    onPinItem({
      id: pinId,
      type: 'stat',
      statConfig: {
        type: 'forecast',
        title: `Time Series Forecast: ${forecastY} by ${forecastX}`,
        description: `Predictive modeling showing ${forecastPeriods} forecasted periods calculated using ${forecastResults.methodName}.`,
        xAxisKey: forecastX,
        yAxisKeys: [forecastY],
        summaryMetrics: [
          { label: 'Modeling Strategy', value: forecastResults.methodName },
          { label: 'Plotted historical span', value: `${rows.length} steps` },
          { label: 'Extrapolated forecast periods', value: `${forecastPeriods} steps` }
        ]
      },
      pinnedAt: new Date().toLocaleDateString()
    });
  };

  const handlePinAnomalies = () => {
    if (!anomalyResults) return;
    const pinId = `anom_${anomalyCol}_z_${zThreshold}`;
    
    onPinItem({
      id: pinId,
      type: 'stat',
      statConfig: {
        type: 'anomaly',
        title: `Anomalies Report: ${anomalyCol}`,
        description: `Extreme outliers in ${anomalyCol} exceeding ${zThreshold} standard deviations of metric distribution.`,
        xAxisKey: 'Anomaly Count',
        yAxisKeys: [anomalyCol],
        summaryMetrics: [
          { label: 'Statistical Mean', value: anomalyResults.mean },
          { label: 'Standard Deviation (σ)', value: anomalyResults.stdDev },
          { label: 'Outliers Detected Count', value: anomalyResults.anomalies.length },
          { label: 'Z-Score Sensitivity', value: `${zThreshold}σ` }
        ]
      },
      pinnedAt: new Date().toLocaleDateString()
    });
  };

  return (
    <div className="space-y-8">
      {/* Tab Switcher */}
      <div className="bg-slate-50 border border-slate-100 p-1.5 flex gap-1.5 rounded-2xl max-w-3xl mx-auto shadow-2xs">
        <button
          onClick={() => setStatTab('regression')}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl text-xs font-sans font-bold transition-all duration-150 cursor-pointer ${
            statTab === 'regression'
              ? 'bg-white text-indigo-600 shadow-xs border border-slate-100/50'
              : 'text-slate-500 hover:text-slate-850 hover:bg-white/45'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Linear Regression</span>
        </button>

        <button
          onClick={() => setStatTab('forecasting')}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl text-xs font-sans font-bold transition-all duration-150 cursor-pointer ${
            statTab === 'forecasting'
              ? 'bg-white text-indigo-600 shadow-xs border border-slate-100/50'
              : 'text-slate-500 hover:text-slate-850 hover:bg-white/45'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Time Series Forecasting</span>
        </button>

        <button
          onClick={() => setStatTab('anomaly')}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl text-xs font-sans font-bold transition-all duration-150 cursor-pointer ${
            statTab === 'anomaly'
              ? 'bg-white text-indigo-600 shadow-xs border border-slate-100/50'
              : 'text-slate-500 hover:text-slate-850 hover:bg-white/45'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Anomaly Detection</span>
        </button>
      </div>

      {/* Workspace Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Controls Panel */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6 h-fit">
          <div className="pb-3.5 border-b border-slate-100">
            <h3 className="font-sans font-bold text-slate-800 text-sm tracking-tight capitalize">
              {statTab} Parameters
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 font-sans">
              Refine parameters below to compute real-time statistical functions.
            </p>
          </div>

          {/* 1. REGRESSION CONTROLS */}
          {statTab === 'regression' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-extrabold block">
                  Independent variable (X)
                </label>
                <select
                  value={regX}
                  onChange={(e) => setRegX(e.target.value)}
                  className="w-full text-xs font-mono px-4 py-2.5 border border-slate-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 rounded-xl bg-slate-50/50 text-slate-700 outline-none cursor-pointer"
                >
                  {numericColumns.map(col => (
                    <option key={col.name} value={col.name}>{col.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-extrabold block">
                  Dependent variable (Y)
                </label>
                <select
                  value={regY}
                  onChange={(e) => setRegY(e.target.value)}
                  className="w-full text-xs font-mono px-4 py-2.5 border border-slate-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 rounded-xl bg-slate-50/50 text-slate-700 outline-none cursor-pointer"
                >
                  {numericColumns.map(col => (
                    <option key={col.name} value={col.name}>{col.name}</option>
                  ))}
                </select>
              </div>

              <div className="bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100/50 text-xs font-sans text-indigo-900 leading-relaxed font-medium">
                <strong>Methodology:</strong> Linear regression estimates the relationship between X and Y by fitting a straight trend line equation: <code className="font-mono bg-white/80 border border-indigo-100/40 px-1.5 py-0.5 rounded text-indigo-700">Y = mX + c</code>, calculating slope and R-squared fit.
              </div>

              <button
                onClick={handlePinRegression}
                disabled={pinnedIds.includes(`reg_${regX}_vs_${regY}`)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl text-xs font-sans font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/10 disabled:shadow-none"
              >
                <Pin className="w-3.5 h-3.5" />
                <span>{pinnedIds.includes(`reg_${regX}_vs_${regY}`) ? 'Pinned to Dashboard' : 'Pin Regression Stats'}</span>
              </button>
            </div>
          )}

          {/* 2. FORECASTING CONTROLS */}
          {statTab === 'forecasting' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-extrabold block">
                  Chronological Column (X)
                </label>
                <select
                  value={forecastX}
                  onChange={(e) => setForecastX(e.target.value)}
                  className="w-full text-xs font-mono px-4 py-2.5 border border-slate-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 rounded-xl bg-slate-50/50 text-slate-700 outline-none cursor-pointer"
                >
                  {dateAndNumColumns.map(col => (
                    <option key={col.name} value={col.name}>{col.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-extrabold block">
                  Measure Variable (Y)
                </label>
                <select
                  value={forecastY}
                  onChange={(e) => setForecastY(e.target.value)}
                  className="w-full text-xs font-mono px-4 py-2.5 border border-slate-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 rounded-xl bg-slate-50/50 text-slate-700 outline-none cursor-pointer"
                >
                  {numericColumns.map(col => (
                    <option key={col.name} value={col.name}>{col.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-extrabold block">
                  Forecasting Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setForecastMethod('linear')}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold text-center cursor-pointer transition-all duration-150 ${
                      forecastMethod === 'linear'
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Linear Fit
                  </button>
                  <button
                    onClick={() => setForecastMethod('sma')}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold text-center cursor-pointer transition-all duration-150 ${
                      forecastMethod === 'sma'
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Moving Avg
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-extrabold block">
                  Future Prediction Steps (+{forecastPeriods} steps)
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={forecastPeriods}
                  onChange={(e) => setForecastPeriods(Number(e.target.value))}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-mono font-bold">
                  <span>1 period</span>
                  <span>5 periods</span>
                  <span>10 periods</span>
                </div>
              </div>

              <button
                onClick={handlePinForecast}
                disabled={pinnedIds.includes(`fc_${forecastX}_${forecastY}`)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl text-xs font-sans font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/10 disabled:shadow-none"
              >
                <Pin className="w-3.5 h-3.5" />
                <span>{pinnedIds.includes(`fc_${forecastX}_${forecastY}`) ? 'Pinned to Dashboard' : 'Pin Forecast Chart'}</span>
              </button>
            </div>
          )}

          {/* 3. ANOMALY CONTROLS */}
          {statTab === 'anomaly' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-extrabold block">
                  Scan Metric Variable
                </label>
                <select
                  value={anomalyCol}
                  onChange={(e) => setAnomalyCol(e.target.value)}
                  className="w-full text-xs font-mono px-4 py-2.5 border border-slate-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 rounded-xl bg-slate-50/50 text-slate-700 outline-none cursor-pointer"
                >
                  {numericColumns.map(col => (
                    <option key={col.name} value={col.name}>{col.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-extrabold block">
                  Z-Score Sensitivity ({zThreshold}σ)
                </label>
                <input
                  type="range"
                  min="1.0"
                  max="3.0"
                  step="0.5"
                  value={zThreshold}
                  onChange={(e) => setZThreshold(parseFloat(e.target.value))}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-mono font-bold">
                  <span>1.0σ (Sensitive)</span>
                  <span>2.0σ (Standard)</span>
                  <span>3.0σ (Conservative)</span>
                </div>
              </div>

              <div className="bg-amber-50 text-amber-900 border border-amber-100/70 p-4 rounded-2xl text-[11px] font-sans leading-relaxed font-medium flex gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>Values lying beyond {zThreshold} standard deviations away from the mathematical mean of {anomalyCol} will be flagged as anomalies.</span>
              </div>

              <button
                onClick={handlePinAnomalies}
                disabled={pinnedIds.includes(`anom_${anomalyCol}_z_${zThreshold}`)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl text-xs font-sans font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/10 disabled:shadow-none"
              >
                <Pin className="w-3.5 h-3.5" />
                <span>{pinnedIds.includes(`anom_${anomalyCol}_z_${zThreshold}`) ? 'Pinned to Dashboard' : 'Pin Anomaly Report'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Display Workspace Results */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 1. REGRESSION OUTPUT */}
          {statTab === 'regression' && regressionResults && (
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="font-sans font-bold text-slate-800 text-sm tracking-tight">
                  Independent Variable Relationship Map
                </h3>
                <span className="text-[10px] font-mono bg-indigo-50 border border-indigo-100 text-indigo-600 px-3 py-1 rounded-full font-bold">
                  {regressionResults.nSize} data steps processed
                </span>
              </div>

              {/* R Recharts Plot */}
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="xVal" name={regX} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis type="number" dataKey="yVal" name={regY} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ fontSize: '11px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                    <Scatter name="Raw data row" data={regressionResults.points} fill="#4f46e5" />
                    <Scatter name="Least-Squares Regression Trend" data={regressionResults.points} fill="#0d9488" line shape="circle" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              {/* Stats blocks */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3">
                <div className="bg-slate-50 border border-slate-100/60 p-4 rounded-2xl text-center shadow-2xs">
                  <div className="text-[9px] font-mono text-slate-400 uppercase font-bold tracking-wider">Pearson (r)</div>
                  <div className={`text-base font-extrabold mt-1 font-mono ${regressionResults.correlation > 0 ? 'text-teal-600' : 'text-amber-600'}`}>
                    {regressionResults.correlation}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100/60 p-4 rounded-2xl text-center shadow-2xs">
                  <div className="text-[9px] font-mono text-slate-400 uppercase font-bold tracking-wider">R-Squared (R²)</div>
                  <div className="text-base font-extrabold mt-1 font-mono text-slate-800">
                    {regressionResults.rSquared}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100/60 p-4 rounded-2xl text-center shadow-2xs">
                  <div className="text-[9px] font-mono text-slate-400 uppercase font-bold tracking-wider">Slope (m)</div>
                  <div className="text-base font-extrabold mt-1 font-mono text-slate-800">
                    {regressionResults.slope}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100/60 p-4 rounded-2xl text-center shadow-2xs">
                  <div className="text-[9px] font-mono text-slate-400 uppercase font-bold tracking-wider">Intercept (c)</div>
                  <div className="text-base font-extrabold mt-1 font-mono text-slate-800">
                    {regressionResults.intercept}
                  </div>
                </div>
              </div>

              {/* Text interpretation */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 border border-slate-800 p-5 rounded-2xl text-white relative overflow-hidden shadow-sm">
                <div className="absolute right-0 bottom-0 w-36 h-36 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <h4 className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Statistical Model Interpretation</span>
                </h4>
                <p className="text-xs leading-relaxed font-sans text-slate-200">
                  {regressionResults.rSquared > 0.6 ? (
                    <span>
                      There is a <strong className="text-white font-bold">strong correlation</strong> ({regressionResults.correlation}) explaining {(regressionResults.rSquared * 100).toFixed(1)}% of variance. The fitted trendline equation is <code className="font-mono text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/25">Y = {regressionResults.slope}X + {regressionResults.intercept}</code>. Every incremental unit of {regX} is estimated to trigger a shift of {regressionResults.slope} in {regY}.
                    </span>
                  ) : regressionResults.rSquared > 0.2 ? (
                    <span>
                      There is a <strong className="text-white font-bold">moderate association</strong> ({regressionResults.correlation}) explaining {(regressionResults.rSquared * 100).toFixed(1)}% of variance. While a positive/negative trend exists, other auxiliary factors in the dataset likely influence {regY}.
                    </span>
                  ) : (
                    <span>
                      There is <strong className="text-white font-bold">weak or negligible correlation</strong> ({regressionResults.correlation}) between {regX} and {regY}. A linear equation cannot accurately fit or explain variations here.
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* 2. FORECASTING OUTPUT */}
          {statTab === 'forecasting' && forecastResults && (
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="font-sans font-bold text-slate-800 text-sm tracking-tight">
                  Time Series Projection Workspace
                </h3>
                <span className="text-[10px] font-mono bg-indigo-50 border border-indigo-100 text-indigo-600 px-3 py-1 rounded-full font-bold">
                  {forecastResults.methodName}
                </span>
              </div>

              {/* Chart */}
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={forecastResults.combinedSeries} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                    <Line type="monotone" name="Historical actuals" dataKey="actual" stroke="#4f46e5" strokeWidth={2.5} connectNulls />
                    <Line type="monotone" name="Forecast Model fit" dataKey="forecast" stroke="#ea580c" strokeDasharray="4 4" strokeWidth={2.5} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Summary explanations */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 border border-slate-800 p-5 rounded-2xl text-white relative overflow-hidden shadow-sm">
                <div className="absolute right-0 bottom-0 w-36 h-36 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <h4 className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Forecasting Insight</span>
                </h4>
                <p className="text-xs leading-relaxed font-sans text-slate-200">
                  Using <strong className="text-white font-bold">{forecastResults.methodName}</strong>, the system analyzed past records and projected {forecastPeriods} intervals ahead. This allows teams to identify seasonless, standard growth curves, calculate future budgets, or forecast targets with mathematical assurance.
                </p>
              </div>
            </div>
          )}

          {/* 3. ANOMALY OUTPUT */}
          {statTab === 'anomaly' && anomalyResults && (
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="font-sans font-bold text-slate-800 text-sm tracking-tight">
                  Dynamic Outlier Diagnostics
                </h3>
                <span className="text-[10px] font-mono bg-amber-50 border border-amber-100 text-amber-700 px-3 py-1 rounded-full font-bold">
                  Mean: {anomalyResults.mean} • StdDev: {anomalyResults.stdDev}
                </span>
              </div>

              {anomalyResults.anomalies.length === 0 ? (
                <div id="no-anomalies-state" className="p-10 text-center bg-slate-50/50 rounded-2xl border border-slate-100 max-w-md mx-auto shadow-2xs">
                  <div className="p-3 bg-white text-emerald-500 rounded-2xl border border-slate-100 w-fit mx-auto mb-4 shadow-2xs">
                    <Check className="w-5 h-5" />
                  </div>
                  <h4 className="font-sans font-bold text-slate-800 text-sm tracking-tight">
                    Clean Dataset Scope!
                  </h4>
                  <p className="text-xs text-slate-400 mt-1.5 font-sans leading-relaxed">
                    No points exceeded the {zThreshold}σ standard deviations. All record entries for {anomalyCol} reside safely within calculated bounds.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                    <table className="w-full min-w-max text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-700">
                          <th className="px-5 py-3 font-sans">Row Index</th>
                          <th className="px-5 py-3 font-sans">Outlier Value</th>
                          <th className="px-5 py-3 font-sans">Z-Score Deviation</th>
                          <th className="px-5 py-3 font-sans">Threshold Severity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {anomalyResults.anomalies.map((anom, idx) => (
                          <tr key={idx} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/30 text-xs font-mono text-slate-600 transition-colors">
                            <td className="px-5 py-3 font-medium text-slate-400">Row #{anom.rowIndex}</td>
                            <td className="px-5 py-3 font-extrabold text-slate-800">{anom.val}</td>
                            <td className="px-5 py-3 text-rose-600 font-extrabold">{anom.zScore}</td>
                            <td className="px-5 py-3">
                              <span className="px-2.5 py-1 bg-rose-50 border border-rose-100/50 text-rose-700 rounded-lg text-[9px] font-extrabold uppercase">
                                {anom.desc}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 border border-slate-800 p-5 rounded-2xl text-white relative overflow-hidden shadow-sm">
                    <div className="absolute right-0 bottom-0 w-36 h-36 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                    <h4 className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Anomaly Interpretation</span>
                    </h4>
                    <p className="text-xs leading-relaxed font-sans text-slate-200">
                      Detected {anomalyResults.anomalies.length} outliers in the {anomalyCol} column. Standard anomalies are often driven by seasonal events, data entry mistakes, major marketing spikes, or systemic anomalies that require investigation.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
