
"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, TrendingUp, AlertCircle, ArrowRight, Zap } from 'lucide-react';
import { neobdmApi, forecastingApi } from '@/services/api'; // Ensure forecastingApi is exported from @/services/api
import { cn } from '@/lib/utils';
import { useApi } from '@/hooks/useApi';
import { ForecastingCard } from '@/components/cards/ForecastingCard';
import { HybridChart } from '@/components/charts/HybridChart';

// Component for Hot Signal Chips
const QuickPickChip = ({ signal, onClick }: { signal: any, onClick: (symbol: string) => void }) => {
    return (
        <button
            onClick={() => onClick(signal.symbol)}
            className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/50 border border-zinc-800 hover:border-blue-500/50 hover:bg-blue-500/10 transition-all"
        >
            <span className="text-[10px] font-black text-zinc-300 group-hover:text-blue-300">
                {signal.symbol.replace('★', '').replace('⭐', '')}
            </span>
            <span className={cn(
                "text-[10px] font-bold tabular-nums",
                signal.signal_score >= 80 ? "text-emerald-400" :
                    signal.signal_score >= 50 ? "text-blue-400" : "text-amber-400"
            )}>
                {signal.signal_score}
            </span>
        </button>
    );
};

export default function ForecastingPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeSymbol, setActiveSymbol] = useState<string | null>(null);
    const [forecastData, setForecastData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [hotPicks, setHotPicks] = useState<any[]>([]);

    const { execute: fetchHotList } = useApi(neobdmApi.getNeoBDMHotList);
    const { execute: fetchForecast } = useApi(forecastingApi.getForecast);

    // Load Hot Picks on Mount
    useEffect(() => {
        const loadHotPicks = async () => {
            try {
                const data = await fetchHotList(); // Returns { signals: [...] } now based on interface
                if (data && Array.isArray(data)) {
                    setHotPicks(data.slice(0, 8));
                } else if (data && data.signals) {
                    setHotPicks(data.signals.slice(0, 8));
                }
            } catch (err) {
                console.error("Failed to load hot picks", err);
            }
        };
        loadHotPicks();
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm) return;
        loadForecast(searchTerm);
    };

    const loadForecast = async (symbol: string) => {
        setLoading(true);
        setActiveSymbol(symbol);
        setForecastData(null); // Clear previous

        try {
            console.log(`Fetching forecast for ${symbol}...`);
            const data = await fetchForecast(symbol);
            setForecastData(data);
        } catch (error) {
            console.error("Error fetching forecast:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-zinc-100 p-6 space-y-8 overflow-x-hidden font-sans selection:bg-blue-500/30">

            {/* Header & Search Section */}
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
                        WAR ROOM
                    </h1>
                    <p className="text-zinc-500 text-sm">Advanced Flow & Technical Projection System</p>
                </div>

                {/* Search Bar */}
                <div className="relative max-w-xl mx-auto group">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur-lg group-hover:blur-xl transition-all opacity-50" />
                    <form onSubmit={handleSearch} className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                            placeholder="Enter Stock Ticker (e.g. BBCA)"
                            className="w-full bg-zinc-900/80 border border-zinc-800 text-white placeholder:text-zinc-600 px-6 py-4 pl-12 rounded-xl focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all font-bold text-lg tracking-wider"
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                        <button
                            type="submit"
                            className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg transition-colors"
                        >
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </form>
                </div>

                {/* Quick Picks */}
                <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                        <Zap className="w-3 h-3 text-amber-500" />
                        Quick Picks (Hot Signals)
                    </div>
                    <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
                        {hotPicks.map((signal) => (
                            <QuickPickChip
                                key={signal.symbol}
                                signal={signal}
                                onClick={(s) => {
                                    setSearchTerm(s.replace('★', '').replace('⭐', ''));
                                    loadForecast(s.replace('★', '').replace('⭐', ''));
                                }}
                            />
                        ))}
                        {hotPicks.length === 0 && (
                            <div className="text-zinc-700 text-xs italic">Loading hot signals...</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="max-w-6xl mx-auto min-h-[400px]">
                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center h-64 space-y-4"
                        >
                            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                            <p className="text-zinc-500 text-sm animate-pulse">Running Technical Projection...</p>
                        </motion.div>
                    ) : forecastData ? (
                        <motion.div
                            key="result"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
                        >
                            {/* Left: Chart Area */}
                            <div className="lg:col-span-2 h-[500px]">
                                <HybridChart
                                    data={forecastData.chart_data}
                                    supports={forecastData.technical_analysis.supports}
                                    resistances={forecastData.technical_analysis.resistances}
                                    tradePlan={forecastData.trade_plan}
                                />
                            </div>

                            {/* Right: Forecasting Card */}
                            <div>
                                <ForecastingCard
                                    plan={forecastData.trade_plan}
                                    symbol={forecastData.symbol}
                                    className="h-full"
                                />
                            </div>
                        </motion.div>
                    ) : (
                        // Empty State
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center h-[400px] text-zinc-600 gap-4"
                        >
                            <Search className="w-16 h-16 opacity-20" />
                            <p className="text-sm font-medium">Select a Quick Pick or Search to analyze</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
