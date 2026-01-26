'use client';

import React from 'react';
import { Database, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import type { PriceVolumeResponse } from '@/services/api/priceVolume';

type PriceVolumeHeaderProps = {
    chartData: PriceVolumeResponse | null;
    isRefreshing: boolean;
    onRefreshAll: () => void;
};

export function PriceVolumeHeader({ chartData, isRefreshing, onRefreshAll }: PriceVolumeHeaderProps) {
    return (
        <div className="flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/20">
                    <TrendingUp className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
                        Price & Volume
                    </h1>
                    <p className="text-sm text-zinc-500">
                        Interactive candlestick chart with moving averages
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <button
                    onClick={onRefreshAll}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-medium rounded-lg hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    {isRefreshing ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Refreshing...
                        </>
                    ) : (
                        <>
                            <RefreshCw className="w-4 h-4" />
                            Refresh All Data
                        </>
                    )}
                </button>

                {chartData && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 rounded-lg border border-zinc-800">
                        <Database className="w-4 h-4 text-zinc-500" />
                        <span className="text-xs text-zinc-400">
                            {chartData.records_count} records
                            {chartData.source !== 'database' && (
                                <span className="ml-2 text-emerald-400">
                                    +{chartData.records_added} new
                                </span>
                            )}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
