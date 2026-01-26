'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    Target,
    Search,
    TrendingUp,
    Zap,
    SearchCheck,
    Calendar,
    BarChart3,
    History,
    MoreHorizontal,
    ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line
} from 'recharts';

// --- DUMMY DATA ---

const BROKER_PROFILE = {
    code: 'AK',
    name: 'Alpha Knights Securities',
    description: 'Specializes in infrastructure and energy sectors. High correlation with large-cap movements.',
    powerLevel: 85,
};

const STALKED_STOCKS = [
    { ticker: 'ANTM', streak: 8, netVal: '542.5B', status: 'Accumulation', avgPrice: 1540, lastChange: '+2.4%' },
    { ticker: 'TLKM', streak: 3, netVal: '1.2T', status: 'Big Player', avgPrice: 3820, lastChange: '-0.5%' },
    { ticker: 'BBRI', streak: 12, netVal: '2.8T', status: 'Whale Move', avgPrice: 5650, lastChange: '+1.2%' },
    { ticker: 'GOTO', streak: -2, netVal: '-150B', status: 'Distributing', avgPrice: 65, lastChange: '-3.1%' },
];

const DAILY_CHART_DATA = [
    { day: '01/01', buy: 120, sell: 45, net: 75 },
    { day: '01/02', buy: 95, sell: 80, net: 15 },
    { day: '01/03', buy: 150, sell: 30, net: 120 },
    { day: '01/04', buy: 110, sell: 120, net: -10 },
    { day: '01/05', buy: 200, sell: 50, net: 150 },
    { day: '01/06', buy: 180, sell: 40, net: 140 },
    { day: '01/07', buy: 220, sell: 60, net: 160 },
];

const DAILY_LOGS = [
    { date: '2026-01-08', ticker: 'ANTM', buy: '52.4B', sell: '12.1B', net: '40.3B', avg: 1565 },
    { date: '2026-01-07', ticker: 'ANTM', buy: '45.1B', sell: '5.2B', net: '39.9B', avg: 1540 },
    { date: '2026-01-06', ticker: 'ANTM', buy: '38.2B', sell: '18.4B', net: '19.8B', avg: 1525 },
    { date: '2026-01-05', ticker: 'ANTM', buy: '60.5B', sell: '2.1B', net: '58.4B', avg: 1510 },
];

