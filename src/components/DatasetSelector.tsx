import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { SAMPLE_DATASETS, SampleDataset } from '../sampleData';
import { Dataset, ColumnMetadata } from '../types';
import { FileUp, Database, ArrowRight, Sparkles, Loader2 } from 'lucide-react';

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
    <div className="max-w-4xl mx-auto py-12 px-4">
      {/* Hero Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center p-2.5 bg-blue-50 text-blue-600 rounded-2xl mb-4">
          <Sparkles className="w-8 h-8 animate-pulse text-blue-600" />
        </div>
        <h1 className="font-sans font-medium text-gray-950 text-4xl tracking-tight leading-none mb-3">
          AI Data Analyst Agent
        </h1>
        <p className="text-sm text-gray-500 max-w-lg mx-auto">
          Upload any CSV spreadsheet file to extract automated insights, run multi-aspect calculations, and generate fully interactive visual reports instantly.
        </p>
      </div>

      <div className="space-y-8">
        {/* Upload Container */}
        <div
          id="csv-drag-area"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 group ${
            isDragging
              ? 'border-blue-500 bg-blue-50/20 shadow-xs'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/40'
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
            <div className="flex flex-col items-center py-6">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-3" />
              <p className="text-sm font-medium text-gray-800">Processing spreadsheet records...</p>
              <p className="text-xs text-gray-400 mt-1">Estimating ranges and verifying cell metadata</p>
            </div>
          ) : (
            <div className="flex flex-col items-center py-4">
              <div className="p-4 bg-gray-50 text-gray-400 rounded-full group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors duration-200 mb-4">
                <FileUp className="w-8 h-8" />
              </div>
              <p className="text-sm font-medium text-gray-800 mb-1">
                Drag & drop your CSV file here, or <span className="text-blue-600">click to browse</span>
              </p>
              <p className="text-xs text-gray-400">
                Supports standard comma-separated tabular files (up to 10MB)
              </p>
            </div>
          )}
        </div>

        {errorMsg && (
          <div id="upload-error" className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-xs font-mono font-medium border border-red-100">
            {errorMsg}
          </div>
        )}

        {/* Curator Samples */}
        <div className="border border-gray-150/50 bg-gray-50/20 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-4 h-4 text-gray-400" />
            <h2 className="text-xs font-mono uppercase tracking-wider text-gray-500 font-semibold">
              Or run instant analysis with smart curated samples
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SAMPLE_DATASETS.map((sample) => (
              <button
                key={sample.id}
                onClick={() => handleSelectSample(sample)}
                className="flex flex-col text-left p-4 bg-white hover:bg-gray-50 border border-gray-100 hover:border-gray-200 hover:shadow-xs rounded-xl transition duration-150 group"
              >
                <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {sample.name}
                </h3>
                <p className="text-xs text-gray-400 mt-2 flex-1 line-clamp-3">
                  {sample.description}
                </p>
                <div className="mt-4 flex items-center text-xs font-mono font-semibold text-blue-600 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Load dataset</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
