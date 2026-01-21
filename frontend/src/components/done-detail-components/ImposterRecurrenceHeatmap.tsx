'use client';

import React from 'react';
import { ImposterRecurrenceBroker } from '@/services/api/doneDetail';

interface ImposterRecurrenceHeatmapProps {
    brokers: ImposterRecurrenceBroker[];
    allDates: string[];
}

const formatValue = (value: number): string => {
    if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    return value.toLocaleString();
};

const getHeatColor = (value: number, maxValue: number): string => {
    if (value === 0) return 'bg-slate-800';
    const intensity = value / maxValue;
    if (intensity > 0.7) return 'bg-red-500';
    if (intensity > 0.4) return 'bg-orange-500';
    if (intensity > 0.2) return 'bg-yellow-500';
    return 'bg-emerald-500/50';
};

export const ImposterRecurrenceHeatmap: React.FC<ImposterRecurrenceHeatmapProps> = ({
    brokers,
    allDates
}) => {
    // Find max value for color scaling
    const maxValue = Math.max(
        ...brokers.flatMap(b => b.daily_activity.map(d => d.value)),
        1
    );

    return (
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-bold text-purple-400">📅 Imposter Recurrence Heatmap</div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-800 rounded"></div> None</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500/50 rounded"></div> Low</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-500 rounded"></div> Med</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-orange-500 rounded"></div> High</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded"></div> Peak</span>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                    <thead>
                        <tr>
                            <th className="text-left text-slate-500 font-bold py-1 px-2 sticky left-0 bg-slate-900/90">Broker</th>
                            {allDates.map(date => (
                                <th key={date} className="text-center text-slate-600 font-medium px-1 min-w-[28px]">
                                    {date.slice(-5)}
                                </th>
                            ))}
                            <th className="text-right text-slate-500 font-bold px-2">Hit%</th>
                        </tr>
                    </thead>
                    <tbody>
                        {brokers.slice(0, 10).map((broker) => {
                            // Create a map for quick lookup
                            const activityMap = new Map(
                                broker.daily_activity.map(d => [d.date, d])
                            );

                            return (
                                <tr key={broker.broker} className="hover:bg-slate-800/30">
                                    <td className="text-left font-bold text-slate-300 py-1 px-2 sticky left-0 bg-slate-900/90">
                                        {broker.broker}
                                    </td>
                                    {allDates.map(date => {
                                        const activity = activityMap.get(date);
                                        const value = activity?.value || 0;

                                        return (
                                            <td key={date} className="text-center px-0.5 py-0.5">
                                                <div
                                                    className={`w-5 h-5 rounded-sm mx-auto transition-all hover:scale-125 cursor-pointer ${getHeatColor(value, maxValue)}`}
                                                    title={value > 0 ? `${date}: ${formatValue(value)}` : `${date}: No activity`}
                                                />
                                            </td>
                                        );
                                    })}
                                    <td className={`text-right font-black px-2 ${broker.recurrence_pct >= 70 ? 'text-red-400' :
                                            broker.recurrence_pct >= 50 ? 'text-orange-400' :
                                                'text-slate-400'
                                        }`}>
                                        {broker.recurrence_pct.toFixed(0)}%
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
