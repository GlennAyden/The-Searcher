'use client';

import React from 'react';
import { Calendar, RefreshCcw } from 'lucide-react';

type SummaryControlsProps = {
    method: string;
    period: string;
    availableDates: string[];
    selectedDate: string;
    scrapedAt: string | null;
    loading: boolean;
    isBatchLoading: boolean;
    onMethodChange: (value: string) => void;
    onPeriodChange: (value: string) => void;
    onDateChange: (value: string) => void;
    onBatchSync: () => void;
};

export function SummaryControls({
    method,
    period,
    availableDates,
    selectedDate,
    scrapedAt,
    loading,
    isBatchLoading,
    onMethodChange,
    onPeriodChange,
    onDateChange,
    onBatchSync
}: SummaryControlsProps) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-1 bg-[#181a1f] p-1 border-b border-zinc-800/60 sticky top-0 z-50 backdrop-blur-md bg-opacity-90">
            <div className="flex items-center gap-3">
                <div className="space-y-0.5">
                    <label className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider block">Metode Analisa</label>
                    <select
                        value={method}
                        onChange={(e) => onMethodChange(e.target.value)}
                        className="block w-48 bg-[#23252b] border border-zinc-700/50 text-zinc-200 text-[10px] rounded-sm py-0.5 px-1 outline-none focus:border-blue-500/50 cursor-pointer transition-all"
                    >
                        <option value="m">Market Maker Analysis</option>
                        <option value="nr">Non-Retail Flow</option>
                        <option value="f">Foreign Flow Analysis</option>
                    </select>
                </div>

                <div className="space-y-0.5">
                    <label className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider block">Periode</label>
                    <select
                        value={period}
                        onChange={(e) => onPeriodChange(e.target.value)}
                        className="block w-28 bg-[#23252b] border border-zinc-700/50 text-zinc-200 text-[10px] rounded-sm py-0.5 px-1 outline-none focus:border-blue-500/50 cursor-pointer transition-all"
                    >
                        <option value="d">Daily</option>
                        <option value="c">Cumulative</option>
                    </select>
                </div>

                <div className="space-y-0.5">
                    <label className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider block flex items-center gap-1">
                        <Calendar className="w-2 h-2" /> Tanggal Data
                    </label>
                    <select
                        value={selectedDate}
                        onChange={(e) => onDateChange(e.target.value)}
                        className="block w-32 bg-[#23252b] border border-zinc-700/50 text-yellow-400 font-bold text-[10px] rounded-sm py-0.5 px-1 outline-none focus:border-yellow-500/50 cursor-pointer transition-all"
                    >
                        <option value="">Latest Scrape</option>
                        {availableDates.map(date => (
                            <option key={date} value={date}>{date}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={onBatchSync}
                    disabled={loading || isBatchLoading}
                    className="bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:opacity-90 disabled:opacity-50 text-white px-3 py-1 rounded-sm text-[10px] font-bold shadow-lg transition-all active:scale-95 flex items-center gap-1"
                >
                    {isBatchLoading && <RefreshCcw className="w-2.5 h-2.5 animate-spin" />}
                    {isBatchLoading ? 'Syncing All...' : 'Full Sync'}
                </button>
                {scrapedAt && (
                    <div className="text-[10px] text-zinc-400 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800/50 font-medium">
                        UPDATED: <span className="text-zinc-300">{scrapedAt}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
