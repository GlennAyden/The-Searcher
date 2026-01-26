'use client';

import React, { useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cleanTickerSymbol } from '@/lib/string-utils';
import type { HotSignal } from '../types';

type HotSignalsSectionProps = {
    hotSignals: HotSignal[];
    symbol: string;
    onSelectSymbol: (symbol: string) => void;
};

export function HotSignalsSection({ hotSignals, symbol, onSelectSymbol }: HotSignalsSectionProps) {
    const [priceFilter, setPriceFilter] = useState('');
    const [showLegend, setShowLegend] = useState(false);

    const filteredHotSignals = useMemo(() => {
        if (!priceFilter.trim()) return hotSignals;

        const filterExpr = priceFilter.trim();
        const match = filterExpr.match(/^(>=|<=|>|<|=)(.+)$/);

        if (match) {
            const operator = match[1];
            const targetPrice = parseFloat(match[2].replace(/,/g, ''));

            if (isNaN(targetPrice)) return hotSignals;

            return hotSignals.filter(sig => {
                const price = parseFloat(String(sig.price || '0').replace(/,/g, ''));

                switch (operator) {
                    case '>': return price > targetPrice;
                    case '<': return price < targetPrice;
                    case '>=': return price >= targetPrice;
                    case '<=': return price <= targetPrice;
                    case '=': return price === targetPrice;
                    default: return true;
                }
            });
        }

        return hotSignals.filter(sig =>
            sig.symbol.toLowerCase().includes(filterExpr.toLowerCase())
        );
    }, [hotSignals, priceFilter]);

    if (hotSignals.length === 0) {
        return null;
    }

    return (
        <div className="bg-gradient-to-br from-[#0a0a0c] via-[#0f0f11] to-[#0a0a0c] border-b border-zinc-800/50 px-6 py-4 flex-shrink-0">
            <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="animate-pulse">🔥</span>
                        HOT SIGNALS
                    </span>
                    <span className="text-[9px] text-amber-500/80 uppercase tracking-tight px-2 py-0.5 rounded-sm bg-amber-500/10 border border-amber-500/20">
                        Safe Mode: Liquid Only
                    </span>
                    <span className="text-[8px] text-zinc-600">
                        {Math.min(filteredHotSignals.length, 10)} signal{Math.min(filteredHotSignals.length, 10) > 1 ? 's' : ''} detected
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                        <label className="text-[9px] text-zinc-500 uppercase tracking-wide">Price:</label>
                        <input
                            type="text"
                            placeholder="e.g. <3000"
                            value={priceFilter}
                            onChange={(e) => setPriceFilter(e.target.value)}
                            className="w-24 bg-zinc-900/80 border border-zinc-700 text-zinc-300 text-[10px] rounded px-2 py-1 outline-none focus:border-blue-500"
                            title="Use operators: >, <, >=, <=, ="
                        />
                        {priceFilter && (
                            <button
                                onClick={() => setPriceFilter('')}
                                className="text-zinc-500 hover:text-zinc-300 text-[10px]"
                                title="Clear filter"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => setShowLegend(!showLegend)}
                        className="text-[9px] px-2 py-1 rounded border border-zinc-700 bg-zinc-900/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-all uppercase tracking-wide"
                        title="Show/hide legend"
                    >
                        {showLegend ? '📖 Hide' : '📖 Legend'}
                    </button>
                </div>
            </div>

            {showLegend && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[10px]">
                        <div>
                            <span className="text-zinc-500 font-bold uppercase text-[9px] mb-1 block">Signal Strength:</span>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[12px]">🔥</span>
                                    <span className="text-emerald-400">VERY STRONG</span>
                                    <span className="text-zinc-600">(Score ≥150)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[12px]">⚡</span>
                                    <span className="text-blue-400">STRONG</span>
                                    <span className="text-zinc-600">(Score 90-149)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[12px]">⚠️</span>
                                    <span className="text-yellow-400">MODERATE</span>
                                    <span className="text-zinc-600">(Score 45-89)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[12px]">⚪</span>
                                    <span className="text-zinc-500">WEAK</span>
                                    <span className="text-zinc-600">(Score 0-44)</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <span className="text-zinc-500 font-bold uppercase text-[9px] mb-1 block">Markers:</span>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                    <span className="text-zinc-400">CROSSING</span>
                                    <span className="text-zinc-600">- Distribution pressure</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                    <span className="text-zinc-400">UNUSUAL</span>
                                    <span className="text-zinc-600">- Abnormal volume activity</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <span className="text-zinc-500 font-bold uppercase text-[9px] mb-1 block">Timeframe Alignment:</span>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] px-1 rounded-sm bg-emerald-500/20 text-emerald-400">✓✓✓</span>
                                    <span className="text-zinc-400">PERFECT</span>
                                    <span className="text-zinc-600">- D+W+C aligned (+30pts)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] px-1 rounded-sm bg-yellow-500/20 text-yellow-400">✓✓</span>
                                    <span className="text-zinc-400">PARTIAL</span>
                                    <span className="text-zinc-600">- 2 of 3 aligned (+15pts)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] px-1 rounded-sm bg-zinc-700/50 text-zinc-500">✓</span>
                                    <span className="text-zinc-400">WEAK</span>
                                    <span className="text-zinc-600">- Only 1 aligned (0pts)</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <span className="text-zinc-500 font-bold uppercase text-[9px] mb-1 block">Momentum:</span>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px]">🚀</span>
                                    <span className="text-zinc-400">ACCELERATING</span>
                                    <span className="text-zinc-600">- Increasing velocity (+30pts)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px]">↗️</span>
                                    <span className="text-zinc-400">INCREASING</span>
                                    <span className="text-zinc-600">- Positive trend (+20pts)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px]">➡️</span>
                                    <span className="text-zinc-400">STABLE</span>
                                    <span className="text-zinc-600">- Steady (+10pts)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px]">↘️</span>
                                    <span className="text-zinc-400">WEAKENING</span>
                                    <span className="text-zinc-600">- Declining (-10pts)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px]">🔽</span>
                                    <span className="text-zinc-400">DECLINING</span>
                                    <span className="text-zinc-600">- Rapid drop (-20pts)</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <span className="text-zinc-500 font-bold uppercase text-[9px] mb-1 block">Risk Warnings:</span>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px]">🟢</span>
                                    <span className="text-zinc-400">NO_WARNINGS</span>
                                    <span className="text-zinc-600">- All clear (0pts)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px]">🟡</span>
                                    <span className="text-zinc-400">CAUTION</span>
                                    <span className="text-zinc-600">- Momentum slowing (-5pts)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px]">🟠</span>
                                    <span className="text-zinc-400">WARNING</span>
                                    <span className="text-zinc-600">- Weekly divergence (-15pts)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px]">🔴</span>
                                    <span className="text-zinc-400">HIGH_RISK</span>
                                    <span className="text-zinc-600">- Unsustained spike (-30pts)</span>
                                </div>
                            </div>
                        </div>

                        <div className="col-span-2 mt-1 pt-2 border-t border-zinc-800">
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <span className="text-emerald-400 font-mono">150B</span>
                                    <span className="text-zinc-600">= Money Flow (D-0)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-emerald-400 font-mono">+1.2%</span>
                                    <span className="text-zinc-600">= Price Change (1D)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-emerald-400 font-mono border border-emerald-500/30 px-1 rounded">95</span>
                                    <span className="text-zinc-600">= Signal Score</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10">
                        <tr className="bg-gradient-to-r from-zinc-900 to-zinc-800 border-b border-zinc-700">
                            <th className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-400">#</th>
                            <th className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-400">Ticker</th>
                            <th className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-400 text-right">Score</th>
                            <th className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-400">Type Flow</th>
                            <th className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-400 text-right">Price</th>
                            <th className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-400 text-right">Flow</th>
                            <th className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-400 text-right">Change</th>
                            <th className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-400 text-center">Legend</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredHotSignals.slice(0, 10).map((sig, idx) => {
                            const getStrengthConfig = (strength: string) => {
                                switch (strength) {
                                    case 'VERY_STRONG':
                                        return { label: 'Prime Signal', icon: '🔥', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
                                    case 'STRONG':
                                        return { label: 'Strong Trend', icon: '⚡', color: 'text-blue-400', bg: 'bg-blue-500/10' };
                                    case 'MODERATE':
                                        return { label: 'Moderate Flow', icon: '⚠️', color: 'text-amber-400', bg: 'bg-amber-500/10' };
                                    default:
                                        return { label: 'Neutral', icon: '⚪', color: 'text-zinc-500', bg: 'bg-zinc-800/10' };
                                }
                            };

                            const config = getStrengthConfig(sig.signal_strength || 'WEAK');
                            const isSelected = sig.symbol === symbol;

                            return (
                                <tr
                                    key={sig.symbol}
                                    onClick={() => onSelectSymbol(sig.symbol)}
                                    className={cn(
                                        'border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer transition-all group',
                                        isSelected && 'bg-blue-500/10 border-blue-500/20'
                                    )}
                                >
                                    <td className="px-4 py-3 text-[11px] font-bold text-zinc-600">
                                        {idx + 1}
                                    </td>

                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-yellow-500/50 group-hover:text-yellow-400 transition-colors">★</span>
                                            <span className="text-[13px] font-black text-white group-hover:text-blue-300 transition-colors">
                                                {cleanTickerSymbol(sig.symbol)}
                                            </span>
                                        </div>
                                    </td>

                                    <td className="px-4 py-3 text-right">
                                        <span className={cn('text-[14px] font-black tabular-nums', config.color)}>
                                            {sig.signal_score}
                                        </span>
                                    </td>

                                    <td className="px-4 py-3">
                                        <div className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-md', config.bg)}>
                                            <span className="text-[12px]">{config.icon}</span>
                                            <span className={cn('text-[10px] font-bold uppercase tracking-tight', config.color)}>
                                                {config.label}
                                            </span>
                                        </div>
                                    </td>

                                    <td className="px-4 py-3 text-right">
                                        <span className="text-[12px] font-bold text-zinc-300 tabular-nums">
                                            {sig.price?.toLocaleString()}
                                        </span>
                                    </td>

                                    <td className="px-4 py-3 text-right">
                                        <span className={cn(
                                            'text-[12px] font-black tabular-nums',
                                            parseFloat(sig.flow?.toString().replace(/,/g, '') || '0') >= 0 ? 'text-emerald-400' : 'text-red-400'
                                        )}>
                                            {sig.flow}B
                                        </span>
                                    </td>

                                    <td className="px-4 py-3 text-right">
                                        <span className={cn(
                                            'text-[12px] font-black tabular-nums',
                                            (sig.change || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                                        )}>
                                            {sig.change !== undefined && sig.change !== null ? (
                                                `${sig.change > 0 ? '+' : ''}${sig.change}%`
                                            ) : '0%'}
                                        </span>
                                    </td>

                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1 flex-wrap justify-start max-w-[250px]">
                                            <span className={cn(
                                                'text-[8px] px-1.5 py-0.5 rounded font-black uppercase border whitespace-nowrap',
                                                sig.alignment_status === 'PERFECT_ALIGNMENT' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                                    sig.alignment_status === 'STRONG_ALIGNMENT' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                                        sig.alignment_status === 'PARTIAL_ALIGNMENT' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                                                            'bg-zinc-700/20 text-zinc-500 border-zinc-600/30'
                                            )} title={`Timeframe Alignment: ${sig.alignment_status}`}>
                                                {String(sig.alignment_label || 'WEAK')}
                                            </span>

                                            <span className={cn(
                                                'text-[8px] px-1.5 py-0.5 rounded font-black uppercase border whitespace-nowrap',
                                                sig.momentum_status === 'ACCELERATING' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' :
                                                    sig.momentum_status === 'INCREASING' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                                                        sig.momentum_status === 'STABLE' ? 'bg-slate-500/20 text-slate-400 border-slate-500/30' :
                                                            sig.momentum_status === 'WEAKENING' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                                                                'bg-red-500/20 text-red-400 border-red-500/30'
                                            )} title={`Momentum: ${sig.momentum_status || 'UNKNOWN'}`}>
                                                {sig.momentum_icon || '❓'}
                                                {sig.momentum_status === 'ACCELERATING' && 'ACC'}
                                                {sig.momentum_status === 'INCREASING' && 'INC'}
                                                {sig.momentum_status === 'STABLE' && 'STB'}
                                                {sig.momentum_status === 'WEAKENING' && 'WKN'}
                                                {sig.momentum_status === 'DECLINING' && 'DEC'}
                                                {!sig.momentum_status && 'N/A'}
                                            </span>

                                            {sig.confluence_status !== 'SINGLE_METHOD' && (
                                                <span className="text-[8px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-black uppercase whitespace-nowrap" title={`Multi-Method: ${Array.isArray(sig.confluence_methods) ? sig.confluence_methods.join(', ') : ''}`}>
                                                    {sig.confluence_status === 'TRIPLE_CONFLUENCE' ? '3M' : '2M'}
                                                </span>
                                            )}

                                            {Boolean(sig.relative_status) && String(sig.relative_status) !== 'NORMAL' && String(sig.relative_status) !== 'INSUFFICIENT_DATA' && (
                                                <span className={cn(
                                                    'text-[8px] px-1.5 py-0.5 rounded font-black uppercase border whitespace-nowrap',
                                                    sig.relative_status === 'EXTREME_ANOMALY' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                                                        sig.relative_status === 'STRONG_ANOMALY' ? 'bg-pink-500/20 text-pink-400 border-pink-500/30' :
                                                            'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                                                )} title={`Relative Flow Z-Score: ${typeof sig.z_score === 'number' ? sig.z_score.toFixed(1) : 'N/A'}`}>
                                                    {String(sig.relative_status) === 'EXTREME_ANOMALY' && 'EXT'}
                                                    {String(sig.relative_status) === 'STRONG_ANOMALY' && 'STR'}
                                                    {String(sig.relative_status) === 'MODERATE_ANOMALY' && 'MOD'}
                                                </span>
                                            )}

                                            {sig.warning_status !== 'NO_WARNINGS' && sig.warnings && sig.warnings.length > 0 && (
                                                <span className="text-[8px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-black uppercase whitespace-nowrap" title={sig.warnings?.map((w) => w.message).join(', ') ?? ''}>
                                                    ⚠️ {sig.warnings.length}
                                                </span>
                                            )}

                                            {sig.patterns && sig.patterns.length > 0 && (
                                                <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-black uppercase whitespace-nowrap" title={sig.patterns.map((p) => p.display).join(', ')}>
                                                    {sig.patterns[0].icon} {sig.patterns.length > 1 ? `+${sig.patterns.length - 1}` : ''}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {filteredHotSignals.length === 0 && (
                    <div className="py-12 text-center text-zinc-600">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        <p className="text-[11px]">No hot signals available</p>
                    </div>
                )}
            </div>
        </div>
    );
}
