"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface StageProgressProps {
    ticker: string;
    currentStage?: number;
}

export default function StageProgressIndicator({ ticker, currentStage = 2 }: StageProgressProps) {
    const stages = [
        { id: 1, label: "Volume Anomaly", icon: "🌋" },
        { id: 2, label: "VPA Validation", icon: "💓" },
        { id: 3, label: "Smart Flow", icon: "🧠" },
        { id: 4, label: "Supply Analysis", icon: "📦" },
    ];

    return (
        <div className="w-full mb-8">
            <div className="relative flex items-center justify-between w-full">
                {/* Connecting Line */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-800 z-0" />

                {stages.map((stage) => {
                    const isCompleted = stage.id < currentStage;
                    const isCurrent = stage.id === currentStage;
                    const isFuture = stage.id > currentStage;

                    return (
                        <div key={stage.id} className="relative z-10 flex flex-col items-center group cursor-pointer">
                            <div className={cn(
                                "w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-300",
                                isCompleted ? "bg-emerald-900 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]" :
                                    isCurrent ? "bg-slate-900 border-indigo-500 text-indigo-400 scale-110 shadow-[0_0_20px_rgba(99,102,241,0.5)]" :
                                        "bg-slate-900 border-slate-700 text-slate-600"
                            )}>
                                <span className="text-xl">{stage.icon}</span>
                            </div>
                            <div className={cn(
                                "mt-3 text-sm font-medium transition-colors",
                                isCompleted ? "text-emerald-400" :
                                    isCurrent ? "text-indigo-400" :
                                        "text-slate-600"
                            )}>
                                {stage.label}
                            </div>
                            {isCurrent && (
                                <div className="absolute -bottom-6 text-[10px] text-indigo-300 animate-pulse">
                                    IN PROGRESS
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