export default function BrokerStalkerAdvanced() {
    const [selectedTicker, setSelectedTicker] = useState('ANTM');
    const [searchTerm, setSearchTerm] = useState('');

    const currentStock = useMemo(() =>
        STALKED_STOCKS.find(s => s.ticker === selectedTicker) || STALKED_STOCKS[0]
        , [selectedTicker]);

    return (
        <div className="min-h-screen bg-[#050507] text-slate-100 font-sans selection:bg-blue-500/30 overflow-x-hidden">
            {/* Background Grain/Glow */}
            <div className="fixed inset-0 pointer-events-none opacity-20">
                <div className="absolute top-[-20%] left-[-10%] w-full h-full bg-blue-600/20 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-20%] right-[-10%] w-full h-full bg-emerald-600/10 blur-[150px] rounded-full" />
            </div>

            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-white/5 bg-[#050507]/80 backdrop-blur-2xl px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.3)] border border-blue-400/30">
                        <Target className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
                            BROKER STALKER
                            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">ADVANCED</span>
                        </h1>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                            Tracking: <span className="text-white font-black">{BROKER_PROFILE.name} ({BROKER_PROFILE.code})</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative flex items-center bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 focus-within:border-blue-500/50 transition-all w-72 group">
                        <Search className="w-4 h-4 text-slate-500 mr-2" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                            placeholder="SWITCH BROKER..."
                            className="bg-transparent border-none outline-none text-xs font-bold w-full placeholder:text-slate-600 font-mono"
                        />
                        <div className="absolute right-3 px-1.5 py-0.5 bg-white/5 rounded border border-white/10 text-[8px] font-black text-slate-500">⌘ K</div>
                    </div>
                </div>
            </header>

            <main className="p-8 max-w-[1600px] mx-auto space-y-8">

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

                    {/* Left Panel: Portfolio / Stalked Stocks */}
                    <div className="xl:col-span-4 space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                <History className="w-4 h-4 text-blue-500" />
                                Target Portfolio
                            </h3>
                            <button className="p-1 px-2 hover:bg-white/5 rounded-lg border border-white/5 transition-colors">
                                <MoreHorizontal className="w-4 h-4 text-slate-500" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            {STALKED_STOCKS.map((stock) => (
                                <motion.div
                                    key={stock.ticker}
                                    whileHover={{ x: 5 }}
                                    onClick={() => setSelectedTicker(stock.ticker)}
                                    className={cn(
                                        "p-5 rounded-3xl border transition-all cursor-pointer group",
                                        selectedTicker === stock.ticker
                                            ? "bg-blue-600/10 border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.1)]"
                                            : "bg-[#0c0c0e] border-white/5 hover:border-white/10"
                                    )}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm",
                                                selectedTicker === stock.ticker ? "bg-blue-500 text-white" : "bg-white/5 text-slate-400"
                                            )}>
                                                {stock.ticker.substring(0, 2)}
                                            </div>
                                            <div>
                                                <div className="text-base font-black tracking-tight">{stock.ticker}</div>
                                                <div className="text-[10px] font-bold text-slate-500 uppercase">{stock.status}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={cn("text-xs font-black", stock.streak > 0 ? "text-emerald-400" : "text-red-400")}>
                                                {stock.streak > 0 ? `+${stock.streak}` : stock.streak} Days
                                            </div>
                                            <div className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">Streak</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-black/20 p-2 rounded-xl border border-white/5">
                                            <div className="text-[8px] font-black text-slate-600 uppercase mb-0.5">Net Val</div>
                                            <div className="text-xs font-bold text-slate-300">{stock.netVal}</div>
                                        </div>
                                        <div className="bg-black/20 p-2 rounded-xl border border-white/5">
                                            <div className="text-[8px] font-black text-slate-600 uppercase mb-0.5">Last Change</div>
                                            <div className={cn("text-xs font-bold", stock.lastChange.startsWith('+') ? "text-emerald-400" : "text-red-400")}>
                                                {stock.lastChange}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Right Panel: Advanced Analytics */}
                    <div className="xl:col-span-8 space-y-8">

                        {/* Summary Header */}
                        <div className="bg-gradient-to-br from-blue-600/20 to-transparent border border-blue-500/20 rounded-[2.5rem] p-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-10">
                                <Zap className="w-32 h-32 text-blue-500" />
                            </div>
                            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-3xl font-black">{selectedTicker} <span className="text-slate-500 font-medium">Surveillance</span></h2>
                                        <button className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
                                            <ExternalLink className="w-4 h-4 text-slate-400" />
                                        </button>
                                    </div>
                                    <p className="text-sm text-slate-400 max-w-md font-medium">
                                        Deep tracking for <span className="text-white font-bold">{BROKER_PROFILE.code}</span> activity. Current trend shows
                                        {currentStock.streak > 5 ? ' strong institutional accumulation' : ' fluctuating distribution patterns'}.
                                    </p>
                                </div>
                                <div className="flex gap-4">
                                    <div className="text-right">
                                        <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Total Net (30D)</div>
                                        <div className="text-2xl font-black text-emerald-400">{currentStock.netVal}</div>
                                    </div>
                                    <div className="w-1 px-4 border-r border-white/10" />
                                    <div className="text-right">
                                        <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Avg Buy Price</div>
                                        <div className="text-2xl font-black text-blue-400">Rp {currentStock.avgPrice.toLocaleString()}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Chart Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                            {/* Daily Volume Bar Chart */}
                            <div className="bg-[#0c0c0e] border border-white/5 rounded-[2rem] p-6 space-y-6">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <BarChart3 className="w-4 h-4 text-blue-500" />
                                        Buy vs Sell Volume (B)
                                    </h4>
                                    <div className="flex gap-4">
                                        <div className="flex items-center gap-1.5 pt-0.5">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                            <span className="text-[9px] font-black text-slate-600">BUY</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 pt-0.5">
                                            <div className="w-2 h-2 rounded-full bg-red-500" />
                                            <span className="text-[9px] font-black text-slate-600">SELL</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="h-[250px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={DAILY_CHART_DATA}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                                            <XAxis
                                                dataKey="day"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }}
                                            />
                                            <YAxis hide />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0c0c0e', border: '1px solid #ffffff10', borderRadius: '12px' }}
                                                itemStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}
                                            />
                                            <Bar dataKey="buy" fill="#10b981" radius={[4, 4, 0, 0]} barSize={12} />
                                            <Bar dataKey="sell" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={12} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Net Flow Area Chart */}
                            <div className="bg-[#0c0c0e] border border-white/5 rounded-[2rem] p-6 space-y-6">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                                        Cumulative Net Flow
                                    </h4>
                                    <div className="px-2 py-1 bg-emerald-500/10 rounded border border-emerald-500/20 text-[9px] font-black text-emerald-400">
                                        UPWARD TREND
                                    </div>
                                </div>

                                <div className="h-[250px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={DAILY_CHART_DATA}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                                            <XAxis
                                                dataKey="day"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }}
                                            />
                                            <YAxis hide />
                                            <Tooltip />
                                            <Line
                                                type="monotone"
                                                dataKey="net"
                                                stroke="#10b981"
                                                strokeWidth={3}
                                                dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
                                                activeDot={{ r: 6, strokeWidth: 0 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Data Table */}
                        <div className="bg-[#0c0c0e] border border-white/5 rounded-[2.5rem] overflow-hidden">
                            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-blue-500" />
                                    Daily Execution Ledger
                                </h4>
                                <SearchCheck className="w-4 h-4 text-slate-600" />
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-[9px] font-black text-slate-600 uppercase tracking-[0.1em] border-b border-white/5">
                                            <th className="p-6">Execution Date</th>
                                            <th className="p-6">Total Buy</th>
                                            <th className="p-6">Total Sell</th>
                                            <th className="p-6">Net Flow</th>
                                            <th className="p-6 text-right">Avg Price</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {DAILY_LOGS.map((log, i) => (
                                            <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="p-6 text-xs font-bold text-slate-400 font-mono">{log.date}</td>
                                                <td className="p-6 text-xs font-black text-emerald-400/80">{log.buy}</td>
                                                <td className="p-6 text-xs font-black text-red-400/80">{log.sell}</td>
                                                <td className="p-6">
                                                    <div className={cn(
                                                        "text-xs font-black px-2 py-1 rounded-lg inline-block",
                                                        log.net.startsWith('-') ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
                                                    )}>
                                                        {log.net}
                                                    </div>
                                                </td>
                                                <td className="p-6 text-right text-xs font-black text-slate-200">
                                                    Rp {log.avg.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Status */}
                <footer className="bg-white/[0.02] border border-white/10 rounded-full p-4 flex items-center justify-center gap-8">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-slate-500 uppercase">System Status: Optimal</span>
                    </div>
                    <div className="h-4 border-r border-white/10" />
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tracking accuracy: 99.2%</span>
                    </div>
                </footer>

            </main>
        </div>
    );
}
