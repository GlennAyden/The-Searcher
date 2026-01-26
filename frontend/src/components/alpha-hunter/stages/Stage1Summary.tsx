"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Zap, Target, Activity } from "lucide-react";
import { useAlphaHunter } from "../AlphaHunterContext";
import { cn } from "@/lib/utils";

interface Stage1SummaryProps {
    ticker: string;
}

export default function Stage1Summary({ ticker }: Stage1SummaryProps) {
    const { investigations } = useAlphaHunter();
    const investigation = investigations[ticker];
    const stage1 = investigation?.stage1;
    const [now] = useState(() => Date.now());

    if (!stage1?.data) {
        return null;
    }

    const data = stage1.data;

    // Pattern icons
    const patternIcons: Record<string, string> = {
        'CONSISTENT_ACCUMULATION': '✅',
        'ACCELERATING_BUILDUP': '🚀',
        'TREND_REVERSAL': '🔄',
        'SIDEWAYS_ACCUMULATION': '📊',
        'SUDDEN_SPIKE': '⚡',
        'DISTRIBUTION': '❌'
    };

    // Get conviction color
    const getConvictionColor = (conviction: string) => {
        switch (conviction) {
            case 'VERY_HIGH':
                return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
            case 'HIGH':
                return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50';
            case 'MEDIUM':
                return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
            default:
                return 'bg-slate-700 text-slate-400 border-slate-600';
        }
    };

    // Get entry zone color
    const getEntryZoneColor = (zone: string) => {
        switch (zone) {
            case 'SWEET_SPOT':
                return 'bg-emerald-500/20 text-emerald-400';
            case 'ACCEPTABLE':
                return 'bg-amber-500/20 text-amber-400';
            default:
                return 'bg-red-500/20 text-red-400';
        }
    };

    const getRelativeTime = (isoString: string) => {
        const diff = now - new Date(isoString).getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return "Just now";
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    return (
        <Card className="bg-slate-900/40 border-slate-800 border-l-4 border-l-emerald-500">
            <CardContent className="py-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                        <span>✅</span>
                        Stage 1: Initial Detection
                    </h3>
                    <span className="text-xs text-slate-500">
                        Detected {getRelativeTime(data.detected_at)}
                    </span>
                </div>

                {/* Quick stats grid */}
                <div className="grid grid-cols-4 gap-3">
                    {/* Signal Score */}
                    <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800">
                        <div className="flex items-center gap-2 mb-1">
                            <Zap className="w-3 h-3 text-amber-400" />
                            <span className="text-[10px] uppercase text-slate-500">Score</span>
                        </div>
                        <div className="text-lg font-bold text-white">
                            {data.signal_score}
                        </div>
                        <Badge variant="outline" className={cn(
                            "text-[9px] mt-1",
                            getConvictionColor(data.conviction)
                        )}>
                            {data.conviction}
                        </Badge>
                    </div>

                    {/* Flow */}
                    <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-3 h-3 text-emerald-400" />
                            <span className="text-[10px] uppercase text-slate-500">Flow</span>
                        </div>
                        <div className="text-lg font-bold text-white">
                            {data.flow >= 1000 ? `${(data.flow / 1000).toFixed(1)}B` : `${data.flow.toFixed(0)}M`}
                        </div>
                        <div className={cn(
                            "text-[10px]",
                            data.flow > 0 ? "text-emerald-400" : "text-red-400"
                        )}>
                            {data.flow > 0 ? "Inflow" : "Outflow"}
                        </div>
                    </div>

                    {/* Price Change */}
                    <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800">
                        <div className="flex items-center gap-2 mb-1">
                            <Activity className="w-3 h-3 text-cyan-400" />
                            <span className="text-[10px] uppercase text-slate-500">Price Δ</span>
                        </div>
                        <div className={cn(
                            "text-lg font-bold",
                            data.change > 0 ? "text-emerald-400" : data.change < 0 ? "text-red-400" : "text-slate-300"
                        )}>
                            {data.change > 0 ? "+" : ""}{data.change.toFixed(1)}%
                        </div>
                        <Badge variant="outline" className={cn(
                            "text-[9px] mt-1",
                            getEntryZoneColor(data.entry_zone)
                        )}>
                            {data.entry_zone.replace('_', ' ')}
                        </Badge>
                    </div>

                    {/* Patterns */}
                    <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800">
                        <div className="flex items-center gap-2 mb-1">
                            <Target className="w-3 h-3 text-purple-400" />
                            <span className="text-[10px] uppercase text-slate-500">Patterns</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {data.patterns.slice(0, 3).map((pattern, idx) => (
                                <span
                                    key={idx}
                                    className="text-sm"
                                    title={pattern.display || pattern.name}
                                >
                                    {patternIcons[pattern.name] || '📊'}
                                </span>
                            ))}
                            {data.patterns.length > 3 && (
                                <span className="text-[10px] text-slate-500">
                                    +{data.patterns.length - 3}
                                </span>
                            )}
                        </div>
                        {data.patterns.length === 0 && (
                            <span className="text-xs text-slate-500">None</span>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
