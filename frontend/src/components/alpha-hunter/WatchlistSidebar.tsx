"use client";

import React, { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Trash2,
    BarChart3,
    ChevronDown,
    ChevronRight,
    Loader2,
    CheckCircle2,
    Lock,
    AlertCircle,
    Pause,
    PanelLeftClose,
    PanelLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/services/api/base";
import { useAlphaHunter } from "./AlphaHunterContext";
import { StageStatus } from "./types";

interface WatchlistSidebarProps {
    isCollapsed?: boolean;
    onToggle?: () => void;
}

export default function WatchlistSidebar({ isCollapsed = false, onToggle }: WatchlistSidebarProps) {
    const {
        selectedTicker,
        investigations,
        isAtScanner,
        selectTicker,
        goToScanner,
        removeInvestigation
    } = useAlphaHunter();

    const [showCompleted, setShowCompleted] = useState(false);
    const [now] = useState(() => Date.now());

    // Separate active and completed investigations
    const activeInvestigations = Object.values(investigations).filter(inv => !inv.isComplete);
    const completedInvestigations = Object.values(investigations).filter(inv => inv.isComplete);

    const handleRemove = async (e: React.MouseEvent, ticker: string) => {
        e.stopPropagation();
        if (!confirm(`Remove ${ticker} from investigations?`)) return;

        try {
            // Also remove from backend watchlist
            await fetch(`${API_BASE_URL}/api/alpha-hunter/watchlist`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "remove", ticker })
            });
        } catch (err) {
            console.error("Failed to remove from backend:", err);
        }

        removeInvestigation(ticker);
    };

    // Get stage status icon
    const getStageIcon = (status: StageStatus) => {
        switch (status) {
            case 'ready':
                return <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
            case 'loading':
                return <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />;
            case 'idle':
                return <Pause className="w-3 h-3 text-slate-500" />;
            case 'locked':
                return <Lock className="w-3 h-3 text-slate-600" />;
            case 'error':
                return <AlertCircle className="w-3 h-3 text-red-400" />;
            default:
                return null;
        }
    };

    // Get current stage info for badge
    const getCurrentStageInfo = (inv: typeof investigations[string]) => {
        // Find the current active stage
        if (inv.stage4.status === 'loading') return { num: 4, status: inv.stage4.status };
        if (inv.stage4.status === 'ready' || inv.stage4.isSkipped) return { num: 4, status: 'ready' as StageStatus };
        if (inv.stage3.status === 'loading') return { num: 3, status: inv.stage3.status };
        if (inv.stage3.status === 'ready') return { num: 3, status: inv.stage3.status };
        if (inv.stage3.status === 'idle') return { num: 3, status: inv.stage3.status };
        if (inv.stage2.status === 'loading') return { num: 2, status: inv.stage2.status };
        if (inv.stage2.status === 'ready') return { num: 2, status: inv.stage2.status };
        return { num: 2, status: inv.stage2.status };
    };

    const getRelativeTime = (isoString: string) => {
        if (!now) return "Just now";
        const diff = now - new Date(isoString).getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return "Just now";
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    // Collapsed (minimized) view
    if (isCollapsed) {
        return (
            <div className="flex flex-col h-full bg-slate-900/50 border-r border-slate-800 w-14">
                {/* Toggle button */}
                <div className="p-2 border-b border-slate-800">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onToggle}
                        className="w-10 h-10 text-slate-400 hover:text-slate-200"
                        title="Expand sidebar"
                    >
                        <PanelLeft className="w-5 h-5" />
                    </Button>
                </div>

                {/* Mini Scanner button */}
                <div className="p-2">
                    <button
                        onClick={goToScanner}
                        className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center transition-all border",
                            isAtScanner
                                ? "bg-emerald-500/20 border-emerald-500/50"
                                : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                        )}
                        title="Signal Scanner"
                    >
                        <BarChart3 className={cn(
                            "w-5 h-5",
                            isAtScanner ? "text-emerald-400" : "text-slate-400"
                        )} />
                    </button>
                </div>

                <div className="px-2 py-1">
                    <div className="h-px bg-slate-800" />
                </div>

                {/* Mini investigation buttons */}
                <ScrollArea className="flex-1 px-2">
                    <div className="space-y-1">
                        {activeInvestigations.map((inv) => {
                            const stageInfo = getCurrentStageInfo(inv);
                            const isSelected = selectedTicker === inv.ticker;

                            return (
                                <button
                                    key={inv.ticker}
                                    onClick={() => selectTicker(inv.ticker)}
                                    className={cn(
                                        "w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold transition-all border",
                                        isSelected
                                            ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-400"
                                            : "bg-slate-800/50 border-slate-700 hover:border-slate-600 text-slate-300"
                                    )}
                                    title={`${inv.ticker} - Stage ${stageInfo.num}`}
                                >
                                    {inv.ticker.slice(0, 2)}
                                </button>
                            );
                        })}
                    </div>
                </ScrollArea>

                {/* Mini stats */}
                <div className="p-2 border-t border-slate-800">
                    <div className="w-10 h-10 rounded-lg bg-slate-800/50 flex items-center justify-center text-xs text-slate-400" title={`Active: ${activeInvestigations.length}`}>
                        {activeInvestigations.length}
                    </div>
                </div>
            </div>
        );
    }

    // Expanded (full) view
    return (
        <div className="flex flex-col h-full bg-slate-900/50 border-r border-slate-800">
            {/* Header with toggle */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h2 className="font-bold text-sm text-slate-300 uppercase tracking-wide">
                    🧪 Alpha Hunter Lab
                </h2>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggle}
                    className="h-7 w-7 text-slate-400 hover:text-slate-200"
                    title="Minimize sidebar"
                >
                    <PanelLeftClose className="w-4 h-4" />
                </Button>
            </div>

            {/* Signal Scanner - Always visible */}
            <div className="p-3">
                <button
                    onClick={goToScanner}
                    className={cn(
                        "w-full p-3 rounded-lg text-left transition-all border",
                        isAtScanner
                            ? "bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border-emerald-500/50 shadow-lg shadow-emerald-500/10"
                            : "bg-slate-800/50 hover:bg-slate-800 border-slate-700 hover:border-slate-600"
                    )}
                >
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-2.5 h-2.5 rounded-full transition-colors",
                            isAtScanner ? "bg-emerald-400" : "bg-slate-600"
                        )} />
                        <BarChart3 className={cn(
                            "w-4 h-4",
                            isAtScanner ? "text-emerald-400" : "text-slate-400"
                        )} />
                        <span className={cn(
                            "font-semibold",
                            isAtScanner ? "text-emerald-400" : "text-slate-300"
                        )}>
                            Signal Scanner
                        </span>
                    </div>
                    {isAtScanner && (
                        <div className="text-xs text-emerald-400/70 mt-1 ml-9">
                            Active view
                        </div>
                    )}
                </button>
            </div>

            {/* Separator */}
            <div className="px-4 py-2">
                <div className="h-px bg-slate-800" />
            </div>

            {/* Active Investigations */}
            <div className="flex-1 overflow-hidden flex flex-col">
                <div className="px-4 py-2">
                    <h3 className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">
                        Active Investigations ({activeInvestigations.length})
                    </h3>
                </div>

                <ScrollArea className="flex-1 px-3">
                    {activeInvestigations.length === 0 ? (
                        <div className="p-4 text-center text-slate-500 text-sm">
                            No active investigations.
                            <br />
                            <span className="text-xs">Add tickers from Scanner.</span>
                        </div>
                    ) : (
                        <div className="space-y-1 pb-4">
                            {activeInvestigations.map((inv) => {
                                const stageInfo = getCurrentStageInfo(inv);
                                const isSelected = selectedTicker === inv.ticker;

                                return (
                                    <div
                                        key={inv.ticker}
                                        onClick={() => selectTicker(inv.ticker)}
                                        className={cn(
                                            "group p-3 rounded-lg cursor-pointer transition-all border",
                                            isSelected
                                                ? "bg-slate-800 border-indigo-500/50 shadow-md"
                                                : "bg-transparent border-transparent hover:bg-slate-800/50 hover:border-slate-700"
                                        )}
                                    >
                                        {/* Top row: Ticker + Stage badge */}
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={cn(
                                                    "w-2 h-2 rounded-full",
                                                    isSelected ? "bg-indigo-400" : "bg-slate-600"
                                                )} />
                                                <span className={cn(
                                                    "font-bold text-sm",
                                                    isSelected ? "text-indigo-400" : "text-slate-200"
                                                )}>
                                                    {inv.ticker}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {/* Stage badge */}
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "text-[10px] h-5 px-1.5 gap-1",
                                                        stageInfo.status === 'loading' && "border-amber-500/50 text-amber-400",
                                                        stageInfo.status === 'ready' && "border-emerald-500/50 text-emerald-400",
                                                        stageInfo.status === 'idle' && "border-slate-600 text-slate-400",
                                                        stageInfo.status === 'error' && "border-red-500/50 text-red-400"
                                                    )}
                                                >
                                                    {getStageIcon(stageInfo.status)}
                                                    S{stageInfo.num}
                                                </Badge>

                                                {/* Remove button */}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-950/30"
                                                    onClick={(e) => handleRemove(e, inv.ticker)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Stage progress bar */}
                                        <div className="flex items-center gap-0.5 mb-1.5">
                                            {[1, 2, 3, 4].map((stage) => {
                                                let stageStatus: StageStatus = 'locked';
                                                if (stage === 1) stageStatus = 'ready';
                                                else if (stage === 2) stageStatus = inv.stage2.status;
                                                else if (stage === 3) stageStatus = inv.stage3.status;
                                                else if (stage === 4) stageStatus = inv.stage4.isSkipped ? 'ready' : inv.stage4.status;

                                                return (
                                                    <div
                                                        key={stage}
                                                        className={cn(
                                                            "h-1 flex-1 rounded-full transition-colors",
                                                            stageStatus === 'ready' && "bg-emerald-500",
                                                            stageStatus === 'loading' && "bg-amber-400 animate-pulse",
                                                            stageStatus === 'idle' && "bg-slate-600",
                                                            stageStatus === 'locked' && "bg-slate-700",
                                                            stageStatus === 'error' && "bg-red-500"
                                                        )}
                                                    />
                                                );
                                            })}
                                        </div>

                                        {/* Metadata row */}
                                        <div className="flex justify-between text-[10px] text-slate-500">
                                            <span>
                                                Score: {inv.stage1.data?.signal_score || 0}
                                            </span>
                                            <span>
                                                {getRelativeTime(inv.addedAt)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
            </div>

            {/* Completed Section (Collapsible) */}
            {completedInvestigations.length > 0 && (
                <>
                    <div className="px-4 py-2 border-t border-slate-800">
                        <button
                            onClick={() => setShowCompleted(!showCompleted)}
                            className="flex items-center gap-2 text-[10px] uppercase text-slate-500 font-semibold tracking-wider hover:text-slate-400 transition-colors w-full"
                        >
                            {showCompleted ? (
                                <ChevronDown className="w-3 h-3" />
                            ) : (
                                <ChevronRight className="w-3 h-3" />
                            )}
                            Completed ({completedInvestigations.length})
                        </button>
                    </div>

                    {showCompleted && (
                        <div className="px-3 pb-3 space-y-1">
                            {completedInvestigations.map((inv) => (
                                <div
                                    key={inv.ticker}
                                    onClick={() => selectTicker(inv.ticker)}
                                    className={cn(
                                        "group p-2 rounded-lg cursor-pointer transition-all opacity-60 hover:opacity-100",
                                        selectedTicker === inv.ticker
                                            ? "bg-slate-800 border border-emerald-500/30"
                                            : "hover:bg-slate-800/50"
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                            <span className="font-medium text-sm text-slate-300">
                                                {inv.ticker}
                                            </span>
                                        </div>
                                        <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                            {inv.finalRecommendation?.action || 'DONE'}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Quick Stats */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/50">
                <div className="text-[10px] uppercase text-slate-500 font-semibold mb-2">
                    Quick Stats
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-slate-400">
                        Active: <span className="text-slate-200">{activeInvestigations.length}</span>
                    </div>
                    <div className="text-slate-400">
                        Complete: <span className="text-emerald-400">{completedInvestigations.length}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
