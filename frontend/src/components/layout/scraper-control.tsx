'use client';

import React, { useState } from 'react';
import { api } from '@/services/api';
import { Settings, Rocket, ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const ScraperControl = ({ isCollapsed }: { isCollapsed: boolean }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [source, setSource] = useState('EmitenNews');
    const [scrapeTicker, setScrapeTicker] = useState('');
    const [scrapeAllHistory, setScrapeAllHistory] = useState(false);

    // Use local time for default dates
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Format YYYY-MM-DD for input type="date"
    const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [startDate, setStartDate] = useState(formatDate(yesterday));
    const [endDate, setEndDate] = useState(formatDate(today));
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

    // Auto-close if sidebar collapses
    React.useEffect(() => {
        if (isCollapsed) setIsOpen(false);
    }, [isCollapsed]);

    const handleRunScraper = async () => {
        setLoading(true);
        setStatus({ type: 'info', message: `Menjalankan Scraper ${source}...` });
        try {
            const result = await api.runScraper(source, startDate, endDate, scrapeTicker, scrapeAllHistory);
            if (result.status === 'success') {
                setStatus({ type: 'success', message: result.message });
                // Reset status after 5 seconds
                setTimeout(() => setStatus(null), 5000);
            } else {
                setStatus({ type: 'error', message: result.error || 'Terjadi kesalahan saat scraping.' });
            }
        } catch (error) {
            setStatus({ type: 'error', message: 'Gagal menghubungi server backend.' });
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={cn(
            "mt-auto border-t border-zinc-900 pt-4",
            isCollapsed ? "px-0" : "px-2"
        )}>
            <button
                onClick={() => !isCollapsed && setIsOpen(!isOpen)}
                title={isCollapsed ? "Scraper Engine" : undefined}
                className={cn(
                    "w-full flex items-center p-2 rounded-lg transition-colors group text-zinc-400 hover:text-zinc-200",
                    isCollapsed ? "justify-center" : "justify-between hover:bg-zinc-900"
                )}
            >
                <div className="flex items-center gap-2">
                    <Settings className={cn(
                        "transition-transform duration-500",
                        isCollapsed ? "w-5 h-5" : "w-4 h-4",
                        isOpen && "rotate-90"
                    )} />
                    {!isCollapsed && (
                        <span className="text-xs font-bold uppercase tracking-widest animate-in fade-in duration-300">Scraper Engine</span>
                    )}
                </div>
                {!isCollapsed && (
                    isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />
                )}
            </button>

            {isOpen && !isCollapsed && (
                <div className="mt-2 space-y-3 bg-zinc-900/30 p-3 rounded-xl border border-zinc-900/50 backdrop-blur-sm animate-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight">Pilih Sumber:</label>
                        <select
                            value={source}
                            onChange={(e) => setSource(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-lg p-2 outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="EmitenNews">EmitenNews</option>
                            <option value="CNBC Indonesia">CNBC Indonesia</option>
                            <option value="Bisnis.com">Bisnis.com</option>
                            <option value="Investor.id">Investor.id</option>
                            <option value="IDX (Keterbukaan Informasi)">IDX (Keterbukaan Informasi)</option>
                        </select>
                    </div>

                    {source === "IDX (Keterbukaan Informasi)" && (
                        <>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight">Ticker (Optional):</label>
                                <Input
                                    placeholder="e.g. BBRI"
                                    value={scrapeTicker}
                                    onChange={(e) => setScrapeTicker(e.target.value.toUpperCase())}
                                    className="h-8 bg-zinc-950 border-zinc-800 text-xs"
                                />
                            </div>
                            {scrapeTicker && (
                                <div className="flex items-center gap-2 px-1">
                                    <input
                                        type="checkbox"
                                        id="allHistory"
                                        checked={scrapeAllHistory}
                                        onChange={(e) => setScrapeAllHistory(e.target.checked)}
                                        className="rounded border-zinc-800 bg-zinc-950 text-blue-500 w-3 h-3"
                                    />
                                    <label htmlFor="allHistory" className="text-[10px] text-zinc-400">Scrape All History</label>
                                </div>
                            )}
                        </>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight">Dari:</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 text-[10px] rounded p-1.5 outline-none [color-scheme:dark]"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight">Sampai:</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 text-[10px] rounded p-1.5 outline-none [color-scheme:dark]"
                            />
                        </div>
                    </div>

                    <Button
                        onClick={handleRunScraper}
                        disabled={loading}
                        className="w-full h-9 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-2 shadow-lg shadow-blue-900/20"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Rocket className="w-4 h-4" />
                        )}
                        MULAI CARI BERITA
                    </Button>

                    {status && (
                        <div className={cn(
                            "p-2 rounded-lg text-[10px] flex items-start gap-2 animate-in fade-in duration-300",
                            status.type === 'success' ? "bg-emerald-900/20 text-emerald-400 border border-emerald-900/50" :
                                status.type === 'error' ? "bg-rose-900/20 text-rose-400 border border-rose-900/50" :
                                    "bg-blue-900/20 text-blue-400 border border-blue-900/50"
                        )}>
                            {status.type === 'success' ? <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0" /> :
                                status.type === 'error' ? <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" /> :
                                    <Loader2 className="w-3 h-3 mt-0.5 shrink-0 animate-spin" />}
                            <span>{status.message}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
