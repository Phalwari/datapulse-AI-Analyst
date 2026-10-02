import React, { useState, useMemo } from 'react';
import { Dataset, PinnedItem } from '../types';
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
  ResponsiveContainer
} from 'recharts';
import { TrendingUp, AlertTriangle, Activity, Pin, Check, Sparkles } from 'lucide-react';

interface AdvancedStatsProps {
  dataset: Dataset;
  onPinItem: (item: PinnedItem) => void;
  pinnedIds: string[];
}

export const AdvancedStats: React.FC<AdvancedStatsProps> = ({ dataset, onPinItem, pinnedIds }) => {
  const { columns, rows } = dataset;

  // Active analytical tab selection
  const [statTab, setStatTab] = useState<'regression' | 'forecasting' | 'anomaly' | 'correlation'>('regression');

  // --- Regression State ---
  const numericColumns = useMemo(() => columns.filter(c => c.type === 'numeric'), [columns]);
  const [regX, setRegX] = useState(numericColumns[0]?.name || '');
  const [regY, setRegY] = useState(numericColumns[1]?.name || numericColumns[0]?.name || '');

  // --- Forecasting State ---
  const dateAndNumColumns = useMemo(() => columns.filter(c => c.type === 'date' || c.type === 'string' || c.type === 'numeric'), [columns]);
  const [forecastX, setForecastX] = useState(dateAndNumColumns[0]?.name || '');
  const [forecastY, setForecastY] = useState(numericColumns[0]?.name || '');
  const [forecastPeriods, setForecastPeriods] = useState(3);
  const [forecastMethod, setForecastMethod] = useState<'sma' | 'linear'>('linear');

  // --- Anomaly State ---
  const [anomalyCol, setAnomalyCol] = useState(numericColumns[0]?.name || '');
  const [zThreshold, setZThreshold] = useState(2.0);

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

    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < N; i++) {
      const prediction = slope * xVals[i] + intercept;
      ssRes += Math.pow(yVals[i] - prediction, 2);
      ssTot += Math.pow(yVals[i] - meanY, 2);
    }

    const rSquared = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);
    const correlation = Math.sign(slope) * Math.sqrt(rSquared);

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
      points: scatterPoints
    };
  }, [regX, regY, rows]);

  // -------------------------------------------------------------
  // FORECASTING MATHEMATICS
  // -------------------------------------------------------------
  const forecastResults = useMemo(() => {
    if (!forecastX || !forecastY || rows.length < 3) return null;

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

      actualData.forEach((item, idx) => {
        item.forecast = parseFloat((slope * idx + intercept).toFixed(2));
      });

      for (let p = 1; p <= forecastPeriods; p++) {
        const nextIdx = N + p - 1;
        projectedData.push({
          label: `Forecast +${p}`,
          actual: null,
          forecast: parseFloat((slope * nextIdx + intercept).toFixed(2))
        });
      }
    } else {
      const windowSize = 3;
      actualData.forEach((item, idx) => {
        if (idx < windowSize) {
          item.forecast = item.actual;
        } else {
          const slice = actualData.slice(idx - windowSize, idx);
          const sum = slice.reduce((acc, curr) => acc + (curr.actual || 0), 0);
          item.forecast = parseFloat((sum / windowSize).toFixed(2));
        }
      });

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
  // ANOMALY DETECTION MATHEMATICS
  // -------------------------------------------------------------
  const anomalyResults = useMemo(() => {
    if (!anomalyCol || rows.length === 0) return null;

    const values = rows.map(row => parseFloat(row[anomalyCol])).filter(v => !isNaN(v));
    const N = values.length;
    if (N < 2) return null;

    const mean = values.reduce((a, b) => a + b, 0) / N;
    const sqDiffSum = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
    const stdDev = Math.sqrt(sqDiffSum / N);

    if (stdDev === 0) {
      return { mean, stdDev, anomalies: [] };
    }

    const detectedAnomalies: { rowIndex: number; val: number; zScore: number; desc: string }[] = [];

    rows.forEach((row, index) => {
      const val = parseFloat(row[anomalyCol]);
      if (isNaN(val)) return;

      const zScore = (val - mean) / stdDev;
      if (Math.abs(zScore) >= zThreshold) {
        detectedAnomalies.push({
          rowIndex: index + 1,
          val: parseFloat(val.toFixed(2)),
          zScore: parseFloat(zScore.toFixed(2)),
          desc: zScore > 0 ? `${zScore.toFixed(1)}σ Above Mean` : `${Math.abs(zScore).toFixed(1)}σ Below Mean`
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
  // CORRELATION MATRIX MATHEMATICS
  // -------------------------------------------------------------
  const correlationMatrix = useMemo(() => {
    if (numericColumns.length < 2 || rows.length < 2) return null;

    const names = numericColumns.map(c => c.name);
    const matrix: number[][] = [];

    const colData: Record<string, number[]> = {};
    names.forEach(name => {
      colData[name] = rows.map(r => parseFloat(r[name])).filter(v => !isNaN(v));
    });

    for (let i = 0; i < names.length; i++) {
      const rowRes: number[] = [];
      const colA = names[i];
      const valsA = colData[colA];

      for (let j = 0; j < names.length; j++) {
        const colB = names[j];
        const valsB = colData[colB];

        const N = Math.min(valsA.length, valsB.length);
        if (N < 2) {
          rowRes.push(0);
          continue;
        }

        const meanA = valsA.slice(0, N).reduce((a, b) => a + b, 0) / N;
        const meanB = valsB.slice(0, N).reduce((a, b) => a + b, 0) / N;

        let num = 0;
        let denA = 0;
        let denB = 0;
        for (let k = 0; k < N; k++) {
          const diffA = valsA[k] - meanA;
          const diffB = valsB[k] - meanB;
          num += diffA * diffB;
          denA += diffA * diffA;
          denB += diffB * diffB;
        }

        const r = (denA === 0 || denB === 0) ? 0 : num / Math.sqrt(denA * denB);
        rowRes.push(parseFloat(r.toFixed(3)));
      }
      matrix.push(rowRes);
    }

    return { names, matrix };
  }, [numericColumns, rows]);

  // -------------------------------------------------------------
  // PINNING DIRECTIVES
  // -------------------------------------------------------------
  const handlePinRegression = () => {
    if (!regressionResults) return;
    onPinItem({
      id: `reg_${regX}_vs_${regY}`,
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
    onPinItem({
      id: `fc_${forecastX}_${forecastY}`,
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
    onPinItem({
      id: `anom_${anomalyCol}_z_${zThreshold}`,
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

        <button
          onClick={() => setStatTab('correlation')}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl text-xs font-sans font-bold transition-all duration-150 cursor-pointer ${
            statTab === 'correlation'
              ? 'bg-white text-indigo-600 shadow-xs border border-slate-100/50'
              : 'text-slate-500 hover:text-slate-850 hover:bg-white/45'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Correlation Matrix</span>
        </button>
      </div>

      {/* Workspace Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Controls Panel */}
        {statTab !== 'correlation' && (
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
        )}

        {/* Display Workspace Results */}
        <div className={statTab === 'correlation' ? 'lg:col-span-3 space-y-6' : 'lg:col-span-2 space-y-6'}>
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

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="xVal" name={regX} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis type="number" dataKey="yVal" name={regY} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ fontSize: '11px', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                    <Scatter name="Raw data row" data={regressionResults.points} fill="#4f46e5" />
                    <Scatter name="Least-Squares Regression Trend" data={regressionResults.points} fill="#0d9488" line shape="circle" />
                  </ScatterChart>
                </ResponsiveContainer>
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
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={forecastResults.combinedSeries} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                    <Line type="monotone" name="Historical actuals" dataKey="actual" stroke="#4f46e5" strokeWidth={2.5} connectNulls />
                    <Line type="monotone" name="Forecast Model fit" dataKey="forecast" stroke="#ea580c" strokeDasharray="4 4" strokeWidth={2.5} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
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
              </div>

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
              </div>
            </div>
          )}

          {/* 4. CORRELATION MATRIX OUTPUT */}
          {statTab === 'correlation' && (
            correlationMatrix ? (
              <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-sans font-bold text-slate-800 text-base tracking-tight">
                      Pairwise Pearson Correlation Matrix Heatmap
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 font-sans">
                      Multi-dimensional association map across {correlationMatrix.names.length} numeric dataset attributes.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-bold">
                    {correlationMatrix.names.length} × {correlationMatrix.names.length} Matrix
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded-2xl p-4">
                  <table className="w-full min-w-max text-center border-collapse">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-xs font-mono font-bold text-slate-400 border-b border-slate-100 text-left">
                          Metric / Attribute
                        </th>
                        {correlationMatrix.names.map(name => (
                          <th key={name} className="px-3 py-2 text-xs font-mono font-bold text-slate-700 border-b border-slate-100 truncate max-w-[120px]">
                            {name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {correlationMatrix.matrix.map((rowVals, rIdx) => (
                        <tr key={rIdx} className="border-b border-slate-50 last:border-0">
                          <td className="px-3 py-2.5 text-xs font-mono font-bold text-slate-700 text-left bg-slate-50/50 truncate max-w-[140px]">
                            {correlationMatrix.names[rIdx]}
                          </td>
                          {rowVals.map((val, cIdx) => {
                            let bgClass = "bg-slate-50 text-slate-700";
                            if (rIdx === cIdx) {
                              bgClass = "bg-indigo-600 text-white font-bold";
                            } else if (val > 0.6) {
                              bgClass = "bg-indigo-100 text-indigo-900 font-bold border border-indigo-200/60";
                            } else if (val > 0.3) {
                              bgClass = "bg-indigo-50 text-indigo-800 font-medium";
                            } else if (val < -0.3) {
                              bgClass = "bg-rose-50 text-rose-800 font-medium";
                            }

                            return (
                              <td key={cIdx} className="p-2">
                                <div className={`py-2 px-2.5 rounded-xl text-xs font-mono transition ${bgClass}`}>
                                  {val > 0 && rIdx !== cIdx ? `+${val}` : val}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-3xl p-8 text-center space-y-3">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl w-fit mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h4 className="font-sans font-bold text-slate-800 text-sm">Insufficient Numeric Columns</h4>
                <p className="text-xs text-slate-400 font-sans max-w-sm mx-auto">
                  Correlation matrix calculations require at least 2 continuous numeric columns in the dataset.
                </p>
              </div>
            )
          )}

        </div>
      </div>
    </div>
  );
};
