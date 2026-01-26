"use client";

import React, { useState } from "react";
import { ArrowLeft, RefreshCw, Settings, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAlphaHunter } from "../state/AlphaHunterContext";
import { cn } from "@/lib/utils";

interface InvestigationHeaderProps {
    onRefresh?: () => void;
}

export default function InvestigationHeader({ onRefresh }: InvestigationHeaderProps) {
    const { selectedTicker, investigations, isAtScanner, goToScanner } = useAlphaHunter();
    const [now] = useState(() => Date.now());

    // Scanner view header
    if (isAtScanner) {
        return (
            <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
                <div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                        🧪 Alpha Hunter Lab
                    </h1>
                    <p className="text-sm text-slate-400">
                        Stage 1: Flow-Based Signal Scanner
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Quick stats */}
                    <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="border-slate-700 text-slate-400">
                            {Object.keys(investigations).length} Active Cases
                        </Badge>
                    </div>

                    {onRefresh && (
                        <Button variant="ghost" size="icon" onClick={onRefresh} title="Refresh Scan">
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </header>
        );
    }

    // Investigation view header
    const investigation = selectedTicker ? investigations[selectedTicker] : null;

    // Calculate progress
    const getProgressInfo = () => {
        if (!investigation) return { completed: 0, total: 4, text: "0/4 stages" };

        let completed = 1; // Stage 1 always complete
        if (investigation.stage2.status === 'ready') completed++;
        if (investigation.stage3.status === 'ready') completed++;
        if (investigation.stage4.status === 'ready' || investigation.stage4.isSkipped) completed++;

        return {
            completed,
            total: 4,
            text: `${completed}/4 stages`
        };
    };

    const progress = getProgressInfo();
    const lastUpdated = investigation?.stage2.lastUpdated ||
        investigation?.stage3.lastUpdated ||
        investigation?.stage4.lastUpdated;

    const getRelativeTime = (isoString: string | null) => {
        if (!isoString) return "Never";
        const diff = now - new Date(isoString).getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return "Just now";
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    return (
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
            <div className="flex items-center gap-4">
                {/* Back button */}
                <Button
                    variant="ghost"
                    onClick={goToScanner}
                    className="flex items-center gap-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="text-sm">Back to Scanner</span>
                </Button>

                <div className="h-6 w-px bg-slate-700" />

                {/* Ticker info */}
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold text-slate-100">
                            {selectedTicker}
                        </h1>
                        <span className="text-slate-500">Investigation</span>
                        {investigation?.isComplete && (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
                                Complete
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                        {/* Progress bar mini */}
                        <div className="flex items-center gap-1">
                            {[1, 2, 3, 4].map((stage) => (
                                <div
                                    key={stage}
                                    className={cn(
                                        "w-4 h-1.5 rounded-full transition-colors",
                                        stage <= progress.completed
                                            ? "bg-emerald-500"
                                            : "bg-slate-700"
                                    )}
                                />
                            ))}
                            <span className="ml-1">{progress.text}</span>
                        </div>
                        <span>•</span>
                        <span>Last updated: {getRelativeTime(lastUpdated || null)}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {onRefresh && (
                    <Button variant="ghost" size="icon" onClick={onRefresh} title="Refresh Data">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                )}
                <Button variant="ghost" size="icon" title="Export Report">
                    <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" title="Settings">
                    <Settings className="h-4 w-4" />
                </Button>
            </div>
        </header>
    );
}
