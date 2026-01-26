'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import type { HKAnalysisResponse, PriceVolumeResponse } from '@/services/api/priceVolume';

type HKAnalysisPanelProps = {
    chartData: PriceVolumeResponse | null;
    hkAnalysis: HKAnalysisResponse | null;
    isLoading: boolean;
};

export function HKAnalysisPanel({ chartData, hkAnalysis, isLoading }: HKAnalysisPanelProps) {
    if (!chartData || (!hkAnalysis && !isLoading)) {
        return null;
    }

    return (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-lg">ðŸ“Š</span>
                    <h3 className="text-base font-semibold text-zinc-100">HK Methodology Analysis</h3>
                </div>
                {hkAnalysis && (
                    <span className="text-xs text-zinc-500">
                        Spike: {hkAnalysis.spike_date} ({hkAnalysis.spike_source === 'auto_detected' ? 'auto' : 'manual'})
                    </span>
                )}
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-emerald-500 animate-spin mr-2" />
                    <span className="text-zinc-400">Analyzing smart money patterns...</span>
                </div>
            ) : hkAnalysis ? (
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-800/50 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-zinc-400 uppercase mb-3 flex items-center gap-2">
                            Volume Asymmetry (Post-Spike)
                        </h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Vol on UP days</span>
                                <span className="text-emerald-400">
                                    {(hkAnalysis.volume_asymmetry.volume_up_total / 1000000).toFixed(1)}M
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Vol on DOWN days</span>
                                <span className="text-red-400">
                                    {(hkAnalysis.volume_asymmetry.volume_down_total / 1000000).toFixed(1)}M
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Asymmetry Ratio</span>
                                <span className={`font-semibold ${hkAnalysis.volume_asymmetry.asymmetry_ratio >= 3 ? 'text-emerald-400' :
                                        hkAnalysis.volume_asymmetry.asymmetry_ratio >= 1 ? 'text-amber-400' : 'text-red-400'
                                    }`}>
                                    {hkAnalysis.volume_asymmetry.asymmetry_ratio.toFixed(1)}:1
                                </span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-zinc-700">
                                <span className="text-zinc-500">Bandar Status</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${hkAnalysis.volume_asymmetry.verdict === 'STRONG_HOLDING' ? 'bg-emerald-500/20 text-emerald-400' :
                                        hkAnalysis.volume_asymmetry.verdict === 'HOLDING' ? 'bg-cyan-500/20 text-cyan-400' :
                                            hkAnalysis.volume_asymmetry.verdict === 'DISTRIBUTING' ? 'bg-red-500/20 text-red-400' :
                                                'bg-zinc-500/20 text-zinc-400'
                                    }`}>
                                    {hkAnalysis.volume_asymmetry.verdict}
                                </span>
                            </div>
                            <div className="text-xs text-zinc-600 text-center pt-1">
                                {hkAnalysis.volume_asymmetry.days_analyzed} days analyzed
                            </div>
                        </div>
                    </div>

                    <div className="bg-zinc-800/50 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-zinc-400 uppercase mb-3 flex items-center gap-2">
                            Pre-Spike Accumulation
                        </h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Period</span>
                                <span className="text-zinc-300 text-xs">
                                    {hkAnalysis.accumulation.period_start?.slice(5) || 'N/A'} â†’ {hkAnalysis.accumulation.period_end?.slice(5) || 'N/A'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Duration</span>
                                <span className="text-zinc-300">{hkAnalysis.accumulation.accumulation_days} days</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Total Volume</span>
                                <span className="text-cyan-400">
                                    {(hkAnalysis.accumulation.total_volume / 1000000).toFixed(1)}M
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Volume Trend</span>
                                <span className={
                                    hkAnalysis.accumulation.volume_trend === 'INCREASING' ? 'text-emerald-400' :
                                        hkAnalysis.accumulation.volume_trend === 'DECREASING' ? 'text-red-400' : 'text-amber-400'
                                }>
                                    {hkAnalysis.accumulation.volume_trend}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Up/Down Days</span>
                                <span className="text-zinc-300">
                                    <span className="text-emerald-400">{hkAnalysis.accumulation.up_days}</span>
                                    {' / '}
                                    <span className="text-red-400">{hkAnalysis.accumulation.down_days}</span>
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Net Movement</span>
                                <span className={hkAnalysis.accumulation.net_movement_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                    {hkAnalysis.accumulation.net_movement_pct > 0 ? '+' : ''}{hkAnalysis.accumulation.net_movement_pct.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
