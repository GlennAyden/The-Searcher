'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { useFilter } from '@/context/filter-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { cleanTickerSymbol } from '@/lib/string-utils';

export const TickerCloud = () => {
    const { ticker: activeTicker, setTicker } = useFilter();
    const [signals, setSignals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSignals = async () => {
            setLoading(true);
            try {
                const response = await api.getNeoBDMHotList();
                // Clean symbols before storing
                const cleanedSignals = (response.signals || []).map(s => ({
                    ...s,
                    symbol: cleanTickerSymbol(s.symbol)
                }));
                setSignals(cleanedSignals);
            } catch (error) {
                console.error("Failed to fetch hot signals:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSignals();
    }, []);

    if (loading) {
        return (
            <Card className="bg-zinc-950/50 border-zinc-900 backdrop-blur-sm h-full min-h-[200px] flex items-center justify-center">
                <p className="text-zinc-600 font-mono text-xs animate-pulse tracking-[0.2em] uppercase">Calculating Flow Scores...</p>
            </Card>
        );
    }

    if (signals.length === 0) {
        return (
            <Card className="bg-zinc-950/50 border-zinc-900 backdrop-blur-sm h-full min-h-[200px] flex items-center justify-center">
                <p className="text-zinc-600 italic text-xs">No interesting flow signals today.</p>
            </Card>
        );
    }

    // Function to calculate font size based on signal_score
    const getFontSize = (score: number) => {
        const maxScore = Math.max(...signals.map(s => s.signal_score));
        const minScore = Math.min(...signals.map(s => s.signal_score));
        const minSize = 12;
        const maxSize = 34; // Slightly smaller to fit 20 tickers nicely

        if (maxScore === minScore) return minSize + (maxSize - minSize) / 2;
        const size = minSize + ((score - minScore) / (maxScore - minScore)) * (maxSize - minSize);
        return size;
    };

    return (
        <Card className="bg-zinc-950/50 border-zinc-900 backdrop-blur-sm shadow-xl h-full overflow-hidden">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em]">
                    Market Hotspots (Top Signals)
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 p-6">
                {signals.map((item) => (
                    <motion.button
                        key={item.symbol}
                        whileHover={{ scale: 1.1, filter: 'brightness(1.5)' }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                            if (activeTicker === item.symbol) {
                                setTicker('All');
                            } else {
                                setTicker(item.symbol);
                            }
                        }}
                        className={`group transition-all duration-300 flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer ${activeTicker === item.symbol
                            ? 'text-blue-400 font-black drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                            : 'text-zinc-400 font-medium hover:text-zinc-200'
                            }`}
                        style={{ fontSize: `${getFontSize(item.signal_score)}px` }}
                        title={`Score: ${item.signal_score} | Strength: ${item.signal_strength}`}
                    >
                        <span>{item.symbol}</span>
                        <span className="text-[0.6em] opacity-50 group-hover:opacity-100 transition-opacity">
                            {item.momentum_icon}
                        </span>
                    </motion.button>
                ))}
            </CardContent>
        </Card>
    );
};
