'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Search, Loader2, Download, CheckCircle2, AlertCircle } from "lucide-react";

interface HistoricalScraperProps {
    availableTickers: string[];
    onScrapeSuccess?: () => void;
}

interface ProgressItem {
    date: string;
    count: number;
    status: 'pending' | 'scraping' | 'success' | 'error';
}

export function HistoricalScraper({ availableTickers, onScrapeSuccess }: HistoricalScraperProps) {
    const [ticker, setTicker] = useState("");
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [isScraping, setIsScraping] = useState(false);
    const [progress, setProgress] = useState<ProgressItem[]>([]);
    const [error, setError] = useState<string | null>(null);

    const [showSuggestions, setShowSuggestions] = useState(false);

    const handleScrape = async () => {
        if (!ticker) {
            setError("Please enter a ticker symbol.");
            return;
        }

        if (!availableTickers.some(t => t.toUpperCase() === ticker.toUpperCase())) {
            setError("Invalid Ticker. Please select from the suggestions.");
            return;
        }

        setIsScraping(true);
        setError(null);
        setProgress([]);

        const start = new Date(startDate);
        const end = new Date(endDate);
        const dates: string[] = [];

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            // Skip weekends
            if (d.getDay() !== 0 && d.getDay() !== 6) {
                dates.push(new Date(d).toISOString().split('T')[0]);
            }
        }

        if (dates.length === 0) {
            setError("No trading days in selected range.");
            setIsScraping(false);
            return;
        }

        for (const date of dates) {
            setProgress(prev => [...prev, { date, status: 'pending', count: 0 }]);

            try {
                setProgress(prev => prev.map(p => p.date === date ? { ...p, status: 'scraping' } : p));

                const res = await fetch(`http://localhost:8000/api/rt/scrape-history?ticker=${ticker.toUpperCase()}&date=${date}`, {
                    method: 'POST'
                });
                const data = await res.json();

                if (data.status === 'success') {
                    setProgress(prev => prev.map(p => p.date === date ? { ...p, status: 'success', count: data.count } : p));
                    if (onScrapeSuccess) onScrapeSuccess();
                } else {
                    throw new Error(data.error || "Unknown error");
                }
            } catch (e: any) {
                setProgress(prev => prev.map(p => p.date === date ? { ...p, status: 'error' } : p));
                setError(`Failed at ${date}: ${e.message}`);
                // Continue with next dates? Or stop? 
                // Let's continue but keep error visible.
            }

            // Polite delay between days
            await new Promise(r => setTimeout(r, 1000));
        }

        setIsScraping(false);
    };

    return (
        <Card className="bg-zinc-900/80 border-zinc-800 backdrop-blur-xl">
            <CardHeader className="border-b border-zinc-800 pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-amber-400">
                    <Download className="w-5 h-5" />
                    Historical RT Scraper
                </CardTitle>
                <p className="text-xs text-gray-500">Fetch full-day (08:58 - 16:00) trade records including Buyer/Seller data.</p>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Ticker</label>
                        <div className="relative">
                            <Input
                                placeholder="Search Ticker..."
                                value={ticker}
                                onChange={(e) => {
                                    setTicker(e.target.value.toUpperCase());
                                    setShowSuggestions(true);
                                }}
                                onFocus={() => setShowSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                className="bg-black border-zinc-700 font-mono font-bold text-white uppercase"
                            />
                            {showSuggestions && (
                                <div className="absolute top-full left-0 mt-1 w-full max-h-48 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 py-1 custom-scrollbar">
                                    {availableTickers
                                        .filter(t => !ticker || t.toUpperCase().includes(ticker.toUpperCase()))
                                        .slice(0, 100)
                                        .map(t => (
                                            <button
                                                key={t}
                                                className="w-full text-left px-3 py-2 text-xs hover:bg-amber-600/50 hover:text-white text-zinc-300 font-mono font-bold transition-colors uppercase"
                                                onClick={() => {
                                                    setTicker(t.toUpperCase());
                                                    setShowSuggestions(false);
                                                }}
                                            >
                                                {t}
                                            </button>
                                        ))
                                    }
                                    {availableTickers.filter(t => t.includes(ticker)).length === 0 && (
                                        <div className="px-3 py-2 text-[10px] text-zinc-600 italic">No matches found</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">From Date</label>
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-black border-zinc-700 text-sm h-10 select-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">To Date</label>
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-black border-zinc-700 text-sm h-10"
                        />
                    </div>
                </div>

                {error && (
                    <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <Button
                    onClick={handleScrape}
                    disabled={isScraping}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold h-12 shadow-lg shadow-amber-900/20"
                >
                    {isScraping ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            SCRAPING IN PROGRESS...
                        </>
                    ) : (
                        <>
                            <Download className="w-5 h-5 mr-2" />
                            START HISTORICAL SCRAPE
                        </>
                    )}
                </Button>

                {progress.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-zinc-800">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Scrape Queue</p>
                        <div className="max-h-48 overflow-y-auto pr-2 space-y-1 custom-scrollbar">
                            {progress.map((p, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 rounded bg-black/40 text-xs border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <Calendar className="w-3 h-3 text-gray-600" />
                                        <span className="font-mono font-medium">{p.date}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {p.status === 'success' && <span className="text-gray-500 mr-2">{p.count} trades</span>}
                                        {p.status === 'pending' && <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />}
                                        {p.status === 'scraping' && <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />}
                                        {p.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                        {p.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
