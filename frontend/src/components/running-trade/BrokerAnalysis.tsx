import React, { useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Search, Loader2, MousePointer2, TrendingUp, TrendingDown, Users, Activity, Calendar, RefreshCw, LineChart, Database } from "lucide-react";
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Bar, Line, Area
} from 'recharts';

interface Trade {
    time?: string;
    trade_time?: string;
    stock_code?: string;
    symbol?: string;
    price: number;
    volume?: number;
    lot?: number;
    action?: string;
    type?: string;
    buyer?: string;
    seller?: string;
    buyer_broker_code?: string;
    buyer_type?: string;
    seller_broker_code?: string;
    seller_type?: string;
    scrape_date?: string;
}

interface BrokerAnalysisProps {
    ticker: string;
    onClose: () => void;
    initialDates?: string[];
}

const formatSummaryNum = (num: number) => {
    const val = Math.abs(num);
    if (val >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (val >= 1000) return (num / 1000).toFixed(1) + 'K';
    return Math.round(num).toLocaleString();
};

const CHART_COLORS = [
    '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981',
    '#ef4444', '#06b6d4', '#f97316', '#6366f1', '#eab308'
];

export function BrokerAnalysis({ ticker, onClose, initialDates }: BrokerAnalysisProps) {
    const [dates, setDates] = useState<string[]>(initialDates || [new Date().toISOString().split('T')[0]]);
    const [trades, setTrades] = useState<Trade[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasFetched, setHasFetched] = useState(false);
    const [selectedBrokers, setSelectedBrokers] = useState<string[]>([]);

    useEffect(() => {
        if (initialDates && initialDates.length > 0) setDates(initialDates);
    }, [initialDates]);

    useEffect(() => {
        if (ticker && dates.length > 0) handleFetch();
    }, [ticker, dates]);

    const handleFetch = async () => {
        setIsLoading(true);
        setError(null);
        setHasFetched(false);
        try {
            const dateQuery = dates.join(',');
            const res = await fetch(`http://localhost:8000/api/rt/analysis?ticker=${ticker}&dates=${dateQuery}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            const fetchedTrades = Array.isArray(data) ? data : (data.trades || []);
            setTrades(fetchedTrades);
            setHasFetched(true);

            if (fetchedTrades.length > 0 && selectedBrokers.length === 0) {
                // Auto-select top net buyer
                const stats: Record<string, number> = {};
                fetchedTrades.forEach((t: any) => {
                    const b = parseBroker(t, true).code;
                    const s = parseBroker(t, false).code;
                    const l = Number(t.lot || t.volume || 0);
                    if (b && b !== '-') stats[b] = (stats[b] || 0) + l;
                    if (s && s !== '-') stats[s] = (stats[s] || 0) - l;
                });
                const top = Object.entries(stats).sort((a, b) => b[1] - a[1])[0];
                if (top) setSelectedBrokers([top[0]]);
            }
        } catch (e: any) {
            setError(e.message || "Failed to fetch data");
        } finally {
            setIsLoading(false);
        }
    };

    const parseBroker = (trade: Trade, isBuyer: boolean) => {
        const raw = isBuyer ? (trade.buyer || trade.buyer_broker_code) : (trade.seller || trade.seller_broker_code);
        const typeRaw = isBuyer ? trade.buyer_type : trade.seller_type;
        if (!raw || raw === '-') return { code: '', type: '' };
        const match = raw.match(/\[(\w+)\]\s*(\w+)|(\w+)\s*\[(\w+)\]/);
        if (match) {
            const type = (match[1] || match[4]).toUpperCase().substring(0, 1);
            const code = (match[2] || match[3]).toUpperCase();
            return { code, type };
        }
        let type = '';
        if (typeRaw) {
            if (typeRaw.includes('LOCAL')) type = 'D';
            else if (typeRaw.includes('FOREIGN')) type = 'F';
        }
        return { code: raw.toUpperCase(), type };
    };

    const brokerStats = useMemo(() => {
        const stats: Record<string, { buy: number, sell: number, type: string, buy_count: number, sell_count: number }> = {};
        trades.forEach(t => {
            const b = parseBroker(t, true);
            const s = parseBroker(t, false);
            const lot = Number(t.lot || t.volume || 0);
            if (b.code) {
                if (!stats[b.code]) stats[b.code] = { buy: 0, sell: 0, type: b.type, buy_count: 0, sell_count: 0 };
                stats[b.code].buy += lot;
                stats[b.code].buy_count++;
            }
            if (s.code) {
                if (!stats[s.code]) stats[s.code] = { buy: 0, sell: 0, type: s.type, buy_count: 0, sell_count: 0 };
                stats[s.code].sell += lot;
                stats[s.code].sell_count++;
            }
        });
        const list = Object.entries(stats).map(([code, data]) => {
            const total = data.buy + data.sell;
            const count = data.buy_count + data.sell_count;
            return {
                code, ...data, net: data.buy - data.sell,
                avg_size: count > 0 ? (total / count) : 0,
                buy_ratio: total > 0 ? (data.buy / total) : 0
            };
        }).sort((a, b) => b.net - a.net);

        return {
            all: list,
            topBuyers: list.filter(x => x.net > 0).slice(0, 10),
            topSellers: [...list].sort((a, b) => a.net - b.net).filter(x => x.net < 0).slice(0, 10)
        };
    }, [trades]);

    const timelineData = useMemo(() => {
        const buckets: Record<string, any> = {};
        const sortedDates = [...dates].sort();

        // Initialize cumulative trackers
        const cumulative: Record<string, number> = {};
        selectedBrokers.forEach(code => cumulative[code] = 0);

        sortedDates.forEach(d => {
            const dateStr = d.trim();
            for (let h = 9; h <= 16; h++) {
                for (let m = 0; m < 60; m += 15) {
                    if (h === 16 && m > 15) break;
                    if (h === 12 && m > 0 && m < 60) continue; // Skip Break time roughly

                    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                    const key = `${dateStr} ${timeStr}`;
                    buckets[key] = {
                        time: key,
                        displayTime: timeStr,
                        date: dateStr,
                        price: 0
                    };
                    selectedBrokers.forEach(code => {
                        buckets[key][`${code}_buy`] = 0;
                        buckets[key][`${code}_sell`] = 0;
                        buckets[key][`${code}_net_cumulative`] = 0;
                    });
                }
            }
        });

        trades.forEach(t => {
            const bCode = parseBroker(t, true).code;
            const sCode = parseBroker(t, false).code;
            const lot = Number(t.lot || t.volume || 0);
            const price = Number(t.price || 0);

            // Use scrape_date from DB, fallback to parsing trade_time
            let actualDate = (t.scrape_date || '').trim();
            if (!actualDate && dates.length === 1) actualDate = dates[0].trim();

            const rawTime = (t.trade_time || t.time || '');
            const hms = rawTime.includes(' ') ? rawTime.split(' ')[1] : rawTime;

            if (!hms || !actualDate) return;

            const timeParts = hms.split(':');
            const h = parseInt(timeParts[0]);
            const m = parseInt(timeParts[1]);
            if (isNaN(h) || isNaN(m)) return;

            const mBucket = Math.floor(m / 15) * 15;
            const bucketTime = `${h.toString().padStart(2, '0')}:${mBucket.toString().padStart(2, '0')}`;
            const key = `${actualDate} ${bucketTime}`;

            if (buckets[key]) {
                if (selectedBrokers.includes(bCode)) buckets[key][`${bCode}_buy`] += lot;
                if (selectedBrokers.includes(sCode)) buckets[key][`${sCode}_sell`] += lot;
                // Accumulate latest price for this bucket
                buckets[key].price = price;
            }
        });

        // Convert to sorted list
        const list = Object.values(buckets).sort((a: any, b: any) => a.time.localeCompare(b.time));

        let lastPrice = 0;
        return list.map((b: any) => {
            selectedBrokers.forEach(code => {
                const bucketNet = b[`${code}_buy`] - b[`${code}_sell`];
                cumulative[code] = (cumulative[code] || 0) + bucketNet;
                b[`${code}_net_cumulative`] = cumulative[code];
            });

            if (b.price > 0) lastPrice = b.price;
            else b.price = lastPrice;

            return b;
        });
    }, [trades, selectedBrokers, dates]);

    const toggleBroker = (code: string) => {
        setSelectedBrokers(prev => {
            if (prev.includes(code)) return prev.filter(c => c !== code);
            if (prev.length >= 10) return prev; // Limit to 10 for chart readability
            return [...prev, code];
        });
    };

    return (
        <div className="flex flex-col min-h-screen bg-black text-gray-100 font-sans pb-20 overflow-y-auto custom-scrollbar">
            {/* Header Area - Sticky for better navigation */}
            <div className="sticky top-0 z-50 flex items-center justify-between p-4 border-b border-white/10 bg-black/80 backdrop-blur-xl shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <h2 className="text-sm font-black tracking-tight text-white uppercase flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                            Analysis: {ticker}
                        </h2>
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest leading-none mt-1">
                            {dates.length > 1 ? `Multi-Day Aggregation (${dates.length} Days)` : 'Intraday Analysis Mode'}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden md:flex bg-zinc-900 border border-white/10 rounded-full px-4 py-1.5 items-center gap-3">
                        <Calendar className="w-3 h-3 text-zinc-500" />
                        <span className="text-[10px] text-blue-400 font-black font-mono">
                            {dates.length > 1 ? `${dates[0]} → ${dates[dates.length - 1]}` : dates[0]}
                        </span>
                    </div>
                    <Button onClick={handleFetch} disabled={isLoading} size="sm" className="bg-white text-black hover:bg-zinc-200 h-9 px-4 text-[10px] font-black rounded-full transition-all active:scale-95 shadow-lg">
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
                        SYNC DATA
                    </Button>
                </div>
            </div>

            <div className="flex flex-col space-y-8 p-6 max-w-[1600px] mx-auto w-full">
                {/* Horizontal Stats Bar */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-900/40 border-b border-white/5 shrink-0">
                    {/* Top Accumulators Horizontal */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-black text-green-500 uppercase">
                            <TrendingUp className="w-3.5 h-3.5" /> TOP ACCUMULATORS
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 invisible-scrollbar">
                            {brokerStats.topBuyers.slice(0, 6).map(b => (
                                <button key={b.code} onClick={() => toggleBroker(b.code)}
                                    className={`flex-1 min-w-[110px] flex flex-col p-4 rounded-xl border transition-all duration-300 relative overflow-hidden group ${selectedBrokers.includes(b.code) ? 'bg-green-500/10 border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.1)]' : 'bg-black/40 border-white/5 hover:border-white/20'}`}>
                                    <span className="text-xs font-black text-zinc-100 font-mono mb-1">{b.code}</span>
                                    <span className="text-lg font-black text-green-400 leading-none">{formatSummaryNum(b.net)}</span>
                                    {selectedBrokers.includes(b.code) && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-green-500 rounded-full" />}
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* Top Distributors Horizontal */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-black text-red-500 uppercase">
                            <TrendingDown className="w-3.5 h-3.5" /> TOP DISTRIBUTORS
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 invisible-scrollbar">
                            {brokerStats.topSellers.slice(0, 6).map(b => (
                                <button key={b.code} onClick={() => toggleBroker(b.code)}
                                    className={`flex-1 min-w-[110px] flex flex-col p-4 rounded-xl border transition-all duration-300 relative overflow-hidden group ${selectedBrokers.includes(b.code) ? 'bg-red-500/10 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'bg-black/40 border-white/5 hover:border-white/20'}`}>
                                    <span className="text-xs font-black text-zinc-100 font-mono mb-1">{b.code}</span>
                                    <span className="text-lg font-black text-red-400 leading-none">{formatSummaryNum(Math.abs(b.net))}</span>
                                    {selectedBrokers.includes(b.code) && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* THE BIG CHART AREA */}
                <div className="bg-[#050505] rounded-3xl border border-white/10 p-8 shadow-2xl relative min-h-[600px]">
                    <div className="absolute top-4 left-6 z-10 flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full border border-white/10 shadow-2xl">
                            <MousePointer2 className="w-3 h-3 text-blue-400" />
                            <span className="text-[10px] font-black uppercase tracking-tighter text-white">BROKER TIMELINE COMPARISON</span>
                        </div>
                        <div className="flex gap-1.5">
                            {selectedBrokers.map((code, i) => (
                                <span key={code} className="text-[9px] px-2 py-0.5 rounded-full border flex items-center gap-2 bg-black/80 backdrop-blur-sm" style={{ borderColor: `${CHART_COLORS[i % CHART_COLORS.length]}50` }}>
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                    <span className="font-bold text-white">{code}</span>
                                    <button onClick={() => toggleBroker(code)} className="hover:text-red-500 font-black ml-1">×</button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {selectedBrokers.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-zinc-700 italic gap-4">
                            <Search className="w-12 h-12 opacity-20" />
                            <span className="text-sm font-bold opacity-30">SELECT BROKERS TO BEGIN VISUALIZATION</span>
                        </div>
                    ) : (
                        <div className="h-[550px] w-full pt-14 px-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={timelineData}>
                                    <defs>
                                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                                    <XAxis
                                        dataKey="time"
                                        stroke="#444"
                                        fontSize={9}
                                        tickLine={false}
                                        axisLine={false}
                                        minTickGap={60}
                                        tickFormatter={(val) => {
                                            const parts = val.split(' ');
                                            if (parts.length < 2) return val;
                                            const [d, t] = parts;
                                            if (t === '09:00') return `${d.split('-').slice(1).join('/')} ${t}`;
                                            return t;
                                        }}
                                    />
                                    <YAxis yAxisId="left" stroke="#3f3f46" fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatSummaryNum} />
                                    <YAxis yAxisId="right" orientation="right" stroke="#6366f1" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgba(0,0,0,0.95)', border: '1px solid #27272a', borderRadius: '12px', fontSize: '11px', backdropFilter: 'blur(10px)' }}
                                        cursor={{ stroke: '#27272a', strokeWidth: 1 }}
                                    />
                                    <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', paddingBottom: '20px', opacity: 0.7 }} />

                                    <Area
                                        yAxisId="right"
                                        type="stepAfter"
                                        dataKey="price"
                                        name="STOCK PRICE"
                                        fill="url(#colorPrice)"
                                        stroke="#6366f1"
                                        strokeWidth={1.5}
                                        strokeDasharray="4 4"
                                    />

                                    {selectedBrokers.map((code, i) => (
                                        <Line
                                            yAxisId="left"
                                            key={code}
                                            type="monotone"
                                            dataKey={`${code}_net_cumulative`}
                                            name={`${code} NET FLOW`}
                                            stroke={CHART_COLORS[i % CHART_COLORS.length]}
                                            strokeWidth={3}
                                            dot={false}
                                            activeDot={{ r: 6, strokeWidth: 0 }}
                                            animationDuration={1000}
                                        />
                                    ))}
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* FOOTER PANELS */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
                    {/* Left: Identified Brokers */}
                    <div className="xl:col-span-1 flex flex-col bg-zinc-900/40 rounded-3xl border border-white/10 overflow-hidden shadow-2xl min-h-[500px]">
                        <div className="p-6 bg-white/5 border-b border-white/5 flex items-center justify-between">
                            <span className="flex items-center gap-3 text-xs font-black text-white tracking-widest leading-none">
                                <Users className="w-4 h-4 text-blue-500" /> IDENTIFIED BROKERS
                            </span>
                            <span className="bg-zinc-800 px-2 py-1 rounded text-[10px] font-mono text-zinc-400 border border-white/5">{brokerStats.all.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left">
                                <thead className="sticky top-0 bg-zinc-900 z-10">
                                    <tr className="text-[10px] font-black text-zinc-500 border-b border-white/10 uppercase tracking-tighter">
                                        <th className="p-4">BROKER</th>
                                        <th className="p-4 text-right">NET LOT</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {brokerStats.all.map(b => (
                                        <tr key={b.code}
                                            onClick={() => toggleBroker(b.code)}
                                            className={`cursor-pointer group transition-all duration-200 hover:bg-white/5 ${selectedBrokers.includes(b.code) ? 'bg-blue-500/5' : ''}`}>
                                            <td className="p-4 flex items-center gap-3">
                                                <div className={`w-1.5 h-4 rounded-full ${b.type === 'F' ? 'bg-amber-400' : 'bg-blue-500'}`} />
                                                <div className="flex flex-col">
                                                    <span className={`font-mono font-black text-sm ${selectedBrokers.includes(b.code) ? 'text-blue-400' : 'text-zinc-200 group-hover:text-white'}`}>{b.code}</span>
                                                </div>
                                            </td>
                                            <td className={`p-4 text-right font-mono font-black text-sm ${b.net > 0 ? 'text-green-500' : b.net < 0 ? 'text-red-500' : 'text-zinc-500'}`}>
                                                {formatSummaryNum(b.net)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Right: Detailed Tape */}
                    <div className="xl:col-span-2 flex flex-col bg-zinc-900/40 rounded-3xl border border-white/10 overflow-hidden shadow-2xl min-h-[500px]">
                        <div className="p-6 bg-white/5 border-b border-white/5 flex justify-between">
                            <span className="text-xs font-black text-white tracking-widest leading-none flex items-center gap-3">
                                <Activity className="w-4 h-4 text-amber-500" /> RELEVANT TAPE ENTRIES
                            </span>
                            <span className="text-[10px] text-zinc-500 font-bold uppercase italic">Filtered by current selection</span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-[10px] text-left border-collapse">
                                <thead className="sticky top-0 bg-zinc-900 text-zinc-500 font-bold uppercase z-10 shadow-sm border-b border-white/5">
                                    <tr>
                                        <th className="p-2">Time</th>
                                        <th className="p-2">Buyer</th>
                                        <th className="p-2 text-right">Price</th>
                                        <th className="p-2 text-right">Lot</th>
                                        <th className="p-2">Seller</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-[10px]">
                                    {trades
                                        .filter(t => selectedBrokers.length === 0 || (selectedBrokers.includes(parseBroker(t, true).code) || selectedBrokers.includes(parseBroker(t, false).code)))
                                        .slice(0, 200)
                                        .map((t, idx) => {
                                            const b = parseBroker(t, true);
                                            const s = parseBroker(t, false);
                                            const isBSelected = selectedBrokers.includes(b.code);
                                            const isSSelected = selectedBrokers.includes(s.code);

                                            return (
                                                <tr key={idx} className={`hover:bg-white/5 transition-colors ${isBSelected || isSSelected ? 'bg-white/5' : ''}`}>
                                                    <td className="p-2 text-zinc-500 font-mono">{(t.trade_time || t.time || '').split(' ').pop()}</td>
                                                    <td className={`p-2 font-mono font-bold ${isBSelected ? 'text-green-400 bg-green-500/10' : 'text-zinc-400'}`}>{b.code}</td>
                                                    <td className="p-2 text-right font-mono font-bold text-white">{t.price?.toLocaleString()}</td>
                                                    <td className="p-2 text-right font-mono font-bold text-sky-400">{(t.lot || t.volume || 0).toLocaleString()}</td>
                                                    <td className={`p-2 font-mono font-bold ${isSSelected ? 'text-red-400 bg-red-500/10' : 'text-zinc-400'}`}>{s.code}</td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
