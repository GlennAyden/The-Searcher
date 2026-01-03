'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { useFilter } from '@/context/filter-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';

export const TickerCloud = () => {
    const { ticker: activeTicker, setTicker, dateRange } = useFilter();
    const [counts, setCounts] = useState<{ ticker: string, count: number }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCounts = async () => {
            setLoading(true);
            try {
                // For the cloud, we usually want to see ALL tickers even if one is selected in global filter,
                // OR we want to see relative tickers. Let's pass undefined for ticker to see general trends.
                const data = await api.getTickerCounts(undefined, dateRange.start, dateRange.end);
                setCounts(data);
            } catch (error) {
                console.error("Failed to fetch ticker counts:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchCounts();
    }, [dateRange]);

    if (loading) {
        return (
            <Card className="bg-zinc-950/50 border-zinc-900 backdrop-blur-sm h-full min-h-[200px] flex items-center justify-center">
                <p className="text-zinc-600 font-mono text-xs animate-pulse tracking-[0.2em] uppercase">Analyzing Ticker Flows...</p>
            </Card>
        );
    }

    if (counts.length === 0) {
        return (
            <Card className="bg-zinc-950/50 border-zinc-900 backdrop-blur-sm h-full min-h-[200px] flex items-center justify-center">
                <p className="text-zinc-600 italic text-xs">No ticker data found for this period.</p>
            </Card>
        );
    }

    // Function to calculate font size based on count
    const getFontSize = (count: number) => {
        const maxCount = Math.max(...counts.map(c => c.count));
        const minCount = Math.min(...counts.map(c => c.count));
        const minSize = 12;
        const maxSize = 36;

        if (maxCount === minCount) return minSize + (maxSize - minSize) / 2;
        return minSize + ((count - minCount) / (maxCount - minCount)) * (maxSize - minSize);
    };

    return (
        <Card className="bg-zinc-950/50 border-zinc-900 backdrop-blur-sm shadow-xl h-full overflow-hidden">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em]">
                    Market Hotspots (Tickers)
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap justify-center items-center gap-3 p-6">
                {counts.map((item) => (
                    <motion.button
                        key={item.ticker}
                        whileHover={{ scale: 1.1, filter: 'brightness(1.5)' }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                            if (activeTicker === item.ticker) {
                                setTicker('All');
                            } else {
                                setTicker(item.ticker);
                            }
                        }}
                        className={`transition-all duration-300 px-2 py-1 rounded cursor-pointer ${activeTicker === item.ticker
                            ? 'text-blue-400 font-black drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                            : 'text-zinc-400 font-medium hover:text-zinc-200'
                            }`}
                        style={{ fontSize: `${getFontSize(item.count)}px` }}
                    >
                        {item.ticker}
                    </motion.button>
                ))}
            </CardContent>
        </Card>
    );
};
