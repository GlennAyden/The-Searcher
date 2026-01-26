'use client';

import React from 'react';
import { ImposterRecurrenceBroker } from '@/services/api/doneDetail';

interface GhostBrokerRankingProps {
    brokers: ImposterRecurrenceBroker[];
    onBrokerClick?: (broker: string) => void;
}

const formatValue = (value: number): string => {
    if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    return value.toLocaleString();
};

const getSuspicionLevel = (pct: number): { label: string; color: string; bg: string } => {
    if (pct >= 80) return { label: '🚨 EXTREME', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30' };
    if (pct >= 60) return { label: '⚠️ HIGH', color: 'text-orange-400', bg: 'bg-orange-500/20 border-orange-500/30' };
    if (pct >= 40) return { label: '🟡 MODERATE', color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/30' };
    return { label: '⚪ NORMAL', color: 'text-slate-400', bg: 'bg-slate-500/20 border-slate-500/30' };
};

export const GhostBrokerRanking: React.FC<GhostBrokerRankingProps> = ({
    brokers,
    onBrokerClick
}) => {
    return (
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-bold text-red-400">🚨 Ghost Broker Suspicion Ranking</div>
                <div className="text-[10px] text-slate-500">Sorted by Recurrence %</div>
            </div>

            <div className="space-y-2">
                {brokers.slice(0, 8).map((broker, idx) => {
                    const suspicion = getSuspicionLevel(broker.recurrence_pct);

                    return (
                        <div
                            key={broker.broker}
                            className={`border rounded-lg p-3 transition-all hover:scale-[1.01] cursor-pointer ${suspicion.bg}`}
                            onClick={() => onBrokerClick?.(broker.broker)}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg font-black text-slate-300 bg-slate-800 w-7 h-7 rounded-full flex items-center justify-center text-xs">
                                        {idx + 1}
                                    </span>
                                    <div>
                                        <span className={`text-lg font-black ${suspicion.color}`}>{broker.broker}</span>
                                        <span className="text-[10px] text-slate-500 ml-2">{broker.name}</span>
                                    </div>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded-full font-bold ${suspicion.bg} ${suspicion.color}`}>
                                    {suspicion.label}
                                </span>
                            </div>

                            {/* Recurrence Bar */}
                            <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
                                <div
                                    className={`absolute inset-y-0 left-0 transition-all ${broker.recurrence_pct >= 80 ? 'bg-red-500' :
                                        broker.recurrence_pct >= 60 ? 'bg-orange-500' :
                                            broker.recurrence_pct >= 40 ? 'bg-yellow-500' :
                                                'bg-slate-500'
                                        }`}
                                    style={{ width: `${broker.recurrence_pct}%` }}
                                />
                            </div>

                            {/* Stats Row */}
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                                <span>
                                    <span className={`font-black ${suspicion.color}`}>{(broker.recurrence_pct ?? 0).toFixed(0)}%</span>
                                    {' '}({broker.days_active ?? 0}/{broker.total_days ?? 0} days)
                                </span>
                                <span>Avg: <span className="text-slate-300 font-bold">{(broker.avg_lot ?? 0).toLocaleString()} lot</span></span>
                                <span>Total: <span className="text-slate-300 font-bold">{formatValue(broker.total_value ?? 0)}</span></span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
