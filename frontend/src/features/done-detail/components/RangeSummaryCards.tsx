'use client';

import React from 'react';
import { RangeSummary } from '@/services/api/doneDetail';

interface RangeSummaryCardsProps {
    summary: RangeSummary;
}

const formatValue = (value: number): string => {
    if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    return value.toLocaleString();
};

export const RangeSummaryCards: React.FC<RangeSummaryCardsProps> = ({ summary }) => {
    // Guard against undefined summary
    if (!summary) {
        return <div className="text-slate-400 text-center py-4">No summary data available</div>;
    }

    const retailCapPct = summary.retail_capitulation_pct ?? 0;

    const cards = [
        {
            icon: '📊',
            label: 'Imposter Trades',
            value: (summary.total_imposter_trades ?? 0).toLocaleString(),
            color: 'text-orange-400',
            bgColor: 'bg-orange-500/10 border-orange-500/30'
        },
        {
            icon: '🚨',
            label: 'Top Ghost Broker',
            value: summary.top_ghost_broker || '-',
            subValue: summary.top_ghost_name,
            color: 'text-red-400',
            bgColor: 'bg-red-500/10 border-red-500/30'
        },
        {
            icon: '⚡',
            label: 'Peak Day',
            value: summary.peak_day?.slice(-5) || '-',
            subValue: formatValue(summary.peak_value ?? 0),
            color: 'text-yellow-400',
            bgColor: 'bg-yellow-500/10 border-yellow-500/30'
        },
        {
            icon: '💰',
            label: 'Avg Lot Size',
            value: (summary.avg_lot ?? 0).toLocaleString(),
            subValue: 'lot/trade',
            color: 'text-emerald-400',
            bgColor: 'bg-emerald-500/10 border-emerald-500/30'
        },
        {
            icon: '📈',
            label: 'Retail Capitulation',
            value: `${retailCapPct.toFixed(1)}%`,
            subValue: retailCapPct >= 50 ? '✅ Safe Zone' : '⚠️ Holding',
            color: retailCapPct >= 50 ? 'text-emerald-400' : 'text-amber-400',
            bgColor: retailCapPct >= 50 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'
        },
        {
            icon: '📆',
            label: 'Analysis Period',
            value: `${summary.total_days ?? 0} days`,
            subValue: `${(summary.avg_daily_imposter_pct ?? 0).toFixed(1)}% avg imposter`,
            color: 'text-blue-400',
            bgColor: 'bg-blue-500/10 border-blue-500/30'
        }
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {cards.map((card, idx) => (
                <div
                    key={idx}
                    className={`border rounded-xl p-3 text-center transition-all hover:scale-[1.02] ${card.bgColor}`}
                >
                    <div className="text-lg mb-1">{card.icon}</div>
                    <div className={`text-xl font-black ${card.color}`}>{card.value}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">{card.label}</div>
                    {card.subValue && (
                        <div className="text-[10px] text-slate-500 mt-1 truncate">{card.subValue}</div>
                    )}
                </div>
            ))}
        </div>
    );
};
