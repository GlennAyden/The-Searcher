"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    RefreshCw,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Loader2,
    Pause,
    Play,
    Square,
    TrendingUp,
    Shield,
    Users,
    ArrowRightLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAlphaHunter } from "../../state/AlphaHunterContext";
import StageCard from "./StageCard";
import { PriceLadder, ScrapingQueueItem } from "../../types";
import { API_BASE_URL } from "@/services/api/base";

interface Stage3FlowCardProps {
    ticker: string;
}

export default function Stage3FlowCard({ ticker }: Stage3FlowCardProps) {
    const {
        investigations,
        updateStageStatus,
        updateStage3Data,
        setRecommendedLadders,
        toggleLadderSelection,
        updateScrapingQueue,
        canProceedToStage
    } = useAlphaHunter();

    const investigation = investigations[ticker];
    const stage2 = investigation?.stage2;
    const stage3 = investigation?.stage3;
    const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
    const [scrapingPaused, setScrapingPaused] = useState(false);

    // Check if Stage 2 is complete
    const canStart = canProceedToStage(ticker, 3);

    // Fetch price ladder recommendations
    const fetchRecommendations = useCallback(async () => {
        if (!stage2?.data) return;

        setIsLoadingRecommendations(true);

        try {
            // Generate recommendations based on price range
            // This would typically come from an API
            const currentPrice = stage2.data.compression.avg_close || 0;
            const priceStep = currentPrice * 0.05; // 5% steps

            const ladders: PriceLadder[] = [
                {
                    id: 'support_strong',
                    range_start: Math.floor((currentPrice - priceStep * 3) / 50) * 50,
                    range_end: Math.floor((currentPrice - priceStep * 2) / 50) * 50,
                    label: 'Strong Support',
                    importance: 'recommended',
                    estimated_time_minutes: 4,
                    is_current_price: false
                },
                {
                    id: 'support_zone',
                    range_start: Math.floor((currentPrice - priceStep * 2) / 50) * 50,
                    range_end: Math.floor((currentPrice - priceStep) / 50) * 50,
                    label: 'Support Zone',
                    importance: 'recommended',
                    estimated_time_minutes: 4,
                    is_current_price: false
                },
                {
                    id: 'current_price',
                    range_start: Math.floor((currentPrice - priceStep / 2) / 50) * 50,
                    range_end: Math.floor((currentPrice + priceStep / 2) / 50) * 50,
                    label: 'Current Price',
                    importance: 'critical',
                    estimated_time_minutes: 5,
                    is_current_price: true
                },
                {
                    id: 'resistance_approach',
                    range_start: Math.floor((currentPrice + priceStep / 2) / 50) * 50,
                    range_end: Math.floor((currentPrice + priceStep * 1.5) / 50) * 50,
                    label: 'Resistance Approach',
                    importance: 'recommended',
                    estimated_time_minutes: 4,
                    is_current_price: false
                },
                {
                    id: 'first_resistance',
                    range_start: Math.floor((currentPrice + priceStep * 1.5) / 50) * 50,
                    range_end: Math.floor((currentPrice + priceStep * 2.5) / 50) * 50,
                    label: 'First Resistance',
                    importance: 'optional',
                    estimated_time_minutes: 4,
                    is_current_price: false
                },
                {
                    id: 'second_resistance',
                    range_start: Math.floor((currentPrice + priceStep * 2.5) / 50) * 50,
                    range_end: Math.floor((currentPrice + priceStep * 3.5) / 50) * 50,
                    label: 'Second Resistance',
                    importance: 'optional',
                    estimated_time_minutes: 4,
                    is_current_price: false
                }
            ];

            setRecommendedLadders(ticker, ladders);
        } catch (error) {
            console.error("Failed to fetch recommendations:", error);
        } finally {
            setIsLoadingRecommendations(false);
        }
    }, [ticker, stage2?.data, setRecommendedLadders]);

    // Load recommendations when Stage 2 completes
    useEffect(() => {
        if (canStart && stage3?.status === 'idle' && stage3.recommendedLadders.length === 0) {
            fetchRecommendations();
        }
    }, [canStart, stage3?.status, stage3?.recommendedLadders.length, fetchRecommendations]);

    // Start scraping selected ladders
    const startScraping = async () => {
        const selectedLadders = stage3.recommendedLadders.filter(
            l => stage3.selectedLadders.includes(l.id)
        );

        if (selectedLadders.length === 0) return;

        updateStageStatus(ticker, 3, 'loading');
        setScrapingPaused(false);

        // Initialize queue
        const initialQueue: ScrapingQueueItem[] = selectedLadders.map(ladder => ({
            ladder,
            status: 'pending',
            progress: 0,
            transactions_scraped: 0,
            time_elapsed_seconds: 0
        }));

        updateScrapingQueue(ticker, initialQueue);

        // Process queue sequentially
        for (let i = 0; i < selectedLadders.length; i++) {
            if (scrapingPaused) break;

            const queue = [...initialQueue];

            // Update current item to scraping
            queue[i] = { ...queue[i], status: 'scraping' };
            updateScrapingQueue(ticker, queue);

            try {
                // Simulate scraping with progress
                // In real implementation, this would call the backend API
                for (let p = 0; p <= 100; p += 10) {
                    await new Promise(r => setTimeout(r, 300));
                    queue[i] = {
                        ...queue[i],
                        progress: p,
                        transactions_scraped: Math.floor(p * 2),
                        time_elapsed_seconds: Math.floor(p / 10)
                    };
                    updateScrapingQueue(ticker, [...queue]);
                }

                // Mark complete
                queue[i] = { ...queue[i], status: 'complete', progress: 100 };
                updateScrapingQueue(ticker, [...queue]);

            } catch (error) {
                queue[i] = {
                    ...queue[i],
                    status: 'error',
                    error_message: String(error)
                };
                updateScrapingQueue(ticker, [...queue]);
            }
        }

        // Fetch flow analysis after scraping
        try {
            const response = await fetch(`${API_BASE_URL}/api/alpha-hunter/flow/${ticker}?days=7`);
            const data = await response.json();

            if (data.data_available) {
                updateStage3Data(ticker, {
                    ticker,
                    floor_price: data.floor_price_safe?.floor_price || 0,
                    current_price: data.floor_price_safe?.current_price || 0,
                    gap_pct: data.floor_price_safe?.gap_pct || 0,
                    conviction: data.overall_conviction || 'LOW',
                    smart_money_accumulation: data.smart_money_accumulation,
                    retail_capitulation: data.retail_capitulation,
                    smart_vs_retail: data.smart_vs_retail,
                    checks_passed: data.checks_passed || 0,
                    total_checks: data.total_checks || 4,
                    scraped_ranges: selectedLadders,
                    last_scraped_at: new Date().toISOString()
                });
            } else {
                updateStageStatus(ticker, 3, 'error', 'No broker data available after scraping');
            }
        } catch (error) {
            updateStageStatus(ticker, 3, 'error', String(error));
        }

    };

    // Toggle pause
    const togglePause = () => {
        setScrapingPaused(!scrapingPaused);
    };

    // Cancel scraping
    const cancelScraping = () => {
        setScrapingPaused(false);
        updateStageStatus(ticker, 3, 'idle');
        updateScrapingQueue(ticker, []);
    };

    // Get importance color
    const getImportanceColor = (importance: PriceLadder['importance']) => {
        switch (importance) {
            case 'critical':
                return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
            case 'recommended':
                return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50';
            default:
                return 'bg-slate-700 text-slate-400 border-slate-600';
        }
    };

    // Calculate estimated time
    const getEstimatedTime = () => {
        const selected = stage3.recommendedLadders.filter(
            l => stage3.selectedLadders.includes(l.id)
        );
        const totalMinutes = selected.reduce((sum, l) => sum + l.estimated_time_minutes, 0);
        return totalMinutes;
    };

    // Render content based on status
    const renderContent = () => {
        // LOCKED state is handled by StageCard

        // IDLE state - show recommendations
        if (stage3.status === 'idle') {
            const currentPrice = stage2?.data?.compression.avg_close || 0;

            return (
                <div className="space-y-6">
                    {/* Price context */}
                    <div className="bg-slate-950/50 rounded-lg p-4 border border-slate-800">
                        <h4 className="text-sm font-semibold text-slate-400 uppercase mb-3">
                            💡 Recommended Scraping Strategy
                        </h4>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div>
                                <div className="text-xs text-slate-500">Current Price</div>
                                <div className="text-lg font-bold text-white">
                                    Rp {currentPrice.toLocaleString()}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-slate-500">Support Zone</div>
                                <div className="text-lg font-bold text-emerald-400">
                                    Rp {Math.floor(currentPrice * 0.9).toLocaleString()}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-slate-500">Resistance</div>
                                <div className="text-lg font-bold text-amber-400">
                                    Rp {Math.floor(currentPrice * 1.1).toLocaleString()}
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500">
                            Based on 50-120 day price action analysis
                        </p>
                    </div>

                    {/* Ladder selection */}
                    {isLoadingRecommendations ? (
                        <div className="text-center py-8">
                            <Loader2 className="w-8 h-8 mx-auto animate-spin text-slate-500" />
                            <p className="text-slate-500 mt-2">Loading recommendations...</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="text-sm text-slate-400 mb-3">
                                Select price ladders to scrape:
                            </div>

                            {stage3.recommendedLadders.map((ladder) => {
                                const isSelected = stage3.selectedLadders.includes(ladder.id);

                                return (
                                    <div
                                        key={ladder.id}
                                        className={cn(
                                            "flex items-center gap-4 p-3 rounded-lg border transition-all cursor-pointer",
                                            isSelected
                                                ? "bg-slate-800/50 border-emerald-500/30"
                                                : "bg-slate-950/30 border-slate-800 hover:border-slate-700"
                                        )}
                                        onClick={() => toggleLadderSelection(ticker, ladder.id)}
                                    >
                                        <Checkbox
                                            checked={isSelected}
                                            className="data-[state=checked]:bg-emerald-500"
                                        />

                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-slate-200">
                                                    Rp {ladder.range_start.toLocaleString()} - {ladder.range_end.toLocaleString()}
                                                </span>
                                                {ladder.is_current_price && (
                                                    <span className="text-amber-400">⭐</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {ladder.label}
                                            </div>
                                        </div>

                                        <Badge variant="outline" className={getImportanceColor(ladder.importance)}>
                                            {ladder.importance}
                                        </Badge>

                                        <div className="text-xs text-slate-500">
                                            ~{ladder.estimated_time_minutes}min
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Selection summary */}
                    <div className="bg-slate-950/50 rounded-lg p-4 border border-slate-800">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm text-slate-400">
                                    Selected: <span className="text-white font-bold">{stage3.selectedLadders.length}</span> ranges
                                </div>
                                <div className="text-xs text-slate-500">
                                    Estimated time: ~{getEstimatedTime()} minutes
                                </div>
                            </div>

                            <Button
                                onClick={startScraping}
                                disabled={stage3.selectedLadders.length === 0}
                                className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500"
                            >
                                <Play className="w-4 h-4 mr-2" />
                                Start NeoBDM Scraping
                            </Button>
                        </div>
                    </div>

                    {/* Warning */}
                    <div className="flex items-start gap-2 text-xs text-amber-400/70">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                            Scraping will be sequential (one-by-one). You can switch to other tickers while waiting.
                        </div>
                    </div>
                </div>
            );
        }

        // LOADING state - show scraping progress
        if (stage3.status === 'loading') {
            const queue = stage3.scrapingQueue;
            const completed = queue.filter(q => q.status === 'complete').length;
            const total = queue.length;
            const overallProgress = total > 0 ? (completed / total) * 100 : 0;
            const currentItem = queue.find(q => q.status === 'scraping');

            return (
                <div className="space-y-6">
                    {/* Overall progress */}
                    <div className="bg-slate-950/50 rounded-lg p-4 border border-slate-800">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-slate-400">Overall Progress</span>
                            <span className="text-white font-bold">{completed}/{total} ranges</span>
                        </div>
                        <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all"
                                style={{ width: `${overallProgress}%` }}
                            />
                        </div>
                    </div>

                    {/* Queue visualization */}
                    <div className="space-y-2">
                        <div className="text-sm text-slate-400 mb-2">Scraping Queue:</div>

                        {queue.map((item) => (
                            <div
                                key={item.ladder.id}
                                className={cn(
                                    "flex items-center gap-4 p-3 rounded-lg border transition-all",
                                    item.status === 'complete' && "bg-emerald-950/20 border-emerald-500/30",
                                    item.status === 'scraping' && "bg-amber-950/20 border-amber-500/30",
                                    item.status === 'pending' && "bg-slate-950/30 border-slate-800",
                                    item.status === 'error' && "bg-red-950/20 border-red-500/30"
                                )}
                            >
                                {/* Status icon */}
                                <div className="w-6 h-6 flex items-center justify-center">
                                    {item.status === 'complete' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                                    {item.status === 'scraping' && <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />}
                                    {item.status === 'pending' && <div className="w-2 h-2 rounded-full bg-slate-600" />}
                                    {item.status === 'error' && <XCircle className="w-5 h-5 text-red-400" />}
                                </div>

                                {/* Ladder info */}
                                <div className="flex-1">
                                    <div className="text-sm text-slate-200">
                                        Rp {item.ladder.range_start.toLocaleString()} - {item.ladder.range_end.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {item.ladder.label}
                                    </div>
                                </div>

                                {/* Status text */}
                                <div className="text-xs">
                                    {item.status === 'complete' && (
                                        <span className="text-emerald-400">
                                            {item.transactions_scraped} transactions
                                        </span>
                                    )}
                                    {item.status === 'scraping' && (
                                        <span className="text-amber-400">
                                            {item.progress}%
                                        </span>
                                    )}
                                    {item.status === 'pending' && (
                                        <span className="text-slate-500">Waiting...</span>
                                    )}
                                    {item.status === 'error' && (
                                        <span className="text-red-400">Failed</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Current operation */}
                    {currentItem && (
                        <div className="bg-slate-950/50 rounded-lg p-4 border border-amber-500/30">
                            <div className="text-xs text-slate-500 uppercase mb-2">Current Operation</div>
                            <div className="flex items-center gap-3">
                                <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                                <span className="text-slate-300">
                                    Fetching broker transactions for {currentItem.ladder.label}...
                                </span>
                            </div>
                            <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-amber-500 transition-all"
                                    style={{ width: `${currentItem.progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Control buttons */}
                    <div className="flex items-center justify-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={togglePause}
                        >
                            {scrapingPaused ? (
                                <><Play className="w-4 h-4 mr-2" /> Resume</>
                            ) : (
                                <><Pause className="w-4 h-4 mr-2" /> Pause</>
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={cancelScraping}
                            className="text-red-400 border-red-500/30 hover:bg-red-950/20"
                        >
                            <Square className="w-4 h-4 mr-2" />
                            Cancel
                        </Button>
                    </div>

                    {/* Tip */}
                    <div className="text-xs text-slate-500 text-center">
                        💡 Tip: You can switch to other tickers while scraping continues in background
                    </div>
                </div>
            );
        }

        // ERROR state
        if (stage3.status === 'error') {
            return (
                <div className="text-center py-8">
                    <XCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
                    <h4 className="text-lg font-semibold text-red-400 mb-2">
                        Scraping Failed
                    </h4>
                    <p className="text-slate-500 text-sm mb-4">
                        {stage3.error || "An error occurred during scraping"}
                    </p>
                    <Button onClick={() => updateStageStatus(ticker, 3, 'idle')} variant="outline">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry
                    </Button>
                </div>
            );
        }

        // READY state - show results
        const data = stage3.data;
        if (!data) return null;

        return (
            <div className="space-y-6">
                {/* Floor price analysis */}
                <div className="bg-slate-950/50 rounded-lg p-4 border border-emerald-500/30">
                    <h4 className="text-sm font-semibold text-slate-400 uppercase mb-4">
                        📊 Floor Price Analysis
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <div className="text-xs text-slate-500">Calculated Floor</div>
                            <div className="text-2xl font-bold text-emerald-400">
                                Rp {data.floor_price.toLocaleString()}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500">Current Price</div>
                            <div className="text-2xl font-bold text-white">
                                Rp {data.current_price.toLocaleString()}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500">Margin of Safety</div>
                            <div className={cn(
                                "text-2xl font-bold",
                                data.gap_pct >= 5 ? "text-emerald-400" : data.gap_pct >= 0 ? "text-amber-400" : "text-red-400"
                            )}>
                                {data.gap_pct > 0 ? "+" : ""}{data.gap_pct.toFixed(1)}%
                            </div>
                        </div>
                    </div>
                    <div className="mt-4">
                        <Badge
                            variant="outline"
                            className={cn(
                                "text-sm px-3 py-1",
                                data.conviction === 'HIGH' && "bg-emerald-500/20 text-emerald-400 border-emerald-500/50",
                                data.conviction === 'MEDIUM' && "bg-amber-500/20 text-amber-400 border-amber-500/50",
                                data.conviction === 'LOW' && "bg-red-500/20 text-red-400 border-red-500/50"
                            )}
                        >
                            Conviction: {data.conviction}
                        </Badge>
                    </div>
                </div>

                {/* Checks grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className={cn(
                        "p-4 rounded-lg border",
                        data.smart_money_accumulation.passed
                            ? "bg-emerald-950/20 border-emerald-500/30"
                            : "bg-slate-950/50 border-slate-800"
                    )}>
                        <div className="flex items-center gap-2 mb-2">
                            <Users className={cn(
                                "w-4 h-4",
                                data.smart_money_accumulation.passed ? "text-emerald-400" : "text-slate-500"
                            )} />
                            <span className="text-sm font-semibold text-slate-300">Smart Money Accumulation</span>
                        </div>
                        <div className="text-xs text-slate-500">
                            Net {data.smart_money_accumulation.net_lot?.toLocaleString() || 0} lot
                            in {data.smart_money_accumulation.active_days || 0}/{data.smart_money_accumulation.total_days || 0} days
                        </div>
                    </div>

                    <div className={cn(
                        "p-4 rounded-lg border",
                        data.retail_capitulation.passed
                            ? "bg-emerald-950/20 border-emerald-500/30"
                            : "bg-slate-950/50 border-slate-800"
                    )}>
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className={cn(
                                "w-4 h-4",
                                data.retail_capitulation.passed ? "text-emerald-400" : "text-slate-500"
                            )} />
                            <span className="text-sm font-semibold text-slate-300">Retail Capitulation</span>
                        </div>
                        <div className="text-xs text-slate-500">
                            Net {data.retail_capitulation.net_lot?.toLocaleString() || 0} lot
                        </div>
                    </div>

                    <div className={cn(
                        "p-4 rounded-lg border",
                        data.smart_vs_retail.passed
                            ? "bg-emerald-950/20 border-emerald-500/30"
                            : "bg-slate-950/50 border-slate-800"
                    )}>
                        <div className="flex items-center gap-2 mb-2">
                            <ArrowRightLeft className={cn(
                                "w-4 h-4",
                                data.smart_vs_retail.passed ? "text-emerald-400" : "text-slate-500"
                            )} />
                            <span className="text-sm font-semibold text-slate-300">Smart vs Retail</span>
                        </div>
                        <div className="text-xs text-slate-500">
                            Dominance: {data.smart_vs_retail.dominance_pct?.toFixed(1) || 0}%
                        </div>
                    </div>

                    <div className="p-4 rounded-lg border bg-slate-950/50 border-slate-800">
                        <div className="flex items-center gap-2 mb-2">
                            <Shield className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-semibold text-slate-300">Checks Passed</span>
                        </div>
                        <div className="text-xl font-bold text-white">
                            {data.checks_passed}/{data.total_checks}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateStageStatus(ticker, 3, 'idle')}
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Re-scrape
                        </Button>
                    </div>

                    <Button
                        className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500"
                    >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Proceed to Stage 4 (Optional) →
                    </Button>
                </div>

                {/* Metadata */}
                <div className="text-xs text-slate-600 text-right">
                    Scraped {data.scraped_ranges.length} ranges • Last updated: {new Date(data.last_scraped_at).toLocaleString()}
                </div>
            </div>
        );
    };

    if (!investigation || !stage3) return null;

    return (
        <StageCard
            stageNumber={3}
            title="Smart Money Flow"
            description="Analyzing broker flow patterns and calculating floor price"
            status={stage3.status}
        >
            {renderContent()}
        </StageCard>
    );
}
