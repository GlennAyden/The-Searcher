'use client';

import React from 'react';
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

interface Trade {
    id: string; // or trade_number
    time: string;
    price: number | string;
    action: 'buy' | 'sell';
    lot: number;
    value?: number;
}

interface LiveTapeProps {
    trades: Trade[];
}

export function LiveTape({ trades }: LiveTapeProps) {
    return (
        <div className="w-full h-full overflow-hidden flex flex-col bg-transparent">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-white/5 font-mono text-[10px] text-gray-500 uppercase tracking-tighter">
                <div className="w-16">Time</div>
                <div className="w-16 text-right">Price</div>
                <div className="w-14 text-center">Act</div>
                <div className="w-16 text-right">Lot</div>
                <div className="flex-1 text-right">Value</div>
            </div>

            {/* Rows */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">
                <AnimatePresence initial={false}>
                    {trades.map((trade, i) => (
                        <motion.div
                            key={`${trade.id}-${i}`}
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 hover:bg-white/5 transition-colors font-mono text-[11px]"
                        >
                            <div className="w-16 text-gray-500">{trade.time}</div>
                            <div className={`w-16 text-right font-bold ${trade.action === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                                {parseInt(String(trade.price).replace(/,/g, '')).toLocaleString()}
                            </div>
                            <div className="w-14 text-center">
                                <span className={`text-[9px] px-1 rounded ${trade.action === 'buy'
                                    ? 'bg-green-500/10 text-green-500'
                                    : 'bg-red-500/10 text-red-500'
                                    }`}>
                                    {trade.action.toUpperCase()}
                                </span>
                            </div>
                            <div className="w-16 text-right text-gray-400">
                                {trade.lot.toLocaleString()}
                            </div>
                            <div className="flex-1 text-right text-gray-600">
                                {trade.value ? `${(trade.value / 1000000).toFixed(1)}M` : '-'}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {trades.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-700 opacity-50">
                        <p className="text-[10px] uppercase tracking-widest">Waiting for stream...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
