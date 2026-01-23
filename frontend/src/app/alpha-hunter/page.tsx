"use client";

import React, { useState, useEffect } from "react";
import WatchlistSidebar from "@/components/alpha-hunter/WatchlistSidebar";
import AnomalyScanTable from "@/components/alpha-hunter/AnomalyScanTable";
import PullbackHealthPanel from "@/components/alpha-hunter/PullbackHealthPanel";
import SmartMoneyFlowPanel from "@/components/alpha-hunter/SmartMoneyFlowPanel";
import SupplyAnalysisPanel from "@/components/alpha-hunter/SupplyAnalysisPanel";
import StageProgressIndicator from "@/components/alpha-hunter/StageProgressIndicator";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AlphaHunterPage() {
    const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
    const [watchlistReset, setWatchlistReset] = useState(0); // Trigger to reload watchlist
    const [currentStage, setCurrentStage] = useState(2); // Default to stage 2 when ticker selected

    // Update current stage when ticker changes - could fetch from API or localStorage
    useEffect(() => {
        if (selectedTicker) {
            // Try to load saved stage from localStorage
            const savedStage = localStorage.getItem(`alpha_hunter_stage_${selectedTicker}`);
            if (savedStage) {
                setCurrentStage(parseInt(savedStage, 10));
            } else {
                setCurrentStage(2); // Default for new tickers
            }
        }
    }, [selectedTicker]);

    // Save stage when it changes
    const updateStage = (newStage: number) => {
        if (selectedTicker) {
            localStorage.setItem(`alpha_hunter_stage_${selectedTicker}`, newStage.toString());
            setCurrentStage(newStage);
        }
    };

    // Force refresh watchlist
    const refreshWatchlist = () => {
        setWatchlistReset(prev => prev + 1);
    };

    return (
        <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
            {/* Left Sidebar: Watchlist */}
            <div className="w-80 border-r border-slate-800 shrink-0">
                <WatchlistSidebar
                    selectedTicker={selectedTicker}
                    onSelect={setSelectedTicker}
                    refreshTrigger={watchlistReset}
                />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Header */}
                <header className="h-14 border-b border-slate-800 flex items-center px-6 bg-slate-900/50 backdrop-blur">
                    <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                        🧪 Alpha Hunter Lab
                    </h1>
                    <div className="ml-auto flex items-center space-x-4">
                        {/* Stats or Global Filters could go here */}
                        {selectedTicker && (
                            <div className="flex items-center space-x-2">
                                <span className="text-slate-400 text-sm">Active Case:</span>
                                <Badge variant="outline" className="border-emerald-500/50 text-emerald-400">
                                    {selectedTicker}
                                </Badge>
                            </div>
                        )}
                    </div>
                </header>

                {/* Workspace */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">

                    {!selectedTicker ? (
                        // State: No ticker selected -> Show Anomaly Scanner
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold">Stage 1: Flow-Based Signal Scanner</h2>
                                    <p className="text-slate-400">Detecting smart money accumulation patterns from NeoBDM fund flow data.</p>
                                </div>
                            </div>

                            <AnomalyScanTable onAddToWatchlist={refreshWatchlist} />
                        </div>
                    ) : (
                        // State: Ticker Selected -> Show Investigation Stages
                        <div className="space-y-8 pb-20">
                            {/* Stage Indicator */}
                            <StageProgressIndicator ticker={selectedTicker} currentStage={currentStage} />

                            {/* Stage 1: Detection Info (Read Only) */}
                            <Card className="bg-slate-900/40 border-slate-800">
                                <CardContent className="pt-6">
                                    <h3 className="text-lg font-semibold mb-2 flex items-center text-emerald-400">
                                        <span className="mr-2">✅</span> Stage 1: Detection Data
                                    </h3>
                                    <div className="grid grid-cols-3 gap-6">
                                        {/* We could fetch detail info here - keeping simpler for now */}
                                        <div className="p-4 rounded-lg bg-slate-950/50 border border-slate-800">
                                            <div className="text-xs text-slate-500 uppercase">Detection Signal</div>
                                            <div className="text-xl font-bold flex items-center mt-1">
                                                🔥 Volume Spike
                                            </div>
                                        </div>
                                        <p className="text-slate-400 text-sm col-span-2 flex items-center">
                                            Original signal detected anomalous volume activity. Proceed to Stage 2 to verify if the pullback is healthy.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Stage 2: Volume Price Analysis (VPA) */}
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold text-slate-100">Stage 2: Volume Price Analysis</h3>
                                <p className="text-slate-400 text-sm mb-4">Validating volume spike, sideways compression, and pullback health.</p>
                                <PullbackHealthPanel ticker={selectedTicker} />
                            </div>

                            {/* Stage 3: Smart Money Flow */}
                            <div className="space-y-2">
                                <SmartMoneyFlowPanel ticker={selectedTicker} />
                            </div>

                            {/* Stage 4: Supply Analysis */}
                            <div className="space-y-2">
                                <SupplyAnalysisPanel ticker={selectedTicker} />
                            </div>

                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
