'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Info, RefreshCcw, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FloorPriceAnalysis } from '@/services/api/neobdm';

type FloorPriceSectionProps = {
    ticker: string;
    floorPriceDays: number;
    onFloorPriceDaysChange: (days: number) => void;
    loading: boolean;
    floorPriceData: FloorPriceAnalysis | null;
    formatNumber: (value: unknown, digits?: number) => string;
};

export function FloorPriceSection({
    ticker,
    floorPriceDays,
    onFloorPriceDaysChange,
    loading,
    floorPriceData,
    formatNumber
}: FloorPriceSectionProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest px-1 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-teal-500" />
                    Floor Price Analysis - {ticker || 'Select a ticker'}
                    <div className="group relative">
                        <Info className="w-4 h-4 text-zinc-600 hover:text-zinc-400 cursor-help" />
                        <div className="invisible group-hover:visible absolute left-0 top-6 w-72 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-[10px] text-zinc-300 normal-case font-normal shadow-xl z-50">
                            <div className="font-bold mb-1">Floor Price Methodology:</div>
                            Dihitung dari <span className="text-teal-400 font-bold">TOTAL BUY</span> saja, tidak dikurangi SELL. Ini menunjukkan di harga berapa institutional buyers masuk, bukan holdings mereka saat ini.
                        </div>
                    </div>
                </h2>
                <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg p-0.5">
                    <button
                        onClick={() => onFloorPriceDaysChange(30)}
                        className={cn(
                            'px-3 py-1 text-xs font-medium rounded-md transition-all',
                            floorPriceDays === 30
                                ? 'bg-teal-500 text-white'
                                : 'text-zinc-400 hover:text-zinc-200'
                        )}
                    >
                        30 Hari
                    </button>
                    <button
                        onClick={() => onFloorPriceDaysChange(0)}
                        className={cn(
                            'px-3 py-1 text-xs font-medium rounded-md transition-all',
                            floorPriceDays === 0
                                ? 'bg-teal-500 text-white'
                                : 'text-zinc-400 hover:text-zinc-200'
                        )}
                    >
                        Semua Data
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="h-[180px] bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl flex items-center justify-center">
                    <RefreshCcw className="w-8 h-8 text-teal-500 animate-spin" />
                </div>
            ) : floorPriceData && floorPriceData.confidence !== 'NO_DATA' ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/50 border border-teal-500/30 rounded-2xl p-5 shadow-lg"
                >
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-shrink-0 px-6 py-4 rounded-xl bg-teal-500/10 border border-teal-500/30 flex flex-col items-center justify-center min-w-[160px]">
                            <span className="text-[10px] text-zinc-500 uppercase mb-1">Estimated Floor Price</span>
                            <span className="text-3xl font-black text-teal-400">
                                Rp {formatNumber(floorPriceData.floor_price)}
                            </span>
                            <span className={cn(
                                'text-xs px-2 py-0.5 rounded-full mt-2 font-bold',
                                floorPriceData.confidence === 'HIGH' ? 'bg-emerald-500/20 text-emerald-400' :
                                    floorPriceData.confidence === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' :
                                        'bg-zinc-500/20 text-zinc-400'
                            )}>
                                {floorPriceData.confidence} CONFIDENCE
                            </span>
                        </div>

                        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                                <div className="text-[10px] text-zinc-500 uppercase">Institutional Gross Buy</div>
                                <div className="text-lg font-bold text-blue-400">{formatNumber(floorPriceData.institutional_buy_lot)} lot</div>
                                <div className="text-[10px] text-zinc-600">{formatNumber(floorPriceData.institutional_buy_value, 2)}B</div>
                            </div>
                            <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                                <div className="text-[10px] text-zinc-500 uppercase">Foreign Gross Buy</div>
                                <div className="text-lg font-bold text-purple-400">{formatNumber(floorPriceData.foreign_buy_lot || 0)} lot</div>
                                <div className="text-[10px] text-zinc-600">{formatNumber(floorPriceData.foreign_buy_value || 0, 2)}B</div>
                            </div>
                            <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                                <div className="text-[10px] text-zinc-500 uppercase">Days Analyzed</div>
                                <div className="text-lg font-bold text-white">{floorPriceData.days_analyzed}</div>
                            </div>
                            <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                                <div className="text-[10px] text-zinc-500 uppercase">Latest Data</div>
                                <div className="text-sm font-bold text-zinc-400">{floorPriceData.latest_date?.substring(5) || '-'}</div>
                            </div>
                        </div>
                    </div>

                    {floorPriceData.institutional_brokers.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-zinc-800">
                            <div className="text-[10px] text-zinc-500 mb-2">Top Institutional Gross Buyers (Total Buy Volume)</div>
                            <div className="flex flex-wrap gap-2">
                                {floorPriceData.institutional_brokers.slice(0, 6).map(broker => (
                                    <div key={broker.code} className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-1.5 text-xs">
                                        <span className="font-bold text-blue-400">{broker.code}</span>
                                        <span className="text-zinc-500 ml-2">Rp {formatNumber(broker.avg_price)}</span>
                                        <span className="text-zinc-600 ml-1">({formatNumber(broker.total_lot)} lot)</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </motion.div>
            ) : ticker && ticker.length >= 4 ? (
                <div className="h-[180px] bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl flex items-center justify-center">
                    <div className="text-center space-y-2">
                        <div className="text-zinc-600 text-sm font-bold">No floor price data</div>
                        <div className="text-zinc-700 text-xs">
                            No institutional broker summary data available for {ticker}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="h-[180px] bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl flex items-center justify-center">
                    <div className="text-center space-y-2">
                        <TrendingUp className="w-12 h-12 text-zinc-700 mx-auto mb-2" />
                        <div className="text-zinc-600 text-sm font-bold">Enter a ticker to see floor price</div>
                    </div>
                </div>
            )}
        </div>
    );
}
