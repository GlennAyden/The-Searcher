'use client';

import React from 'react';
import { AlertCircle, ChevronDown, ChevronUp, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cleanTickerSymbol } from '@/lib/string-utils';
import type { SummaryFilters, SummaryRow, SortConfig } from '../types';

type SummaryTableProps = {
    allColumns: string[];
    paginatedData: SummaryRow[];
    filters: SummaryFilters;
    sortConfig: SortConfig;
    loading: boolean;
    isBatchLoading: boolean;
    onSort: (key: string) => void;
    onFilterChange: (column: string, value: string) => void;
};

export function SummaryTable({
    allColumns,
    paginatedData,
    filters,
    sortConfig,
    loading,
    isBatchLoading,
    onSort,
    onFilterChange
}: SummaryTableProps) {
    return (
        <div className="flex-1 overflow-hidden relative bg-[#0f1115]">
            {(loading || isBatchLoading) && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-3">
                    <RefreshCcw className="w-10 h-10 text-blue-500 animate-spin" />
                    <span className="text-blue-400 text-xs font-mono animate-pulse">
                        {isBatchLoading ? 'Running Full Sync (Methods x Periods)...' : 'Synchronizing with NeoBDM...'}
                    </span>
                    {isBatchLoading && (
                        <span className="text-[10px] text-zinc-500 max-w-xs text-center px-4">
                            This process iterates through all analysis methods and periods. Please do not close this window.
                        </span>
                    )}
                </div>
            )}

            <div className="overflow-auto h-full scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                <table className="w-auto text-left text-[11px] border-collapse leading-none tracking-tight user-select-text table-fixed">
                    <thead className="sticky top-0 z-20 shadow-md">
                        <tr className="bg-[#eab308] text-black border-b border-yellow-600">
                            {allColumns.map((col) => {
                                const isSorted = sortConfig?.key === col;

                                const colLower = col.toLowerCase();
                                let widthClass = 'w-[65px] max-w-[65px]';
                                if (colLower === 'symbol') widthClass = 'w-[140px] max-w-[140px]';
                                else if (['pinky', 'crossing', 'unusual', 'likuid'].includes(colLower)) widthClass = 'w-[45px] max-w-[45px]';
                                else if (colLower.startsWith('w-') || colLower.startsWith('d-') || colLower.startsWith('c-')) widthClass = 'w-[65px] max-w-[65px]';
                                else if (colLower.includes('ma') || colLower === 'price') widthClass = 'w-[100px] max-w-[100px]';

                                return (
                                    <th
                                        key={col}
                                        onClick={() => onSort(col)}
                                        className={cn(
                                            'px-0 py-2 font-extrabold text-[#1a1a1a] uppercase text-[12px] tracking-tight border-r border-yellow-600/20 cursor-pointer hover:bg-[#ca8a04] transition-colors select-none group relative whitespace-nowrap overflow-hidden text-ellipsis',
                                            widthClass
                                        )}
                                    >
                                        <div className="flex items-center justify-center gap-0">
                                            {col.toLowerCase()}
                                            <div className="flex flex-col opacity-30 group-hover:opacity-100 transition-opacity">
                                                <ChevronUp className={cn('w-1 h-1', isSorted && sortConfig?.direction === 'asc' && 'text-black opacity-100')} />
                                                <ChevronDown className={cn('w-1 h-1 -mt-0.5', isSorted && sortConfig?.direction === 'desc' && 'text-black opacity-100')} />
                                            </div>
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>

                        <tr className="bg-[#1f2937] border-b border-zinc-700">
                            {allColumns.map((col) => (
                                <th key={`filter-${col}`} className="p-0 border-r border-zinc-700/50">
                                    <input
                                        type="text"
                                        placeholder=""
                                        title="Operators: >, <, >=, <=, = | Multi: & | Example: >100 or >=50&<=200"
                                        value={filters[col] || ''}
                                        onChange={(e) => onFilterChange(col, e.target.value)}
                                        className="w-full bg-[#111827] border-none text-zinc-300 text-[12px] px-2 py-1 outline-none focus:bg-zinc-800 text-center placeholder:text-zinc-700 h-[28px]"
                                    />
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody className="bg-[#0f1115] divide-y divide-zinc-800/50">
                        {paginatedData.length > 0 ? (
                            paginatedData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-zinc-800/40 transition-colors group h-[30px]">
                                    {allColumns.map((col) => {
                                        const val = row[col];
                                        let valStr = String(val || '');

                                        valStr = cleanTickerSymbol(valStr);

                                        const isNegative = valStr.startsWith('-');

                                        let textColor = 'text-zinc-400';
                                        let bgColor = 'transparent';

                                        const colLower = col.toLowerCase();
                                        const isSymbol = colLower === 'symbol';
                                        const valLower = valStr.toLowerCase();

                                        if (isNegative) {
                                            textColor = 'text-red-400';
                                        } else if (!['x', 'v'].includes(valLower) && !isNaN(parseFloat(valStr.replace(/,/g, ''))) && parseFloat(valStr.replace(/,/g, '')) > 0) {
                                            textColor = 'text-emerald-400';
                                        }
                                        if (isSymbol) textColor = 'text-blue-300 font-bold';

                                        if (['crossing', 'unusual', 'pinky'].includes(colLower) && valLower === 'v') {
                                            bgColor = 'bg-pink-500/20';
                                            textColor = 'text-pink-400 font-bold';
                                        }
                                        if (valLower === 'bullish') textColor = 'text-green-400';
                                        if (valLower === 'bearish') textColor = 'text-red-400';

                                        return (
                                            <td
                                                key={col}
                                                className={cn(
                                                    'px-2 py-1 text-center border-r border-zinc-800/30 whitespace-nowrap text-[12px] font-bold leading-normal tracking-normal overflow-hidden text-ellipsis',
                                                    bgColor
                                                )}
                                            >
                                                <div className={cn('flex items-center justify-center', textColor)}>
                                                    {isSymbol && (
                                                        <span className="text-yellow-500/50 mr-0.5 text-[8px] group-hover:text-yellow-400 transition-colors">*</span>
                                                    )}
                                                    {isSymbol ? valStr.replace('â­', '') : valStr}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={allColumns.length} className="px-4 py-32 text-center text-zinc-600 italic">
                                    <div className="flex flex-col items-center gap-2">
                                        <AlertCircle className="w-6 h-6 opacity-20" />
                                        <span>No data matches your criteria.</span>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
