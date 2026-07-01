import React, { useState, useMemo } from 'react';
import { Dataset, ColumnMetadata } from '../types';
import { ArrowUpDown, HelpCircle, Search, ChevronLeft, ChevronRight, BarChart4 } from 'lucide-react';

interface TablePreviewProps {
  dataset: Dataset;
}

export const TablePreview: React.FC<TablePreviewProps> = ({ dataset }) => {
  const { columns, rows } = dataset;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedColumnForStats, setSelectedColumnForStats] = useState<ColumnMetadata | null>(null);

  // Sorting Handler
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  // Match search filter + Sorting logic
  const processedRows = useMemo(() => {
    let result = [...rows];

    // Filter
    if (searchTerm.trim() !== '') {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(row => {
        return Object.values(row).some(val => 
          val !== undefined && val !== null && String(val).toLowerCase().includes(lowerSearch)
        );
      });
    }

    // Sort
    if (sortConfig) {
      const { key, direction } = sortConfig;
      result.sort((a, b) => {
        const aVal = a[key];
        const bVal = b[key];

        if (aVal === undefined || aVal === null) return 1;
        if (bVal === undefined || bVal === null) return -1;

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return direction === 'asc' ? aVal - bVal : bVal - aVal;
        }

        const aString = String(aVal).toLowerCase();
        const bString = String(bVal).toLowerCase();

        if (aString < bString) return direction === 'asc' ? -1 : 1;
        if (aString > bString) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [rows, searchTerm, sortConfig]);

  // Paginated layout
  const totalRows = processedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return processedRows.slice(startIndex, startIndex + pageSize);
  }, [processedRows, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      {/* Search & Layout Actions */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search spreadsheet rows..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100/50 rounded-lg text-sm bg-gray-50/20"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <span className="text-xs text-gray-500 font-mono">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="border border-gray-200 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-100 bg-white font-medium"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <span className="text-xs text-gray-400">
            Showing {Math.min(totalRows, (currentPage - 1) * pageSize + 1)}-
            {Math.min(totalRows, currentPage * pageSize)} of {totalRows}
          </span>
        </div>
      </div>

      {/* Grid columns inspect rail */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 bg-white border border-gray-100 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  {columns.map((col) => (
                    <th
                      key={col.name}
                      onClick={() => handleSort(col.name)}
                      className="px-4 py-3 cursor-pointer hover:bg-gray-100/60 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-sans font-medium text-gray-700 text-xs tracking-tight">
                          {col.name}
                        </span>
                        <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="text-[9px] font-mono font-medium text-gray-400 px-1 py-0.5 bg-gray-100 rounded">
                          {col.type}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-8 text-center text-xs text-gray-400 font-mono">
                      No matching records found.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors"
                    >
                      {columns.map((col) => (
                        <td key={col.name} className="px-4 py-2.5 text-xs text-gray-600 font-mono">
                          {row[col.name] !== undefined && row[col.name] !== null ? String(row[col.name]) : '-'}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination bar */}
          <div className="bg-white border-t border-gray-50 px-4 py-3 flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="p-1.5 border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent rounded-lg transition"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="p-1.5 border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent rounded-lg transition"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Column Stats Inspector Sidebar */}
        <div className="w-full lg:w-80 flex flex-col gap-4">
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-50">
              <BarChart4 className="w-4 h-4 text-blue-500" />
              <h3 className="font-sans font-medium text-gray-900 text-sm tracking-tight">
                Columns Inspector
              </h3>
            </div>
            <p className="text-[11px] text-gray-400 mb-4 font-sans">
              Click a column header name to view descriptive stats or distributions.
            </p>

            <div className="space-y-2">
              {columns.map((col) => (
                <button
                  key={col.name}
                  onClick={() => setSelectedColumnForStats(col)}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs transition duration-150 flex items-center justify-between group ${
                    selectedColumnForStats?.name === col.name
                      ? 'bg-blue-50/40 border-blue-200 text-blue-900'
                      : 'bg-gray-50 hover:bg-gray-100/50 border-gray-100 text-gray-700'
                  }`}
                >
                  <div className="truncate pr-2">
                    <span className="font-mono truncate block font-medium group-hover:text-blue-600">
                      {col.name}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-gray-400 bg-white border border-gray-100 px-1.5 py-0.5 rounded uppercase">
                    {col.type}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {selectedColumnForStats && (
            <div id="stats-panel" className="bg-gradient-to-tr from-slate-900 to-slate-950 border border-slate-800 rounded-xl p-5 text-white shadow-md">
              <h4 className="font-sans font-semibold text-xs tracking-wide text-slate-400 uppercase mb-3">
                Descriptive Summary: {selectedColumnForStats.name}
              </h4>

              <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between border-b border-slate-800/60 pb-1 text-[11px]">
                  <span className="text-slate-400">Unique values</span>
                  <span className="font-semibold text-slate-100">{selectedColumnForStats.stats?.uniqueCount ?? 'N/A'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-1 text-[11px]">
                  <span className="text-slate-400">Missing rows</span>
                  <span className="font-semibold text-slate-100">{selectedColumnForStats.stats?.missingCount ?? 0}</span>
                </div>

                {selectedColumnForStats.type === 'numeric' && selectedColumnForStats.stats && (
                  <>
                    <div className="flex justify-between border-b border-slate-800/60 pb-1 text-[11px]">
                      <span className="text-slate-400">Minimum value</span>
                      <span className="font-semibold text-slate-100">{selectedColumnForStats.stats.min}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/60 pb-1 text-[11px]">
                      <span className="text-slate-400">Maximum value</span>
                      <span className="font-semibold text-slate-100">{selectedColumnForStats.stats.max}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/60 pb-1 text-[11px]">
                      <span className="text-slate-400">Weighted Average</span>
                      <span className="font-semibold text-emerald-400">{selectedColumnForStats.stats.mean}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
