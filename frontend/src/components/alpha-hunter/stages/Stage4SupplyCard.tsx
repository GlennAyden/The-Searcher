"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    RefreshCw,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Clipboard,
    FileText,
    SkipForward,
    Target,
    Shield,
    TrendingDown,
    Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAlphaHunter } from "../AlphaHunterContext";
import StageCard from "./StageCard";

interface Stage4SupplyCardProps {
    ticker: string;
}

export default function Stage4SupplyCard({ ticker }: Stage4SupplyCardProps) {
    const {
        investigations,
        updateStageStatus,
        updateStage4Data,
        setManualDataInput,
        skipStage4,
        canProceedToStage
    } = useAlphaHunter();

    const investigation = investigations[ticker];
    const stage3 = investigation?.stage3;
    const stage4 = investigation?.stage4;
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [parseError, setParseError] = useState<string | null>(null);

    if (!investigation) return null;

    // Check if Stage 3 is complete
    const canStart = canProceedToStage(ticker, 4);

    // Handle paste from clipboard
    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setManualDataInput(ticker, text);
            setParseError(null);
        } catch (error) {
            console.error("Failed to paste:", error);
        }
    };

    // Handle text change
    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setManualDataInput(ticker, e.target.value);
        setParseError(null);
    };

    // Analyze the pasted data
    const analyzeData = async () => {
        if (!stage4.manualDataInput.trim()) {
            setParseError("Please paste broker transaction data first");
            return;
        }

        setIsAnalyzing(true);
        updateStageStatus(ticker, 4, 'loading');

        try {
            const response = await fetch('http://localhost:8000/api/alpha-hunter/parse-done-detail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticker,
                    raw_data: stage4.manualDataInput
                })
            });

            if (!response.ok) {
                throw new Error("Failed to parse data");
            }

            const data = await response.json();

            if (data.error) {
                setParseError(data.error);
                updateStageStatus(ticker, 4, 'error', data.error);
            } else {
                // Map response to Stage4Data
                // Determine supply_risk
                const supplyRisk: 'LOW' | 'MEDIUM' | 'HIGH' =
                    data.fifty_pct_rule?.passed ? 'LOW' : 'HIGH';

                // Determine demand_strength  
                const demandStrength: 'WEAK' | 'MODERATE' | 'STRONG' =
                    data.broker_concentration?.passed ? 'STRONG' : 'WEAK';

                // Determine overall signal
                let overallSignal: 'GO' | 'CAUTION' | 'STOP';
                if (data.fifty_pct_rule?.passed && data.floor_price_rule?.passed) {
                    overallSignal = 'GO';
                } else if (data.fifty_pct_rule?.passed) {
                    overallSignal = 'CAUTION';
                } else {
                    overallSignal = 'STOP';
                }

                const supplyData = {
                    ticker,
                    supply_risk: supplyRisk,
                    demand_strength: demandStrength,
                    overall_signal: overallSignal,
                    confidence_score: Math.round((
                        (data.fifty_pct_rule?.passed ? 30 : 0) +
                        (data.floor_price_rule?.passed ? 30 : 0) +
                        (data.broker_concentration?.passed ? 20 : 0) +
                        (data.data_available ? 20 : 0)
                    )),
                    fifty_pct_rule: data.fifty_pct_rule || {
                        passed: false,
                        retail_buy: 0,
                        retail_sell: 0,
                        depletion_pct: 0
                    },
                    floor_price_rule: data.floor_price_rule || {
                        passed: false,
                        floor_price: 0,
                        close_price: 0,
                        gap_pct: 0
                    },
                    broker_concentration: data.broker_concentration || {
                        passed: false,
                        top_n_concentration: 0
                    },
                    entry_strategy: data.entry_strategy || {
                        zone_low: 0,
                        zone_high: 0,
                        stop_loss: 0,
                        target_1: 0,
                        target_2: 0,
                        risk_reward: 0
                    },
                    data_source: 'manual' as const,
                    raw_data_preview: stage4.manualDataInput.slice(0, 500)
                };

                updateStage4Data(ticker, supplyData);
            }
        } catch (error) {
            console.error("Analysis failed:", error);
            setParseError(String(error));
            updateStageStatus(ticker, 4, 'error', String(error));
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Handle skip
    const handleSkip = () => {
        if (confirm("Skip Stage 4? You can still complete the investigation based on Stage 3 results.")) {
            skipStage4(ticker);
        }
    };

    // Get signal color
    const getSignalColor = (signal: string) => {
        switch (signal) {
            case 'GO':
                return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
            case 'CAUTION':
                return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
            case 'STOP':
                return 'bg-red-500/20 text-red-400 border-red-500/50';
            default:
                return 'bg-slate-700 text-slate-400 border-slate-600';
        }
    };

    // Render content based on status
    const renderContent = () => {
        // IDLE state
        if (stage4.status === 'idle') {
            // Show recommendation banner
            const recommendation = stage3?.data && stage3.data.checks_passed >= 3
                ? 'recommended'
                : 'optional';

            return (
                <div className="space-y-6">
                    {/* Recommendation banner */}
                    <div className={cn(
                        "rounded-lg p-4 border",
                        recommendation === 'recommended'
                            ? "bg-emerald-950/20 border-emerald-500/30"
                            : "bg-slate-950/50 border-slate-800"
                    )}>
                        <div className="flex items-start gap-3">
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                recommendation === 'recommended' ? "bg-emerald-500/20" : "bg-slate-800"
                            )}>
                                {recommendation === 'recommended' ? (
                                    <Zap className="w-4 h-4 text-emerald-400" />
                                ) : (
                                    <AlertCircle className="w-4 h-4 text-slate-500" />
                                )}
                            </div>
                            <div>
                                <h4 className={cn(
                                    "font-semibold",
                                    recommendation === 'recommended' ? "text-emerald-400" : "text-slate-400"
                                )}>
                                    {recommendation === 'recommended'
                                        ? "Stage 4 Recommended"
                                        : "Stage 4 Optional"
                                    }
                                </h4>
                                <p className="text-sm text-slate-500 mt-1">
                                    {recommendation === 'recommended'
                                        ? `Based on Stage 3 results (${stage3?.data?.checks_passed}/${stage3?.data?.total_checks} checks passed), supply analysis is recommended for confirmation.`
                                        : "You can skip this stage and proceed with conclusion, or add supply data for deeper analysis."
                                    }
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Manual input instructions */}
                    <div className="bg-slate-950/50 rounded-lg p-4 border border-slate-800">
                        <h4 className="text-sm font-semibold text-slate-400 uppercase mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Manual Data Entry
                        </h4>
                        <p className="text-sm text-slate-500 mb-4">
                            Paste broker transaction data from Done Detail page.
                            Format should include broker code, buy volume, sell volume, and net position.
                        </p>

                        {/* Textarea */}
                        <div className="relative">
                            <textarea
                                value={stage4.manualDataInput || ''}
                                onChange={handleTextChange}
                                placeholder="Paste broker transaction data here...

Example format:
Code	Buy Vol	Sell Vol	Net
YP	5000000	2000000	+3000000
AB	4500000	1500000	+3000000
..."
                                className="w-full h-48 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none resize-none font-mono"
                            />

                            {/* Paste button */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handlePaste}
                                className="absolute top-2 right-2"
                            >
                                <Clipboard className="w-4 h-4 mr-1" />
                                Paste
                            </Button>
                        </div>

                        {parseError && (
                            <div className="mt-2 text-sm text-red-400 flex items-center gap-2">
                                <XCircle className="w-4 h-4" />
                                {parseError}
                            </div>
                        )}

                        <div className="text-xs text-slate-600 mt-2">
                            Format: Same as Done Detail page (TSV/Tab-separated)
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                        <Button
                            variant="outline"
                            onClick={handleSkip}
                            className="text-slate-400"
                        >
                            <SkipForward className="w-4 h-4 mr-2" />
                            Skip to Conclusion
                        </Button>

                        <Button
                            onClick={analyzeData}
                            disabled={!stage4.manualDataInput?.trim()}
                            className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500"
                        >
                            <Target className="w-4 h-4 mr-2" />
                            Analyze Supply Data
                        </Button>
                    </div>
                </div>
            );
        }

        // LOADING state
        if (stage4.status === 'loading') {
            return (
                <div className="py-8 text-center">
                    <RefreshCw className="w-8 h-8 mx-auto text-amber-400 animate-spin mb-4" />
                    <p className="text-slate-400">Analyzing supply data...</p>
                </div>
            );
        }

        // ERROR state
        if (stage4.status === 'error') {
            return (
                <div className="text-center py-8">
                    <XCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
                    <h4 className="text-lg font-semibold text-red-400 mb-2">
                        Analysis Failed
                    </h4>
                    <p className="text-slate-500 text-sm mb-4">
                        {stage4.error || "Failed to parse the data"}
                    </p>
                    <Button onClick={() => updateStageStatus(ticker, 4, 'idle')} variant="outline">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Try Again
                    </Button>
                </div>
            );
        }

        // READY state - show results
        const data = stage4.data;

        // Handle skipped state
        if (stage4.isSkipped) {
            return (
                <div className="text-center py-8">
                    <SkipForward className="w-12 h-12 mx-auto text-slate-500 mb-4" />
                    <h4 className="text-lg font-semibold text-slate-400 mb-2">
                        Stage 4 Skipped
                    </h4>
                    <p className="text-slate-500 text-sm mb-4">
                        Proceeding with conclusion based on Stage 3 results.
                    </p>
                    <Button
                        variant="outline"
                        onClick={() => updateStageStatus(ticker, 4, 'idle')}
                    >
                        Add Supply Data
                    </Button>
                </div>
            );
        }

        if (!data) return null;

        return (
            <div className="space-y-6">
                {/* Main signal */}
                <div className={cn(
                    "rounded-lg p-6 border text-center",
                    data.overall_signal === 'GO' && "bg-emerald-950/20 border-emerald-500/30",
                    data.overall_signal === 'CAUTION' && "bg-amber-950/20 border-amber-500/30",
                    data.overall_signal === 'STOP' && "bg-red-950/20 border-red-500/30"
                )}>
                    <div className="text-4xl mb-2">
                        {data.overall_signal === 'GO' && '🟢'}
                        {data.overall_signal === 'CAUTION' && '🟡'}
                        {data.overall_signal === 'STOP' && '🔴'}
                    </div>
                    <h3 className={cn(
                        "text-2xl font-bold mb-1",
                        data.overall_signal === 'GO' && "text-emerald-400",
                        data.overall_signal === 'CAUTION' && "text-amber-400",
                        data.overall_signal === 'STOP' && "text-red-400"
                    )}>
                        {data.overall_signal}
                    </h3>
                    <p className="text-slate-500">Overall Signal</p>

                    <div className="mt-4 flex items-center justify-center gap-4">
                        <Badge variant="outline" className={getSignalColor(data.supply_risk === 'LOW' ? 'GO' : 'STOP')}>
                            Supply Risk: {data.supply_risk}
                        </Badge>
                        <Badge variant="outline" className={getSignalColor(data.demand_strength === 'STRONG' ? 'GO' : 'CAUTION')}>
                            Demand: {data.demand_strength}
                        </Badge>
                    </div>

                    <div className="mt-4 text-lg font-semibold text-white">
                        Confidence: {data.confidence_score}/100
                    </div>
                </div>

                {/* Checks grid */}
                <div className="grid grid-cols-3 gap-4">
                    <div className={cn(
                        "p-4 rounded-lg border",
                        data.fifty_pct_rule.passed
                            ? "bg-emerald-950/20 border-emerald-500/30"
                            : "bg-slate-950/50 border-slate-800"
                    )}>
                        <div className="flex items-center gap-2 mb-2">
                            {data.fifty_pct_rule.passed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                                <XCircle className="w-4 h-4 text-slate-500" />
                            )}
                            <span className="text-sm font-semibold text-slate-300">50% Rule</span>
                        </div>
                        <div className="text-xs text-slate-500">
                            Depletion: {data.fifty_pct_rule.depletion_pct?.toFixed(1) || 0}%
                        </div>
                    </div>

                    <div className={cn(
                        "p-4 rounded-lg border",
                        data.floor_price_rule.passed
                            ? "bg-emerald-950/20 border-emerald-500/30"
                            : "bg-slate-950/50 border-slate-800"
                    )}>
                        <div className="flex items-center gap-2 mb-2">
                            {data.floor_price_rule.passed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                                <XCircle className="w-4 h-4 text-slate-500" />
                            )}
                            <span className="text-sm font-semibold text-slate-300">Floor Price</span>
                        </div>
                        <div className="text-xs text-slate-500">
                            Gap: {data.floor_price_rule.gap_pct?.toFixed(1) || 0}%
                        </div>
                    </div>

                    <div className={cn(
                        "p-4 rounded-lg border",
                        data.broker_concentration.passed
                            ? "bg-emerald-950/20 border-emerald-500/30"
                            : "bg-slate-950/50 border-slate-800"
                    )}>
                        <div className="flex items-center gap-2 mb-2">
                            {data.broker_concentration.passed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                                <XCircle className="w-4 h-4 text-slate-500" />
                            )}
                            <span className="text-sm font-semibold text-slate-300">Concentration</span>
                        </div>
                        <div className="text-xs text-slate-500">
                            Top-N: {data.broker_concentration.top_n_concentration?.toFixed(1) || 0}%
                        </div>
                    </div>
                </div>

                {/* Entry strategy */}
                {data.entry_strategy.zone_low > 0 && (
                    <div className="bg-slate-950/50 rounded-lg p-4 border border-slate-800">
                        <h4 className="text-sm font-semibold text-slate-400 uppercase mb-3">
                            Entry Strategy
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-slate-500">Entry Zone:</span>
                                <span className="ml-2 text-emerald-400 font-semibold">
                                    Rp {data.entry_strategy.zone_low.toLocaleString()} - {data.entry_strategy.zone_high.toLocaleString()}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-500">Stop Loss:</span>
                                <span className="ml-2 text-red-400 font-semibold">
                                    Rp {data.entry_strategy.stop_loss.toLocaleString()}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-500">Target 1:</span>
                                <span className="ml-2 text-cyan-400 font-semibold">
                                    Rp {data.entry_strategy.target_1.toLocaleString()}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-500">Target 2:</span>
                                <span className="ml-2 text-cyan-400 font-semibold">
                                    Rp {data.entry_strategy.target_2.toLocaleString()}
                                </span>
                            </div>
                        </div>

                        {data.entry_strategy.risk_reward > 0 && (
                            <div className="mt-3 text-center">
                                <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700">
                                    Risk/Reward: 1:{data.entry_strategy.risk_reward.toFixed(1)}
                                </Badge>
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateStageStatus(ticker, 4, 'idle')}
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Re-analyze
                    </Button>

                    <Button
                        className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500"
                    >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Complete Investigation
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <StageCard
            stageNumber={4}
            title="Supply Analysis"
            description="Analyzing supply pressure and broker concentration (Optional)"
            status={stage4.status}
        >
            {renderContent()}
        </StageCard>
    );
}
