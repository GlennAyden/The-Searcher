'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Database, Layers, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type DateMode = 'single' | 'range';

interface BatchSyncModalProps {
    open: boolean;
    onClose: () => void;
    batchTickers: string;
    setBatchTickers: React.Dispatch<React.SetStateAction<string>>;
    batchDates: string[];
    setBatchDates: React.Dispatch<React.SetStateAction<string[]>>;
    invalidBatchTickers: string[];
    dateMode: DateMode;
    setDateMode: React.Dispatch<React.SetStateAction<DateMode>>;
    newBatchDate: string;
    setNewBatchDate: React.Dispatch<React.SetStateAction<string>>;
    startDate: string;
    setStartDate: React.Dispatch<React.SetStateAction<string>>;
    endDate: string;
    setEndDate: React.Dispatch<React.SetStateAction<string>>;
    onGenerateDateRange: () => void;
    onConfirm: () => void;
}

export const BatchSyncModal = ({
    open,
    onClose,
    batchTickers,
    setBatchTickers,
    batchDates,
    setBatchDates,
    invalidBatchTickers,
    dateMode,
    setDateMode,
    newBatchDate,
    setNewBatchDate,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    onGenerateDateRange,
    onConfirm
}: BatchSyncModalProps) => {
    if (!open) return null;

    const canConfirm = batchDates.length > 0 && batchTickers.trim() && invalidBatchTickers.length === 0;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
                >
                    <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                        <div className="flex items-center gap-3">
                            <Layers className="w-5 h-5 text-blue-400" />
                            <h3 className="font-bold">Scrape Engine</h3>
                        </div>
                        <button onClick={onClose} className="text-zinc-500 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900/50">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Ticker(s) (comma separated)</label>
                            <div className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 focus-within:border-blue-500/50 transition-colors">
                                <Search className="w-4 h-4 text-zinc-600" />
                                <input
                                    type="text"
                                    value={batchTickers}
                                    onChange={(e) => setBatchTickers(e.target.value.toUpperCase())}
                                    placeholder="BBCA, ANTM, TLKM..."
                                    className="bg-transparent border-none outline-none text-sm font-bold w-full uppercase placeholder:text-zinc-700 font-mono"
                                />
                            </div>
                            {invalidBatchTickers.length > 0 && (
                                <div className="text-[10px] text-red-400 font-bold px-1">
                                    Ticker tidak dikenal: {invalidBatchTickers.join(', ')}
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Selected Dates</label>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-zinc-600 font-bold">{batchDates.length} days selected</span>
                                    {batchDates.length > 0 && (
                                        <button
                                            onClick={() => setBatchDates([])}
                                            className="text-[10px] text-red-400 hover:text-red-300 font-bold px-2 py-0.5 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-all"
                                        >
                                            Clear All
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 min-h-[60px] max-h-[200px] overflow-y-auto p-4 bg-zinc-900/30 border-2 border-dashed border-zinc-800 rounded-2xl scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900/50">
                                {batchDates.map((d) => (
                                    <div key={d} className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-bold">
                                        {d}
                                        <button onClick={() => setBatchDates(prev => prev.filter(x => x !== d))}>
                                            <X className="w-3 h-3 hover:text-white" />
                                        </button>
                                    </div>
                                ))}
                                {batchDates.length === 0 && (
                                    <span className="text-zinc-700 text-xs italic p-1">No dates added yet...</span>
                                )}
                            </div>

                            {batchDates.length > 8 && (
                                <p className="text-[9px] text-amber-400/80 font-bold px-1 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    Scroll to see all dates
                                </p>
                            )}

                            <div className="flex gap-2 p-1 bg-zinc-900/50 border border-zinc-800 rounded-xl w-full mb-3">
                                <button
                                    onClick={() => setDateMode('single')}
                                    className={cn(
                                        "flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                                        dateMode === 'single'
                                            ? "bg-blue-500 text-white shadow-lg"
                                            : "text-zinc-500 hover:text-zinc-300"
                                    )}
                                >
                                    Single Date
                                </button>
                                <button
                                    onClick={() => setDateMode('range')}
                                    className={cn(
                                        "flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                                        dateMode === 'range'
                                            ? "bg-blue-500 text-white shadow-lg"
                                            : "text-zinc-500 hover:text-zinc-300"
                                    )}
                                >
                                    Date Range
                                </button>
                            </div>

                            {dateMode === 'single' && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        value={newBatchDate}
                                        onChange={(e) => setNewBatchDate(e.target.value)}
                                        className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-medium [color-scheme:dark] flex-1"
                                    />
                                    <button
                                        onClick={() => {
                                            if (!batchDates.includes(newBatchDate)) {
                                                setBatchDates(prev => [...prev, newBatchDate].sort().reverse());
                                            }
                                        }}
                                        className="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/20 transition-colors"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                            )}

                            {dateMode === 'range' && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-zinc-600 uppercase px-1">From</label>
                                            <input
                                                type="date"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-medium [color-scheme:dark]"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-zinc-600 uppercase px-1">To</label>
                                            <input
                                                type="date"
                                                value={endDate}
                                                onChange={(e) => setEndDate(e.target.value)}
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-medium [color-scheme:dark]"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={onGenerateDateRange}
                                        className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                                    >
                                        Generate Dates in Range
                                    </button>
                                    <p className="text-[10px] text-zinc-500 text-center mt-2">
                                        âœ“ Weekends & holidays automatically excluded
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 flex gap-4">
                            <Database className="w-6 h-6 text-blue-400/50 mt-1" />
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-blue-300">Background Processing</p>
                                <p className="text-[10px] text-zinc-500 leading-relaxed">
                                    Scrape runs in the background. Browser sessions are reused for maximum efficiency.
                                    Scraped records will appear in the database as they finish.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-zinc-900/50 border-t border-zinc-800 flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 rounded-2xl text-sm font-bold text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all font-mono"
                        >
                            CANCEL
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={!canConfirm}
                            className={cn(
                                "flex-[2] py-3 rounded-2xl text-sm font-bold transition-all shadow-xl active:scale-95",
                                canConfirm
                                    ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20"
                                    : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                            )}
                        >
                            START SCRAPE
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
