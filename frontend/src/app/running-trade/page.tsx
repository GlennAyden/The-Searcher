'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, RotateCcw, Activity, Plus, X, List, Download } from "lucide-react";
import { LiveTape } from "@/components/running-trade/LiveTape";
import { PowerMeter } from "@/components/running-trade/PowerMeter";
import { NetVolumeChart } from "@/components/running-trade/NetVolumeChart";
import { HistoricalScraper } from "@/components/running-trade/HistoricalScraper";


interface TickerData {
    buyPower: number;
    sellPower: number;
    netVol: number;
    totalValue: number;
    lastPrice: string;
    tapeData: any[];
    chartData: { time: string; netVol: number }[];
}

interface RTSnapshot {
    id: number;
    ticker: string;
    interval_start: string;
    interval_end: string;
    buy_vol: number;
    sell_vol: number;
    net_vol: number;
    avg_price: number;
    status: string;
    big_order_count: number;
    conclusion: string;
}

const INITIAL_STATS = {
    buyPower: 50,
    sellPower: 50,
    netVol: 0,
    totalValue: 0,
    lastPrice: "0",
    tapeData: [],
    chartData: []
};

export default function RunningTradePage() {
    const [tickers, setTickers] = useState<string[]>(["BBCA"]);
    const [isRunning, setIsRunning] = useState(false);
    const [isLoginMode, setIsLoginMode] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tickerData, setTickerData] = useState<Record<string, TickerData>>({
        "BBCA": { ...INITIAL_STATS }
    });
    const [availableTickers, setAvailableTickers] = useState<string[]>([]);
    const [rtHistory, setRtHistory] = useState<Record<string, RTSnapshot[]>>({});
    const [suggestionText, setSuggestionText] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeTabs, setActiveTabs] = useState<Record<string, 'live' | 'history'>>({});
    const [isLoadingHistory, setIsLoadingHistory] = useState<Record<string, boolean>>({});
    const [showScraper, setShowScraper] = useState(false);

    // Auto-select tab logic removed as we don't need analysis trigger


    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch Ticker Universe
    useEffect(() => {
        const fetchUniverse = async () => {
            try {
                const res = await fetch('http://localhost:8000/api/rt/tickers');
                const data = await res.json();
                if (data.tickers) setAvailableTickers(data.tickers);
            } catch (e) {
                console.error("Failed to fetch tickers:", e);
            }
        };
        fetchUniverse();
    }, []);

    const fetchHistory = async () => {
        if (tickers.length === 0) return;

        // Mark which tickers are loading
        setIsLoadingHistory(prev => {
            const next = { ...prev };
            tickers.forEach(t => next[t] = true);
            return next;
        });

        const historyMap: Record<string, RTSnapshot[]> = {};
        try {
            for (const ticker of tickers) {
                try {
                    const res = await fetch(`http://localhost:8000/api/rt/history?ticker=${ticker}`);
                    const data = await res.json();
                    historyMap[ticker] = Array.isArray(data) ? data : [];
                } catch (e) {
                    console.error(`Failed to fetch history for ${ticker}:`, e);
                    historyMap[ticker] = [];
                }
            }
            setRtHistory(prev => ({ ...prev, ...historyMap }));
        } finally {
            setIsLoadingHistory(prev => {
                const next = { ...prev };
                tickers.forEach(t => next[t] = false);
                return next;
            });
        }
    };

    useEffect(() => {
        fetchHistory();
        const interval = setInterval(fetchHistory, 60000); // Check for history updates every min
        return () => clearInterval(interval);
    }, [tickers]);

    const pollData = async () => {
        if (tickers.length === 0) return;

        try {
            const tickersQuery = tickers.join(",");
            const res = await fetch(`http://localhost:8000/api/rt/stream?tickers=${tickersQuery}`);
            const data = await res.json();

            if (data && data.error) {
                setError(data.error);
                if (String(data.error).includes("401") || String(data.error).includes("403") || String(data.error).includes("502")) {
                    setIsRunning(false);
                    if (intervalRef.current) clearInterval(intervalRef.current);
                }
                return;
            }

            setError(null);
            if (data) {
                const timeStr = new Date().toLocaleTimeString('en-GB', { hour12: false });

                setTickerData(prev => {
                    const next = { ...prev };
                    tickers.forEach(t => {
                        const stats = data[t];
                        if (stats) {
                            const currentTickerData = next[t] || { ...INITIAL_STATS };

                            // Tape Logic
                            const formattedTrades = (stats.recent_trades || []).map((tr: any) => ({
                                id: tr.trade_number || tr.id || Math.random().toString(),
                                time: tr.time,
                                price: tr.price,
                                action: tr.action.toLowerCase(),
                                lot: typeof tr.lot === 'string' ? parseInt(tr.lot.replace(/,/g, '')) : tr.lot,
                                value: (parseFloat(String(tr.price).replace(/,/g, '')) * (typeof tr.lot === 'string' ? parseInt(tr.lot.replace(/,/g, '')) : tr.lot) * 100)
                            }));

                            next[t] = {
                                buyPower: stats.buy_power || 50,
                                sellPower: stats.sell_power || 50,
                                netVol: stats.net_vol || 0,
                                totalValue: stats.total_value || 0,
                                lastPrice: stats.last_price || "0",
                                tapeData: formattedTrades.slice(0, 30),
                                chartData: [
                                    ...(currentTickerData.chartData || []),
                                    { time: timeStr, netVol: stats.net_vol || 0 }
                                ].slice(-50)
                            };
                        }
                    });
                    return next;
                });
            }
        } catch (e) {
            console.error("Polling error:", e);
        }
    };

    const handleStart = async () => {
        try {
            setError(null);
            await fetch(`http://localhost:8000/api/rt/start?headless=false`, { method: 'POST' });
            setIsRunning(true);
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = setInterval(pollData, 1000);
        } catch (e) {
            setError("Failed to start stream: " + e);
        }
    };

    const handleLogin = async () => {
        try {
            setError(null);
            await fetch(`http://localhost:8000/api/rt/login`, { method: 'POST' });
            setIsLoginMode(true);
            setIsRunning(false);
            if (intervalRef.current) clearInterval(intervalRef.current);
        } catch (e) {
            setError("Failed to open login window: " + e);
        }
    };

    const handleSaveSession = async () => {
        try {
            const res = await fetch(`http://localhost:8000/api/rt/save-session`, { method: 'POST' });
            const data = await res.json();
            if (data.status === 'success') {
                alert("Session saved! You can now start the stream.");
                setIsLoginMode(false);
            } else {
                setError("Failed to save session: " + data.error);
            }
        } catch (e) {
            setError("Error saving session: " + e);
        }
    };

    const handleStop = async () => {
        try {
            await fetch(`http://localhost:8000/api/rt/stop`, { method: 'POST' });
            setIsRunning(false);
            if (intervalRef.current) clearInterval(intervalRef.current);
        } catch (e) {
            console.error(e);
        }
    };

    const handleReset = async () => {
        try {
            await fetch(`http://localhost:8000/api/rt/reset`, { method: 'POST' });
            const resetData: Record<string, TickerData> = {};
            tickers.forEach(t => { resetData[t] = { ...INITIAL_STATS }; });
            setTickerData(resetData);
        } catch (e) {
            console.error(e);
        }
    };

    const addTicker = (ticker: string) => {
        const cleanTicker = ticker.toUpperCase().trim();
        if (!cleanTicker || tickers.includes(cleanTicker) || tickers.length >= 3) return;

        setTickers([...tickers, cleanTicker]);
        setTickerData(prev => ({
            ...prev,
            [cleanTicker]: { ...INITIAL_STATS }
        }));
    };

    const removeTicker = (ticker: string) => {
        setTickers(tickers.filter(t => t !== ticker));
        setTickerData(prev => {
            const next = { ...prev };
            delete next[ticker];
            return next;
        });
    };

    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    return (
        <div className="min-h-screen bg-[#050505] text-gray-100 p-6 space-y-6">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center animate-pulse">
                            <Activity className="w-5 h-5 text-white" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-teal-400 to-indigo-400">
                            TRIPLE LIVE RUNNING TRADE
                        </h1>
                    </div>
                    <p className="text-sm text-gray-500 font-medium">Real-time Multi-Ticker Accumulation & Distribution Monitoring</p>
                </div>

                <div className="flex flex-wrap items-center gap-4 bg-white/5 p-2 rounded-xl border border-white/10">
                    <div className="flex items-center gap-2 px-2">
                        {tickers.map(t => (
                            <Badge key={t} variant="secondary" className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-2">
                                {t}
                                <button onClick={() => removeTicker(t)} className="hover:text-white">
                                    <X className="w-3 h-3" />
                                </button>
                            </Badge>
                        ))}
                        {tickers.length < 3 && (
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Add Ticker..."
                                    value={suggestionText}
                                    onChange={(e) => {
                                        setSuggestionText(e.target.value.toUpperCase());
                                        setShowSuggestions(true);
                                    }}
                                    className="bg-transparent border-none focus:ring-0 text-sm w-24 text-gray-400 outline-none"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const matches = availableTickers.filter(t => t.startsWith(suggestionText));
                                            if (matches.length > 0) {
                                                addTicker(matches[0]);
                                                setSuggestionText("");
                                                setShowSuggestions(false);
                                            } else if (suggestionText.length >= 4) {
                                                addTicker(suggestionText);
                                                setSuggestionText("");
                                                setShowSuggestions(false);
                                            }
                                        }
                                    }}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                />
                                <Plus className="w-3 h-3 absolute right-0 top-1.5 text-gray-600" />

                                {showSuggestions && suggestionText && (
                                    <div className="absolute top-full left-0 mt-2 w-48 max-h-60 overflow-y-auto bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl z-[100] py-1 scrollbar-hide">
                                        {availableTickers
                                            .filter(t => t.startsWith(suggestionText))
                                            .slice(0, 15)
                                            .map(t => (
                                                <button
                                                    key={t}
                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-blue-600/50 hover:text-white text-gray-400 transition-colors border-b border-white/5 last:border-0"
                                                    onClick={() => {
                                                        addTicker(t);
                                                        setSuggestionText("");
                                                        setShowSuggestions(false);
                                                    }}
                                                >
                                                    <span className="font-bold">{t}</span>
                                                </button>
                                            ))
                                        }
                                        {availableTickers.filter(t => t.startsWith(suggestionText)).length === 0 && (
                                            <div className="px-3 py-2 text-[10px] text-gray-600">No match found</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="h-8 w-[1px] bg-white/10 mx-2" />

                    <div className="flex items-center gap-3">
                        {isLoginMode ? (
                            <Button onClick={handleSaveSession} className="bg-blue-600 hover:bg-blue-700 text-white border-0">
                                Save Session
                            </Button>
                        ) : (
                            <Button onClick={handleLogin} variant="ghost" size="sm" className="text-gray-400 hover:text-white text-xs">
                                Fix Login
                            </Button>
                        )}

                        {!isRunning ? (
                            <Button onClick={handleStart} className="bg-green-600 hover:bg-green-700 text-white border-0 shadow-lg shadow-green-900/20">
                                <Play className="w-4 h-4 mr-2" /> Start Live
                            </Button>
                        ) : (
                            <Button onClick={handleStop} variant="outline" className="text-red-400 border-red-900/50 bg-red-950/20 hover:bg-red-950/40">
                                <Pause className="w-4 h-4 mr-2" /> Stop Live
                            </Button>
                        )}
                        <Button
                            onClick={() => setShowScraper(!showScraper)}
                            variant="ghost"
                            size="sm"
                            className={`text-xs h-8 ${showScraper ? 'text-amber-400 bg-amber-500/10' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Download className="w-4 h-4 mr-2" /> Scraper
                        </Button>

                        <Button onClick={handleReset} variant="ghost" size="icon" className="text-gray-500 hover:text-white">
                            <RotateCcw className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </header>

            {/* Historical Scraper Section */}
            {showScraper && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                    <HistoricalScraper availableTickers={availableTickers} />
                </div>
            )}

            {/* Error Banner */}
            {error && (
                <div className="bg-red-950/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm flex justify-between items-center backdrop-blur-md">
                    <span>
                        <span className="font-bold">Stream Error:</span> {error}
                    </span>
                    <Button onClick={handleLogin} size="sm" variant="outline" className="text-xs h-7 border-red-500/50 hover:bg-red-500/20">
                        Login Now
                    </Button>
                </div>
            )}

            {/* Matrix View */}
            <div className={`
                grid gap-6 
                ${tickers.length === 1 ? 'grid-cols-1' : ''}
                ${tickers.length === 2 ? 'grid-cols-2' : ''}
                ${tickers.length === 3 ? 'grid-cols-3' : ''}
            `}>
                {tickers.map(ticker => {
                    const data = tickerData[ticker] || INITIAL_STATS;
                    const isWide = tickers.length === 1;
                    const activeTab = activeTabs[ticker] || 'live';

                    return (
                        <Card key={ticker} className={`
                            bg-black/40 backdrop-blur-xl border-white/10 overflow-hidden flex flex-col shadow-2xl transition-all duration-500
                            ${isWide ? 'h-[75vh]' : 'h-[85vh]'}
                        `}>
                            <CardHeader className="border-b border-white/5 bg-white/5 py-3">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg">
                                            {ticker[0]}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <CardTitle className="text-xl font-bold text-white">{ticker}</CardTitle>
                                                {data.lastPrice === "N/A" && isRunning && (
                                                    <Badge variant="outline" className="text-[8px] bg-red-500/10 text-red-500 border-red-500/20 py-0">INVALID / NO DATA</Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 font-mono">Last Price: Rp {data.lastPrice}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-lg font-mono font-bold ${data.netVol >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {data.netVol > 0 ? '+' : ''}{data.netVol.toLocaleString()}
                                        </div>
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Net Volume (Lots)</p>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className={`flex-1 p-0 flex overflow-hidden ${isWide ? 'flex-row' : 'flex-col'}`}>
                                {/* Stats Section */}
                                <div className={`flex flex-col border-white/5 ${isWide ? 'w-[400px] border-r bg-black/20' : 'h-44 border-b'}`}>
                                    {/* ... existing stats code ... */}
                                    <div className={`flex-1 grid ${isWide ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                        <div className={`${isWide ? 'border-b border-white/5' : 'border-r border-white/5'}`}>
                                            <PowerMeter buyPower={data.buyPower} sellPower={data.sellPower} />
                                        </div>
                                        <div className="bg-white/5">
                                            <NetVolumeChart data={data.chartData} />
                                        </div>
                                    </div>

                                    {/* Info Row */}
                                    <div className="px-4 py-2 bg-black/40 flex justify-between text-[10px] font-mono border-t border-white/5 text-white/50">
                                        <span>VALUE: <span className="text-gray-300">Rp {(data.totalValue / 1000000000).toFixed(2)}B</span></span>
                                        <span className="flex items-center gap-1 uppercase">Live <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /></span>
                                    </div>
                                </div>

                                {/* Feed/History Section */}
                                <div className="flex-1 flex flex-col overflow-hidden">
                                    {/* Tab Navigation - Only Live/History here */}
                                    <div className="flex border-b border-white/10 bg-black/60">
                                        <button
                                            onClick={() => setActiveTabs(prev => ({ ...prev, [ticker]: 'live' }))}
                                            className={`flex-1 py-1.5 text-[9px] font-black tracking-[0.2em] transition-all uppercase ${activeTab === 'live' ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/10' : 'text-gray-600 hover:text-gray-400'}`}
                                        >
                                            LIVE TAPE FEED
                                        </button>
                                        <button
                                            onClick={() => setActiveTabs(prev => ({ ...prev, [ticker]: 'history' }))}
                                            className={`flex-1 py-1.5 text-[9px] font-black tracking-[0.2em] transition-all uppercase ${activeTab === 'history' ? 'text-amber-400 border-b-2 border-amber-500 bg-amber-500/10' : 'text-gray-600 hover:text-gray-400'}`}
                                        >
                                            INTERVAL HISTORY
                                        </button>
                                        {/* Hidden Analysis Button to keep logic if needed, but UI-wise separated? 
                                                   Actually user said "remove tab in live trade". So I just don't render it here.
                                                   The only way to get to Analysis is via Sidebar or a dedicated toggle I might add elsewhere? 
                                                   Or keep it but as a distinct toggle in the header? 
                                                   User said "tambahkan juga opsi untuk akses page running trade analysis di sidebar".
                                                   So Sidebar is the primary way. I will REMOVE the "BROKER ANALYSIS" tab from this list to satisfy "hapuskan juga tab nya".
                                                */}
                                    </div>

                                    {/* Content Area */}
                                    <div className="flex-1 overflow-hidden relative">
                                        {activeTab === 'live' ? (
                                            <LiveTape trades={data.tapeData} />
                                        ) : (
                                            <div className="absolute inset-0 bg-[#080808] overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                                {/* History Logic */}
                                                <>
                                                    {isLoadingHistory[ticker] && (!rtHistory[ticker] || rtHistory[ticker].length === 0) ? (
                                                        <div className="flex flex-col items-center justify-center h-full text-blue-500/50 py-10">
                                                            <RotateCcw className="w-10 h-10 mb-3 animate-spin" />
                                                            <p className="text-[10px] uppercase font-black tracking-widest">Fetching Snapshot Data...</p>
                                                        </div>
                                                    ) : (!rtHistory[ticker] || rtHistory[ticker].length === 0) ? (
                                                        <div className="flex flex-col items-center justify-center h-full text-gray-700 py-10">
                                                            <Activity className="w-10 h-10 mb-3 opacity-20" />
                                                            <p className="text-[10px] uppercase font-black tracking-widest opacity-40">No snapshots found for {ticker}</p>
                                                        </div>
                                                    ) : null}

                                                    {Array.isArray(rtHistory[ticker]) && rtHistory[ticker].map((snap) => (
                                                        <div key={snap.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 space-y-3 group/snap hover:bg-white/[0.05] hover:border-blue-500/30 transition-all duration-300">
                                                            {/* ... existing history card content ... */}
                                                            <div className="flex justify-between items-center">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-2 h-2 rounded-full ${snap.status === 'Bullish' ? 'bg-green-500' : snap.status === 'Bearish' ? 'bg-red-500' : 'bg-gray-500'}`} />
                                                                    <span className={`text-[10px] font-black tracking-widest uppercase ${snap.status === 'Bullish' ? 'text-green-400' : snap.status === 'Bearish' ? 'text-red-400' : 'text-gray-400'}`}>
                                                                        {snap.status}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[10px] text-gray-500 font-mono font-bold bg-white/5 px-2 py-0.5 rounded text-white/40">
                                                                    {new Date(snap.interval_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div className="bg-black/60 rounded-lg p-2.5 border border-white/[0.02]">
                                                                    <p className="text-[8px] text-gray-600 uppercase font-black mb-1">Net Flow</p>
                                                                    <p className={`text-sm font-mono font-bold ${snap.net_vol >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                        {snap.net_vol > 0 ? '+' : ''}{snap.net_vol.toLocaleString()}
                                                                    </p>
                                                                </div>
                                                                <div className="bg-black/60 rounded-lg p-2.5 border border-white/[0.02] text-right">
                                                                    <p className="text-[8px] text-gray-600 uppercase font-black mb-1">Big Orders</p>
                                                                    <p className={`text-sm font-mono font-bold ${snap.big_order_count > 0 ? 'text-amber-400 underline underline-offset-4 decoration-amber-500/30' : 'text-gray-600'}`}>
                                                                        {snap.big_order_count}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="bg-blue-500/[0.03] rounded-lg p-3 border border-blue-500/10 group-hover/snap:border-blue-500/30 transition-colors">
                                                                <p className="text-xs text-gray-400 leading-relaxed italic font-medium">
                                                                    <span className="text-blue-500 mr-2 text-lg leading-none select-none">“</span>
                                                                    {snap.conclusion}
                                                                    <span className="text-blue-500 ml-1 text-lg leading-none select-none">”</span>
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}

                {tickers.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center h-[50vh] text-gray-600 border-2 border-dashed border-white/5 rounded-3xl">
                        <List className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-lg font-medium">No tickers selected</p>
                        <p className="text-sm">Add up to 3 tickers above to start monitoring</p>
                    </div>
                )}
            </div>
        </div>
    );
}

