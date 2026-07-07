import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { SAMPLE_DATASETS, SampleDataset } from '../sampleData';
import { Dataset, ColumnMetadata } from '../types';
import { FileUp, Database, ArrowRight, Sparkles, Loader2, TableProperties, BarChart3, Binary } from 'lucide-react';

interface DatasetSelectorProps {
  onDatasetLoaded: (dataset: Dataset) => void;
}

export const DatasetSelector: React.FC<DatasetSelectorProps> = ({ onDatasetLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Core parser and metadata extractor
  const processCSV = (csvText: string, filename: string) => {
    setLoading(true);
    setErrorMsg(null);

    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        try {
          const rows = results.data as Record<string, any>[];
          if (rows.length === 0) {
            throw new Error("This CSV file appears to be empty.");
          }

          const fields = results.meta.fields || [];
          if (fields.length === 0) {
            // Fallback if PapaParse couldn't infer headers
            const keys = Object.keys(rows[0]);
            if (keys.length === 0) {
              throw new Error("Could not detect any headers/columns in this CSV.");
            }
          }

          const columns: ColumnMetadata[] = fields.map(field => {
            let numericCount = 0;
            let totalFilled = 0;
            let minVal = Infinity;
            let maxVal = -Infinity;
            let sumVal = 0;
            let missingCount = 0;

            const uniqueValues = new Set<any>();

            rows.forEach(row => {
              const val = row[field];
              if (val === undefined || val === null || val === '') {
                missingCount++;
                return;
              }
              totalFilled++;
              uniqueValues.add(val);

              const parsedNum = parseFloat(val);
              if (!isNaN(parsedNum)) {
                numericCount++;
                if (parsedNum < minVal) minVal = parsedNum;
                if (parsedNum > maxVal) maxVal = parsedNum;
                sumVal += parsedNum;
              }
            });

            // Infer type
            let inferredType: 'numeric' | 'string' | 'date' | 'boolean' = 'string';
            if (numericCount > totalFilled * 0.7 && totalFilled > 0) {
              inferredType = 'numeric';
            } else {
              // Simple check for date
              const dateSampleCount = rows.slice(0, 10).filter(row => {
                const val = row[field];
                if (!val) return false;
                const parsedDate = Date.parse(String(val));
                return !isNaN(parsedDate) && isNaN(Number(val));
              }).length;
              if (dateSampleCount > 5) {
                inferredType = 'date';
              }
            }

            const stats: any = {
              uniqueCount: uniqueValues.size,
              missingCount: missingCount
            };

            if (inferredType === 'numeric' && numericCount > 0) {
              stats.min = minVal;
              stats.max = maxVal;
              stats.mean = parseFloat((sumVal / numericCount).toFixed(2));
            }

            return {
              name: field,
              type: inferredType,
              stats: stats
            };
          });

          // Final Dataset Loaded callback
          onDatasetLoaded({
            name: filename,
            columns: columns,
            rows: rows,
            rowCount: rows.length
          });

        } catch (err: any) {
          setErrorMsg(err.message || "Failed to process the CSV file contents.");
        } finally {
          setLoading(false);
        }
      },
      error: (err) => {
        setErrorMsg(err.message || "PapaParse failed to parse this CSV.");
        setLoading(false);
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        processCSV(text, file.name);
      };
      reader.readAsText(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        processCSV(text, file.name);
      };
      reader.readAsText(file);
    } else if (file) {
      setErrorMsg("Please drop only standard formatted .csv files.");
    }
  };

  const handleSelectSample = (sample: SampleDataset) => {
    processCSV(sample.csvContent, sample.name);
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center py-16 px-4 overflow-hidden bg-slate-50">
      {/* Decorative Grid & Fluid Radial Glow Backgrounds */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] opacity-50" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-blue-200/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative w-full max-w-4xl z-10">
        {/* Brand Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-mono font-semibold mb-4 animate-fade-in shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>AI-POWERED COGNITIVE WORKSPACE</span>
          </div>
          <h1 className="font-sans font-extrabold text-slate-900 text-5xl md:text-6xl tracking-tight leading-none mb-4">
            AI Data <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-800 bg-clip-text text-transparent">Analyst Agent</span>
          </h1>
          <p className="text-base text-slate-500 max-w-2xl mx-auto font-sans font-normal leading-relaxed">
            Drop in your CSV spreadsheets to run multi-dimensional calculations, auto-generate relational visual recommendations, and query raw files instantly.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {/* Main Upload Box */}
          <div
            id="csv-drag-area"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative rounded-3xl p-12 text-center cursor-pointer transition-all duration-300 group shadow-md border ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/30 ring-4 ring-indigo-500/10'
                : 'border-slate-200 bg-white/80 hover:bg-white hover:border-slate-300 hover:shadow-lg'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv"
              className="hidden"
            />

            {loading ? (
              <div className="flex flex-col items-center py-8">
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  </div>
                </div>
                <h3 className="text-lg font-sans font-semibold text-slate-800 mb-1">Scanning spreadsheet contents...</h3>
                <p className="text-sm text-slate-400 max-w-xs">Reading tabular schemas, mapping column characteristics, and building local stats matrices.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center py-6">
                <div className="p-5 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all duration-300 mb-6 group-hover:scale-105 shadow-2xs border border-slate-100/50">
                  <FileUp className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-sans font-semibold text-slate-800 mb-2">
                  Import your data source
                </h3>
                <p className="text-sm text-slate-500 mb-1 font-sans">
                  Drag & drop your <strong className="text-slate-700 font-semibold">.csv file</strong> here, or <span className="text-indigo-600 font-medium">browse local files</span>
                </p>
                <p className="text-xs text-slate-400 font-mono mt-2">
                  UTF-8 comma-delimited • Max 10MB
                </p>
              </div>
            )}
          </div>

          {errorMsg && (
            <div id="upload-error" className="bg-rose-50 text-rose-600 px-5 py-4 rounded-2xl text-xs font-mono font-medium border border-rose-100 flex items-center gap-3 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Curated Interactive Samples */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Database className="w-4 h-4 text-slate-400" />
              <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
                Or jumpstart with built-in sandbox datasets
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {SAMPLE_DATASETS.map((sample) => {
                // Infer a visual tag based on dataset ID
                let icon = <TableProperties className="w-5 h-5 text-indigo-500" />;
                let badgeColor = "bg-indigo-50 text-indigo-700 border-indigo-100";
                if (sample.id === 'sales-perf') {
                  icon = <BarChart3 className="w-5 h-5 text-emerald-500" />;
                  badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
                } else if (sample.id === 'saas-metrics') {
                  icon = <Binary className="w-5 h-5 text-sky-500" />;
                  badgeColor = "bg-sky-50 text-sky-700 border-sky-100";
                }

                return (
                  <button
                    key={sample.id}
                    onClick={() => handleSelectSample(sample)}
                    className="flex flex-col text-left p-5 bg-white border border-slate-100 hover:border-slate-200 shadow-2xs hover:shadow-md rounded-2xl transition-all duration-200 group relative overflow-hidden cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-4 w-full">
                      <div className="p-2.5 bg-slate-50 rounded-xl group-hover:bg-white transition-colors duration-200 border border-slate-100">
                        {icon}
                      </div>
                      <span className={`text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full border ${badgeColor}`}>
                        SANDBOX
                      </span>
                    </div>
                    
                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors mb-1.5 font-sans leading-snug">
                      {sample.name}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed flex-1 line-clamp-3 mb-4">
                      {sample.description}
                    </p>

                    <div className="flex items-center text-xs font-semibold text-indigo-600 gap-1.5 mt-auto pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Launch workspace</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
