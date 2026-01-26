'use client';

import React from 'react';
import { Loader2, TrendingUp } from 'lucide-react';
import { PriceVolumeChart } from './PriceVolumeChart';
import type { MarketCapHistory, PriceVolumeResponse, SpikeMarker } from '@/services/api/priceVolume';

type PriceVolumeChartPanelProps = {
    chartData: PriceVolumeResponse | null;
    isLoading: boolean;
    error: string | null;
    ticker: string;
    spikeMarkers: SpikeMarker[];
    marketCapHistory: MarketCapHistory[];
};

export function PriceVolumeChartPanel({
    chartData,
    isLoading,
    error,
    ticker,
    spikeMarkers,
    marketCapHistory
}: PriceVolumeChartPanelProps) {
    if (chartData) {
        return (
            <div
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden flex-shrink-0"
                style={{ height: marketCapHistory.length ? '660px' : '520px' }}
            >
                <PriceVolumeChart
                    data={chartData.data}
                    ma5={chartData.ma5}
                    ma10={chartData.ma10}
                    ma20={chartData.ma20}
                    volumeMa20={chartData.volumeMa20}
                    ticker={chartData.ticker}
                    spikeMarkers={spikeMarkers}
                    marketCapHistory={marketCapHistory}
                />
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center bg-zinc-900/30 border border-zinc-800/50 rounded-xl flex-shrink-0" style={{ height: '300px' }}>
                <div className="text-center">
                    <Loader2 className="w-12 h-12 mx-auto mb-4 text-emerald-500 animate-spin" />
                    <h3 className="text-lg font-medium text-zinc-300 mb-2">
                        Fetching Data...
                    </h3>
                    <p className="text-sm text-zinc-500">
                        Retrieving price and volume data for {ticker}
                    </p>
                </div>
            </div>
        );
    }

    if (!error) {
        return (
            <div className="flex items-center justify-center bg-zinc-900/30 border border-zinc-800/50 rounded-xl flex-shrink-0" style={{ height: '200px' }}>
                <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-zinc-800/50 flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-zinc-600" />
                    </div>
                    <h3 className="text-base font-medium text-zinc-400 mb-1">
                        No Chart Data
                    </h3>
                    <p className="text-sm text-zinc-600 max-w-sm">
                        Enter a ticker or click on an unusual volume alert below
                    </p>
                </div>
            </div>
        );
    }

    return null;
}
