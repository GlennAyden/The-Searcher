"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Loader2, Sparkles } from 'lucide-react';
import { API_BASE_URL } from '@/services/api/base';

interface Scenario {
    label: string;
    condition: string;
    upside?: string;
    downside?: string;
    probability: number;
}

interface TradePlan {
    action: string;
    rationale: string;
    entry_zone: { low: number; high: number };
    targets: number[];
    stop_loss: number;
    risk_reward_ratio: number;
    success_probability: number;
    scenarios: {
        berhasil: Scenario;
        gagal: Scenario;
    };
}

interface BacktestData {
    symbol: string;
    win_rate: number;
    total_trades: number;
    wins?: number;
    losses?: number;
    avg_return: number;
    best_trade?: number;
    worst_trade?: number;
    max_drawdown?: number;
    avg_holding_days?: number;
    period_days?: number;
    note?: string;
}

interface ForecastingCardProps {
    plan: TradePlan;
    symbol: string;
    className?: string;
}

export const ForecastingCard: React.FC<ForecastingCardProps> = ({ plan, symbol, className }) => {
    const [backtestData, setBacktestData] = useState<BacktestData | null>(null);
    const [backtestLoading, setBacktestLoading] = useState(false);
    const [aiInsight, setAiInsight] = useState<string | null>(null);
    const [aiLoading, setAiLoading] = useState(false);

    const handleValidateStrategy = async () => {
        setBacktestLoading(true);
        setBacktestData(null); // Clear previous data
        try {
            const response = await fetch(`${API_BASE_URL}/api/forecast/${symbol}/backtest`);

            if (!response.ok) {
                // Try to get error detail from response
                const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
                throw new Error(errorData.detail || 'Backtest failed');
            }

            const data = await response.json();
            setBacktestData(data);
        } catch (error) {
            console.error('Backtest error:', error);
            // Set error state with user-friendly message
            setBacktestData({
                symbol: symbol,
                win_rate: 0,
                total_trades: 0,
                wins: 0,
                losses: 0,
                avg_return: 0,
                best_trade: 0,
                worst_trade: 0,
                max_drawdown: 0,
                avg_holding_days: 0,
                period_days: 180,
                note: error instanceof Error ? error.message : "Backtest unavailable for this ticker"
            });
        } finally {
            setBacktestLoading(false);
        }
    };

    const handleGetInsight = async () => {
        setAiLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/forecast/${symbol}/insight`);
            if (!response.ok) throw new Error('AI Insight failed');
            const data = await response.json();
            setAiInsight(data.insight);
        } catch (error) {
            console.error('AI Insight error:', error);
            setAiInsight("Maaf, AI insight tidak tersedia saat ini. Pastikan Ollama service sedang berjalan.");
        } finally {
            setAiLoading(false);
        }
    };

    // Determine color theme based on action
    const isBuy = plan.action.includes('BUY');
    const isWait = plan.action.includes('WAIT');

    const themeColor = isBuy ? 'emerald' : isWait ? 'amber' : 'red';

    // Helper for dynamic classes since we can't interpolate partial class names easily with some linters/optimizers
    // mapping them explicitly for safety
    const colors = {
        emerald: {
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/20',
            text: 'text-emerald-400',
            badge: 'bg-emerald-500',
            glow: 'bg-emerald-500/10',
        },
        amber: {
            bg: 'bg-amber-500/10',
            border: 'border-amber-500/20',
            text: 'text-amber-400',
            badge: 'bg-amber-500',
            glow: 'bg-amber-500/10',
        },
        red: {
            bg: 'bg-red-500/10',
            border: 'border-red-500/20',
            text: 'text-red-400',
            badge: 'bg-red-500',
            glow: 'bg-red-500/10',
        }
    }[themeColor];

    return (
        <div className={cn("bg-zinc-900/30 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm", className)}>
            {/* Background Decor */}
            <div className={cn("absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2", colors.glow)} />

            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <span className={cn("w-1.5 h-6 rounded-full", colors.badge)} />
                Trade Plan
            </h3>

            <div className="space-y-6">
                {/* Action Header */}
                <div className={cn("text-center p-4 rounded-xl border relative overflow-hidden", colors.bg, colors.border)}>
                    <span className={cn("block text-[10px] uppercase tracking-widest font-bold mb-1 opacity-70", colors.text)}>Recommended Action</span>
                    <span className={cn("text-2xl font-black tracking-tight", colors.text)}>
                        {plan.action.replace(/_/g, ' ')}
                    </span>
                    <p className="text-xs text-zinc-400 mt-2 px-4 leading-relaxed italic relative z-10">
                        "{plan.rationale}"
                    </p>
                </div>

                {/* Risk Reward Badge (New) */}
                <div className="flex justify-center">
                    <div className="bg-zinc-800/80 rounded-full px-4 py-1 text-xs font-mono text-zinc-400 border border-zinc-700/50">
                        Risk/Reward: <span className="text-white font-bold">{plan.risk_reward_ratio}x</span>
                    </div>
                </div>

                {/* Levels Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50 hover:bg-zinc-800 transition-colors group">
                        <span className="text-[9px] uppercase text-zinc-500 font-bold block mb-1 group-hover:text-blue-400 transition-colors">Entry Zone</span>
                        <span className="text-lg font-mono text-zinc-200 block group-hover:text-white">
                            {plan.entry_zone.low} - {plan.entry_zone.high}
                        </span>
                    </div>
                    <div className="p-3 bg-red-900/10 rounded-lg border border-red-500/20 hover:bg-red-900/20 transition-colors">
                        <span className="text-[9px] uppercase text-red-400 font-bold block mb-1">Stop Loss</span>
                        <span className="text-lg font-mono text-red-400 block">
                            &lt; {plan.stop_loss}
                        </span>
                    </div>
                </div>

                {/* Targets */}
                <div className="space-y-2">
                    <span className="text-[10px] uppercase text-zinc-500 font-bold block">Target Prices (Upside)</span>
                    {plan.targets.map((tp, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-blue-900/10 border border-blue-500/20 rounded-lg hover:border-blue-500/40 transition-colors relative overflow-hidden">
                            {/* Progress bar effect (visual flair) */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500/50" />

                            <span className="text-xs font-bold text-blue-400 pl-2">TP {idx + 1}</span>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-blue-300">{tp}</span>
                                {/* Calculate potential gain % approx */}
                                <span className="text-[10px] text-blue-500/70 font-mono">
                                    (+{Math.round(((tp - plan.entry_zone.high) / plan.entry_zone.high) * 100)}%)
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Scenario Analysis (Phase B) */}
                {plan.scenarios && (
                    <div className="pt-4 border-t border-zinc-800/50 space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase text-zinc-500 font-bold">Scenario Analysis</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-zinc-400">Success Prob:</span>
                                <span className={cn(
                                    "text-xs font-bold tabular-nums",
                                    plan.success_probability > 60 ? "text-emerald-400" : "text-amber-400"
                                )}>
                                    {plan.success_probability}%
                                </span>
                            </div>
                        </div>

                        {/* Probability Bar */}
                        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className={cn(
                                    "h-full transition-all duration-1000",
                                    plan.success_probability > 60 ? "bg-emerald-500" : "bg-amber-500"
                                )}
                                style={{ width: `${plan.success_probability}%` }}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {/* Berhasil Case */}
                            {plan.scenarios.berhasil && (
                                <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        <span className="text-[9px] font-bold text-emerald-400 uppercase">Bullish</span>
                                    </div>
                                    <p className="text-[10px] text-zinc-400 leading-tight">
                                        {plan.scenarios.berhasil.condition}
                                    </p>
                                    <span className="text-[10px] font-bold text-emerald-300 block mt-1">
                                        Upside: {plan.scenarios.berhasil.upside}
                                    </span>
                                </div>
                            )}

                            {/* Gagal Case */}
                            {plan.scenarios.gagal && (
                                <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                        <span className="text-[9px] font-bold text-red-400 uppercase">Bearish</span>
                                    </div>
                                    <p className="text-[10px] text-zinc-400 leading-tight">
                                        {plan.scenarios.gagal.condition}
                                    </p>
                                    <span className="text-[10px] font-bold text-red-300 block mt-1">
                                        Downside: {plan.scenarios.gagal.downside}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Historical Accuracy (Phase C Part 1) */}
                <div className="pt-4 border-t border-zinc-800/50 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase text-zinc-500 font-bold">
                            Historical Accuracy
                        </span>
                        {!backtestData && !backtestLoading && (
                            <button
                                onClick={handleValidateStrategy}
                                className="px-3 py-1 text-[10px] bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-md text-blue-300 font-bold transition-colors"
                            >
                                Validate Strategy
                            </button>
                        )}
                    </div>

                    {backtestLoading && (
                        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Analyzing last 6 months...</span>
                        </div>
                    )}

                    {backtestData && (
                        <>
                            {backtestData.note && (
                                <div className="p-2 rounded bg-yellow-500/10 border border-yellow-500/30">
                                    <div className="text-[10px] text-yellow-400">
                                        {backtestData.note}
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="p-2 rounded bg-emerald-500/5 border border-emerald-500/20">
                                    <div className="text-[9px] text-zinc-500 uppercase">Win Rate</div>
                                    <div className="text-sm font-bold text-emerald-400">
                                        {backtestData.win_rate}%
                                    </div>
                                </div>
                                <div className="p-2 rounded bg-blue-500/5 border border-blue-500/20">
                                    <div className="text-[9px] text-zinc-500 uppercase">Avg Return</div>
                                    <div className="text-sm font-bold text-blue-400">
                                        {backtestData.avg_return > 0 ? '+' : ''}{backtestData.avg_return}%
                                    </div>
                                </div>
                                <div className="p-2 rounded bg-zinc-800/50 border border-zinc-700">
                                    <div className="text-[9px] text-zinc-500 uppercase">Trades</div>
                                    <div className="text-sm font-bold text-zinc-300">
                                        {backtestData.total_trades}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* AI Insight (Phase C Part 2) */}
                <div className="pt-4 border-t border-zinc-800/50 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase text-zinc-500 font-bold flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3" />
                            AI Analyst Insight
                        </span>
                        {!aiInsight && !aiLoading && (
                            <button
                                onClick={handleGetInsight}
                                className="px-3 py-1 text-[10px] bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-md text-purple-300 font-bold transition-colors"
                            >
                                Generate Insight
                            </button>
                        )}
                    </div>

                    {aiLoading && (
                        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>AI analyzing market conditions...</span>
                        </div>
                    )}

                    {aiInsight && (
                        <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/5 to-blue-500/5 border border-purple-500/20">
                            <div className="flex items-start gap-2">
                                <Sparkles className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                                <p className="text-[11px] text-zinc-300 leading-relaxed">
                                    {aiInsight}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
