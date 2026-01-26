'use client';

import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Clipboard, Trash2, RefreshCw, ChevronDown
} from "lucide-react";
import type { DateRangeInfo, ImposterAnalysis } from '@/services/api/doneDetail';

type MessageState = { type: 'success' | 'error'; text: string } | null;

interface DoneDetailHeaderProps {
    availableTickers: string[];
    selectedTicker: string;
    onSelectTicker: (ticker: string) => void;
    dateRangeInfo: DateRangeInfo | null;
    dateMode: 'single' | 'range';
    onDateModeChange: (mode: 'single' | 'range') => void;
    startDate: string;
    endDate: string;
    onStartDateChange: (value: string) => void;
    onEndDateChange: (value: string) => void;
    onOpenPaste: () => void;
    onRefresh: () => void;
    onDelete: () => void;
    loading: boolean;
    analysisData: ImposterAnalysis | null;
    message: MessageState;
}

export const DoneDetailHeader = ({
    availableTickers,
    selectedTicker,
    onSelectTicker,
    dateRangeInfo,
    dateMode,
    onDateModeChange,
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    onOpenPaste,
    onRefresh,
    onDelete,
    loading,
    analysisData,
    message
}: DoneDetailHeaderProps) => {
    const [showTickerDropdown, setShowTickerDropdown] = useState(false);

    return (
        <Card className="bg-slate-900/50 border-slate-700">
            <CardContent className="py-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <Button
                            variant="outline"
                            className="w-28 justify-between bg-slate-800 border-slate-600 text-white font-bold"
                            onClick={() => setShowTickerDropdown(!showTickerDropdown)}
                        >
                            {selectedTicker || 'Select'}
                            <ChevronDown className="w-4 h-4 ml-1" />
                        </Button>
                        {showTickerDropdown && (
                            <div className="absolute top-full mt-1 w-28 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 max-h-48 overflow-auto">
                                {availableTickers.length === 0 ? (
                                    <div className="p-2 text-slate-400 text-xs">No data yet</div>
                                ) : (
                                    availableTickers.map((t) => (
                                        <button
                                            key={t}
                                            className={`w-full p-2 text-left hover:bg-slate-700 text-sm font-medium ${t === selectedTicker ? 'bg-teal-600 text-white' : 'text-white'}`}
                                            onClick={() => { onSelectTicker(t); setShowTickerDropdown(false); }}
                                        >
                                            {t}
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-1 px-2 py-1 bg-slate-800/50 rounded-lg">
                        <button
                            className={`px-2 py-1 text-xs rounded ${dateMode === 'single' ? 'bg-teal-600 text-white' : 'text-slate-400'}`}
                            onClick={() => onDateModeChange('single')}
                        >Single</button>
                        <button
                            className={`px-2 py-1 text-xs rounded ${dateMode === 'range' ? 'bg-teal-600 text-white' : 'text-slate-400'}`}
                            onClick={() => onDateModeChange('range')}
                        >Range</button>
                    </div>

                    {dateRangeInfo?.dates && dateRangeInfo.dates.length > 0 ? (
                        <div className="flex items-center gap-2">
                            <select
                                value={startDate}
                                onChange={(e) => {
                                    onStartDateChange(e.target.value);
                                    if (dateMode === 'single') onEndDateChange(e.target.value);
                                }}
                                className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
                            >
                                {dateRangeInfo.dates.map((d) => (<option key={d} value={d}>{d}</option>))}
                            </select>
                            {dateMode === 'range' && (
                                <>
                                    <span className="text-slate-500 text-xs">to</span>
                                    <select value={endDate} onChange={(e) => onEndDateChange(e.target.value)}
                                        className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white">
                                        {dateRangeInfo.dates.map((d) => (<option key={d} value={d}>{d}</option>))}
                                    </select>
                                </>
                            )}
                        </div>
                    ) : selectedTicker ? (<span className="text-slate-500 text-xs">No dates available</span>) : null}

                    <div className="flex items-center gap-1 ml-auto">
                        <Button variant="outline" size="sm" onClick={onOpenPaste}
                            className="border-teal-500 text-teal-400 hover:bg-teal-500/20 h-7 text-xs">
                            <Clipboard className="w-3 h-3 mr-1" />Paste New
                        </Button>
                        {analysisData && (
                            <>
                                <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="border-slate-600 h-7">
                                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                                </Button>
                                <Button variant="outline" size="sm" onClick={onDelete} className="border-red-500 text-red-400 h-7">
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            </>
                        )}
                    </div>
                </div>
                {message && (
                    <div className={`mt-2 p-1.5 rounded text-xs ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {message.text}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
