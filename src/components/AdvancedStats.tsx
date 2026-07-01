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
import { TrendingUp, AlertTriangle, Activity, Pin, HelpCircle, Check, Play, ChevronRight } from 'lucide-react';

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
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="bg-white border border-gray-100 rounded-xl p-2 flex gap-2">
        <button
          onClick={() => setStatTab('regression')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-sans font-medium transition cursor-pointer ${
            statTab === 'regression'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Linear Regression</span>
        </button>

        <button
          onClick={() => setStatTab('forecasting')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-sans font-medium transition cursor-pointer ${
            statTab === 'forecasting'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Time Series Forecasting</span>
        </button>

        <button
          onClick={() => setStatTab('anomaly')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-sans font-medium transition cursor-pointer ${
            statTab === 'anomaly'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Anomaly Detection</span>
        </button>
      </div>

      {/* Workspace Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Panel */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-xs space-y-5 h-fit">
          <div className="pb-2 border-b border-gray-50">
            <h3 className="font-sans font-medium text-gray-900 text-sm tracking-tight capitalize">
              {statTab} Configuration
            </h3>
            <p className="text-[11px] text-gray-400 mt-1">
              Refine parameters below to compute real-time statistical functions.
            </p>
          </div>

          {/* 1. REGRESSION CONTROLS */}
          {statTab === 'regression' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-bold block">
                  Independent variable (X)
                </label>
                <select
                  value={regX}
                  onChange={(e) => setRegX(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 rounded-lg bg-white"
                >
                  {numericColumns.map(col => (
                    <option key={col.name} value={col.name}>{col.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-bold block">
                  Dependent variable (Y)
                </label>
                <select
                  value={regY}
                  onChange={(e) => setRegY(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 rounded-lg bg-white"
                >
                  {numericColumns.map(col => (
                    <option key={col.name} value={col.name}>{col.name}</option>
                  ))}
                </select>
              </div>

              <div className="bg-blue-50/40 p-3 rounded-lg border border-blue-150/40 text-[11px] font-sans text-blue-800 leading-relaxed">
                <strong>Methodology:</strong> Linear regression estimates the relationship between X and Y by fitting a straight trend line equation: <code className="font-mono bg-blue-100/60 px-1 rounded">Y = mX + c</code>, calculating slope and R-squared fit.
              </div>

              <button
                onClick={handlePinRegression}
                disabled={pinnedIds.includes(`reg_${regX}_vs_${regY}`)}
                className="w-full py-2 bg-slate-900 hover:bg-slate-950 disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-lg text-xs font-sans font-medium transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Pin className="w-3.5 h-3.5" />
                <span>{pinnedIds.includes(`reg_${regX}_vs_${regY}`) ? 'Pinned to Dashboard' : 'Pin Regression Stats'}</span>
              </button>
            </div>
          )}

          {/* 2. FORECASTING CONTROLS */}
          {statTab === 'forecasting' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-bold block">
                  Chronological Column (X)
                </label>
                <select
                  value={forecastX}
                  onChange={(e) => setForecastX(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 rounded-lg bg-white"
                >
                  {dateAndNumColumns.map(col => (
                    <option key={col.name} value={col.name}>{col.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-bold block">
                  Measure Variable (Y)
                </label>
                <select
                  value={forecastY}
                  onChange={(e) => setForecastY(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 rounded-lg bg-white"
                >
                  {numericColumns.map(col => (
                    <option key={col.name} value={col.name}>{col.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-bold block">
                  Forecasting Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setForecastMethod('linear')}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-medium text-center cursor-pointer ${
                      forecastMethod === 'linear'
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Linear Extrapolation
                  </button>
                  <button
                    onClick={() => setForecastMethod('sma')}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-medium text-center cursor-pointer ${
                      forecastMethod === 'sma'
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Moving Average
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-bold block">
                  Future Prediction Steps (+{forecastPeriods} steps)
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={forecastPeriods}
                  onChange={(e) => setForecastPeriods(Number(e.target.value))}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                  <span>1 step</span>
                  <span>5 steps</span>
                  <span>10 steps</span>
                </div>
              </div>

              <button
                onClick={handlePinForecast}
                disabled={pinnedIds.includes(`fc_${forecastX}_${forecastY}`)}
                className="w-full py-2 bg-slate-900 hover:bg-slate-950 disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-lg text-xs font-sans font-medium transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Pin className="w-3.5 h-3.5" />
                <span>{pinnedIds.includes(`fc_${forecastX}_${forecastY}`) ? 'Pinned to Dashboard' : 'Pin Forecast Chart'}</span>
              </button>
            </div>
          )}

          {/* 3. ANOMALY CONTROLS */}
          {statTab === 'anomaly' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-bold block">
                  Scan Metric Variable
                </label>
                <select
                  value={anomalyCol}
                  onChange={(e) => setAnomalyCol(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 rounded-lg bg-white"
                >
                  {numericColumns.map(col => (
                    <option key={col.name} value={col.name}>{col.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-bold block">
                  Z-Score Sensitivity ({zThreshold}σ)
                </label>
                <input
                  type="range"
                  min="1.0"
                  max="3.0"
                  step="0.5"
                  value={zThreshold}
                  onChange={(e) => setZThreshold(parseFloat(e.target.value))}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                  <span>1.0σ (Sensitive)</span>
                  <span>2.0σ (Standard)</span>
                  <span>3.0σ (Conservative)</span>
                </div>
              </div>

              <div className="bg-amber-50 text-amber-900 border border-amber-100 p-3 rounded-lg text-[11px] font-sans leading-relaxed flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>Values lying beyond {zThreshold} standard deviations away from the mathematical mean of {anomalyCol} will be flagged as anomalies.</span>
              </div>

              <button
                onClick={handlePinAnomalies}
                disabled={pinnedIds.includes(`anom_${anomalyCol}_z_${zThreshold}`)}
                className="w-full py-2 bg-slate-900 hover:bg-slate-950 disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-lg text-xs font-sans font-medium transition flex items-center justify-center gap-1.5 cursor-pointer"
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
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-xs space-y-6">
              <div className="flex justify-between items-center pb-3 border-b border-gray-50">
                <h3 className="font-sans font-medium text-gray-900 text-sm tracking-tight">
                  Independent Variable relationship map
                </h3>
                <span className="text-[10px] font-mono bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full font-bold">
                  {regressionResults.nSize} data steps processed
                </span>
              </div>

              {/* R Recharts Plot */}
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid stroke="#f3f4f6" />
                    <XAxis type="number" dataKey="xVal" name={regX} tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <YAxis type="number" dataKey="yVal" name={regY} tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Scatter name="Raw data row" data={regressionResults.points} fill="#3b82f6" />
                    <Scatter name="Least-Squares Regression Trend" data={regressionResults.points} fill="#10b981" line shape="circle" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              {/* Stats blocks */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-gray-50">
                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <div className="text-[10px] font-mono text-gray-400 uppercase">Pearson (r)</div>
                  <div className={`text-sm font-semibold mt-1 font-mono ${regressionResults.correlation > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {regressionResults.correlation}
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <div className="text-[10px] font-mono text-gray-400 uppercase">R-Squared (R²)</div>
                  <div className="text-sm font-semibold mt-1 font-mono text-gray-800">
                    {regressionResults.rSquared}
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <div className="text-[10px] font-mono text-gray-400 uppercase">Trend Slope (m)</div>
                  <div className="text-sm font-semibold mt-1 font-mono text-gray-800">
                    {regressionResults.slope}
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <div className="text-[10px] font-mono text-gray-400 uppercase">Intercept (c)</div>
                  <div className="text-sm font-semibold mt-1 font-mono text-gray-800">
                    {regressionResults.intercept}
                  </div>
                </div>
              </div>

              {/* Text interpretation */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-white">
                <h4 className="text-xs font-mono font-semibold text-slate-400 uppercase mb-2">
                  Statistical Method Interpretation
                </h4>
                <p className="text-xs leading-relaxed font-sans text-slate-200">
                  {regressionResults.rSquared > 0.6 ? (
                    <span>
                      There is a <strong>strong correlation</strong> ({regressionResults.correlation}) explaining {(regressionResults.rSquared * 100).toFixed(1)}% of variance. The fitted trendline equation is <code className="font-mono text-emerald-400">Y = {regressionResults.slope}X + {regressionResults.intercept}</code>. Every incremental unit of {regX} is estimated to trigger a shift of {regressionResults.slope} in {regY}.
                    </span>
                  ) : regressionResults.rSquared > 0.2 ? (
                    <span>
                      There is a <strong>moderate association</strong> ({regressionResults.correlation}) explaining {(regressionResults.rSquared * 100).toFixed(1)}% of variance. While a positive/negative trend exists, other auxiliary factors in the dataset likely influence {regY}.
                    </span>
                  ) : (
                    <span>
                      There is <strong>weak or negligible correlation</strong> ({regressionResults.correlation}) between {regX} and {regY}. A linear equation cannot accurately fit or explain variations here.
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* 2. FORECASTING OUTPUT */}
          {statTab === 'forecasting' && forecastResults && (
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-xs space-y-6">
              <div className="flex justify-between items-center pb-3 border-b border-gray-50">
                <h3 className="font-sans font-medium text-gray-900 text-sm tracking-tight">
                  Time Series Projection Workspace
                </h3>
                <span className="text-[10px] font-mono bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full font-bold">
                  {forecastResults.methodName}
                </span>
              </div>

              {/* Chart */}
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={forecastResults.combinedSeries} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Line type="monotone" name="Historical actuals" dataKey="actual" stroke="#2563eb" strokeWidth={2.5} connectNulls />
                    <Line type="monotone" name="Forecast Model fit" dataKey="forecast" stroke="#ea580c" strokeDasharray="4 4" strokeWidth={2} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Summary explanations */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-white">
                <h4 className="text-xs font-mono font-semibold text-slate-400 uppercase mb-2">
                  Forecasting Insight
                </h4>
                <p className="text-xs leading-relaxed font-sans text-slate-200">
                  Using <strong>{forecastResults.methodName}</strong>, the system analyzed past records and projected {forecastPeriods} intervals ahead. This allows teams to identify seasonless, standard demand growth curves, calculate future inventory budgets, or target customer acquisition trajectories seamlessly.
                </p>
              </div>
            </div>
          )}

          {/* 3. ANOMALY OUTPUT */}
          {statTab === 'anomaly' && anomalyResults && (
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-xs space-y-6">
              <div className="flex justify-between items-center pb-3 border-b border-gray-50">
                <h3 className="font-sans font-medium text-gray-900 text-sm tracking-tight">
                  Dynamic Extreme Outliers Diagnostic
                </h3>
                <span className="text-[10px] font-mono bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-0.5 rounded-full font-bold">
                  Mean: {anomalyResults.mean} • StdDev: {anomalyResults.stdDev}
                </span>
              </div>

              {anomalyResults.anomalies.length === 0 ? (
                <div id="no-anomalies-state" className="p-8 text-center bg-gray-50/55 rounded-xl border border-gray-100 max-w-md mx-auto">
                  <div className="p-3 bg-white text-emerald-500 rounded-full border border-emerald-100 w-fit mx-auto mb-3">
                    <Check className="w-5 h-5" />
                  </div>
                  <h4 className="font-sans font-medium text-gray-900 text-xs tracking-tight">
                    Clean Dataset!
                  </h4>
                  <p className="text-xs text-gray-400 mt-1">
                    No points exceeded {zThreshold} standard deviations. The values in {anomalyCol} reside in acceptable boundaries.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto border border-gray-100 rounded-lg">
                    <table className="w-full min-w-max text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-150 text-xs font-semibold text-gray-700">
                          <th className="px-4 py-2.5 font-sans">Row Index</th>
                          <th className="px-4 py-2.5 font-sans">Outlier Value</th>
                          <th className="px-4 py-2.5 font-sans">Z-Score Deviation</th>
                          <th className="px-4 py-2.5 font-sans">Threshold Severity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {anomalyResults.anomalies.map((anom, idx) => (
                          <tr key={idx} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 text-xs font-mono text-gray-600">
                            <td className="px-4 py-2">Row #{anom.rowIndex}</td>
                            <td className="px-4 py-2 font-bold text-gray-800">{anom.val}</td>
                            <td className="px-4 py-2 text-rose-600 font-semibold">{anom.zScore}</td>
                            <td className="px-4 py-2">
                              <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded text-[10px] font-semibold uppercase">
                                {anom.desc}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-white">
                    <h4 className="text-xs font-mono font-semibold text-slate-400 uppercase mb-2">
                      Anomaly Interpretation
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
