'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SignalGauge } from './SignalGauge';
import { TugOfWarBar } from './TugOfWarBar';
import { MetricSparkline } from './MetricSparkline';
import { formatRupiah } from '../utils';
import type { CombinedAnalysis } from '@/services/api/doneDetail';

type DoneDetailOverviewTabProps = {
    combinedData: CombinedAnalysis;
    imposterSparklineData: Array<{ time: string; count: number }>;
    onSelectBroker: (broker: string) => void;
    onSelectTab: (tab: 'imposter' | 'speed') => void;
};

export function DoneDetailOverviewTab({
    combinedData,
    imposterSparklineData,
    onSelectBroker,
    onSelectTab
}: DoneDetailOverviewTabProps) {
    return (
        <div className="space-y-4">
            <Card className={`border-2 overflow-hidden relative ${combinedData.signal.direction === 'BULLISH'
                ? 'bg-gradient-to-br from-slate-900 to-green-950/30 border-green-500/30'
                : combinedData.signal.direction === 'BEARISH'
                    ? 'bg-gradient-to-br from-slate-900 to-red-950/30 border-red-500/30'
                    : 'bg-slate-900/50 border-slate-600'
                }`}>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />
                <CardContent className="py-2 px-4 flex items-center justify-between">
                    <div className="flex-1">
                        <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Market Signal</div>
                        <div className="text-3xl font-black text-white leading-tight">
                            {combinedData.signal.direction}
                        </div>
                        <div className="text-sm text-slate-400">
                            {combinedData.signal.description}
                        </div>
                    </div>
                    <div className="w-[180px]">
                        <SignalGauge
                            value={combinedData.signal.confidence}
                            direction={combinedData.signal.direction}
                            label={combinedData.signal.level}
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="bg-slate-900/50 border-slate-700 shadow-[0_0_20px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.2)] transition-shadow overflow-hidden relative">
                    <CardContent className="py-3 px-4 text-center z-10 relative">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <span className="text-xl font-black text-red-500">{combinedData.key_metrics.strong_impostor_count}</span>
                            <span className="text-slate-600 text-lg">/</span>
                            <span className="text-xl font-black text-orange-400">{combinedData.key_metrics.possible_impostor_count}</span>
                        </div>
                        <div className="text-xs text-slate-400 font-medium">Strong / Possible Impostor</div>
                    </CardContent>
                    <div className="absolute bottom-0 left-0 right-0 h-10 opacity-30">
                        <MetricSparkline data={imposterSparklineData} dataKey="count" color="#ef4444" height={40} />
                    </div>
                </Card>

                <Card className="bg-slate-900/50 border-slate-700 shadow-[0_0_20px_rgba(20,184,166,0.1)] hover:shadow-[0_0_20px_rgba(20,184,166,0.2)] transition-shadow overflow-hidden relative">
                    <CardContent className="py-3 px-4 text-center z-10 relative">
                        <div className="text-2xl font-black text-teal-400 mb-1">{combinedData.key_metrics.avg_tps}</div>
                        <div className="text-xs text-slate-400 font-medium">Avg Trades/Sec</div>
                    </CardContent>
                    <div className="absolute bottom-0 left-0 right-0 h-10 opacity-30">
                        <MetricSparkline data={combinedData.timeline} dataKey="trades" color="#14b8a6" height={40} />
                    </div>
                </Card>

                <Card className="bg-slate-900/50 border-slate-700 shadow-[0_0_20px_rgba(234,179,8,0.1)] hover:shadow-[0_0_20px_rgba(234,179,8,0.2)] transition-shadow overflow-hidden relative">
                    <CardContent className="py-3 px-4 text-center z-10 relative">
                        <div className="text-2xl font-black text-yellow-400 mb-1">{combinedData.key_metrics.burst_count}</div>
                        <div className="text-xs text-slate-400 font-medium">Burst Events</div>
                    </CardContent>
                    <div className="absolute bottom-0 left-0 right-0 h-10 opacity-30">
                        <MetricSparkline data={combinedData.timeline} dataKey="trades" color="#eab308" height={40} />
                    </div>
                </Card>

                <Card className="bg-slate-900/50 border-slate-700 shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-shadow overflow-hidden relative">
                    <CardContent className="py-3 px-4 text-center z-10 relative">
                        <div className="text-2xl font-black text-white mb-1">{combinedData.key_metrics.total_trades.toLocaleString()}</div>
                        <div className="text-xs text-slate-400 font-medium">Total Trades</div>
                    </CardContent>
                    <div className="absolute bottom-0 left-0 right-0 h-10 opacity-20">
                        <MetricSparkline data={combinedData.timeline} dataKey="trades" color="#ffffff" height={40} />
                    </div>
                </Card>
            </div>

            <Card className="bg-slate-900/50 border-slate-700">
                <CardHeader className="py-2 px-4 border-b border-slate-800/50">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm text-white flex items-center gap-2">
                            ðŸ’° Smart Money Flow
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="py-4 px-6">
                    <TugOfWarBar
                        buyPct={combinedData.impostor_flow.buy_pct}
                        sellPct={combinedData.impostor_flow.sell_pct}
                        netValue={combinedData.impostor_flow.net_value}
                        buyValue={combinedData.impostor_flow.buy_value}
                        sellValue={combinedData.impostor_flow.sell_value}
                    />
                </CardContent>
            </Card>

            {combinedData.power_brokers.length > 0 && (
                <Card className="bg-slate-900/50 border-slate-700">
                    <CardHeader className="py-2 px-4">
                        <CardTitle className="text-sm text-purple-400">âš¡ Power Brokers (Top Impostor + Speed)</CardTitle>
                    </CardHeader>
                    <CardContent className="py-2 px-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {combinedData.power_brokers.slice(0, 6).map((broker) => (
                                <div
                                    key={broker.broker_code}
                                    onClick={() => onSelectBroker(broker.broker_code)}
                                    className={`p-3 rounded-lg border cursor-pointer hover:scale-105 transition-transform ${broker.net_direction === 'BUY'
                                        ? 'bg-green-900/20 border-green-500/30'
                                        : 'bg-red-900/20 border-red-500/30'
                                        }`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-white">{broker.broker_code}</span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${broker.net_direction === 'BUY'
                                            ? 'bg-green-500/20 text-green-400'
                                            : 'bg-red-500/20 text-red-400'
                                            }`}>
                                            {broker.net_direction === 'BUY' ? 'â†‘' : 'â†“'} {broker.net_direction}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-400 mb-1">{broker.broker_name}</div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                            <span className="text-slate-500">Impostor:</span>
                                            <span className="text-teal-400 ml-1">{formatRupiah(broker.impostor_value)}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Speed:</span>
                                            <span className="text-yellow-400 ml-1">{broker.speed_trades} trades</span>
                                        </div>
                                        <div>
                                            <span className="text-red-500">{broker.strong_count}S</span>
                                            <span className="text-slate-500">/</span>
                                            <span className="text-orange-400">{broker.possible_count}P</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">TPS:</span>
                                            <span className="text-blue-400 ml-1">{broker.speed_tps}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectTab('imposter')}
                    className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                >
                    ðŸŽ­ View Impostor Details
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectTab('speed')}
                    className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/20"
                >
                    âš¡ View Speed Details
                </Button>
            </div>
        </div>
    );
}
