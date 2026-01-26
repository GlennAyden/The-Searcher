'use client';

import React from 'react';
import { Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SpeedDynamicsChart } from './SpeedDynamicsChart';
import { SpeedTreemap } from './SpeedTreemap';
import type { SpeedAnalysis } from '@/services/api/doneDetail';

type SpeedTreemapNode = {
    name: string;
    broker_name: string;
    size: number;
    tps: number;
    value: number;
};

type DoneDetailSpeedTabProps = {
    speedData: SpeedAnalysis;
    selectedSpeedBrokers: string[];
    onSelectedSpeedBrokersChange: React.Dispatch<React.SetStateAction<string[]>>;
    displayedSpeedTimeline: SpeedAnalysis['timeline'];
    speedTreemapData: SpeedTreemapNode[];
    onSelectBroker: (broker: string) => void;
};

export function DoneDetailSpeedTab({
    speedData,
    selectedSpeedBrokers,
    onSelectedSpeedBrokersChange,
    displayedSpeedTimeline,
    speedTreemapData,
    onSelectBroker
}: DoneDetailSpeedTabProps) {
    return (
        <Card className="bg-slate-900/80 border-slate-700">
            <CardHeader className="py-2 px-4 border-b border-slate-700">
                <CardTitle className="text-sm flex items-center gap-2 text-yellow-400">
                    âš¡ Speed Analysis - Trades Per Second & Burst Detection
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                    <div className="bg-slate-800 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-white">{speedData.summary.total_trades.toLocaleString()}</div>
                        <div className="text-xs text-slate-400">Total Trades</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-blue-400">{speedData.summary.unique_seconds.toLocaleString()}</div>
                        <div className="text-xs text-slate-400">Unique Seconds</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-teal-400">{speedData.summary.avg_trades_per_second}</div>
                        <div className="text-xs text-slate-400">Avg/Second</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-yellow-400">{speedData.summary.max_trades_per_second}</div>
                        <div className="text-xs text-slate-400">Max/Second</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-orange-400 font-mono">{speedData.summary.peak_time || '-'}</div>
                        <div className="text-xs text-slate-400">Peak Time</div>
                    </div>
                </div>

                {speedData.timeline.length > 0 && (
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="text-sm text-orange-400 font-bold">âš¡ Speed Dynamics (Market Heartbeat)</div>
                                <div className="text-xs text-slate-500">(Trades Per Second)</div>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-slate-700 rounded-sm"></div> Normal</div>
                                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-yellow-500 rounded-sm"></div> High</div>
                                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-sm"></div> Burst</div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                            <button
                                onClick={() => onSelectedSpeedBrokersChange([])}
                                className={`px-2 py-1 rounded text-xs font-bold transition-colors border ${selectedSpeedBrokers.length === 0
                                    ? 'bg-orange-500 text-white border-orange-500'
                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-orange-500/50'
                                    }`}
                            >
                                ALL MARKET
                            </button>
                            {speedData.speed_by_broker.slice(0, 10).map(b => (
                                <button
                                    key={b.broker}
                                    onClick={() => {
                                        onSelectedSpeedBrokersChange(prev =>
                                            prev.includes(b.broker)
                                                ? prev.filter(x => x !== b.broker)
                                                : [...prev, b.broker]
                                        );
                                    }}
                                    className={`px-2 py-1 rounded text-xs font-bold transition-colors border flex items-center gap-1 ${selectedSpeedBrokers.includes(b.broker)
                                        ? 'bg-orange-500/20 text-orange-400 border-orange-500'
                                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-orange-500/50'
                                        }`}
                                >
                                    {b.broker}
                                    {selectedSpeedBrokers.includes(b.broker) && <span className="text-[10px]">âœ•</span>}
                                </button>
                            ))}
                        </div>

                        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 shadow-inner min-h-[250px] relative">
                            {selectedSpeedBrokers.length > 0 && !speedData.broker_timelines && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 z-10 text-center p-4">
                                    <p className="text-orange-400 font-bold mb-2">âš ï¸ Detailed Data Missing</p>
                                    <p className="text-slate-400 text-sm">To filter by specific brokers, the backend must be updated to return &quot;broker_timelines&quot;.</p>
                                    <p className="text-slate-500 text-xs mt-2">Try restarting the backend server.</p>
                                </div>
                            )}

                            {displayedSpeedTimeline.length === 0 && selectedSpeedBrokers.length > 0 && speedData.broker_timelines ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                                    <p className="text-slate-500 font-bold">No activity found for selected broker(s)</p>
                                </div>
                            ) : (
                                <SpeedDynamicsChart
                                    data={displayedSpeedTimeline}
                                    avgTps={selectedSpeedBrokers.length > 0 ? undefined : speedData.summary.avg_trades_per_second}
                                    height={250}
                                />
                            )}
                        </div>
                    </div>
                )}

                <div className="text-sm text-purple-400 mb-3 font-bold">ðŸ† Top Speed Brokers Dominance (Treemap Heatmap)</div>
                {speedTreemapData.length > 0 ? (
                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                        <div className="text-xs text-slate-500 mb-2 italic">
                            Size: Trade Frequency (Noise) â€¢ Color: <span className="text-red-500 font-bold">Heat/Speed (TPS)</span>
                        </div>
                        <SpeedTreemap
                            data={speedTreemapData}
                            onBrokerClick={onSelectBroker}
                            height={500}
                        />
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-400">
                        <Activity className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                        <p className="font-medium">No Speed Data</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
