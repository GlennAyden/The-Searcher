"use client";

import React, { useState, useCallback } from "react";
import { useAlphaHunter } from "../state/AlphaHunterContext";
import WatchlistSidebar from "./WatchlistSidebar";
import InvestigationHeader from "./InvestigationHeader";
import AnomalyScanTable from "./AnomalyScanTable";
import Stage1Summary from "./stages/Stage1Summary";
import Stage2VPACard from "./stages/Stage2VPACard";
import Stage3FlowCard from "./stages/Stage3FlowCard";
import Stage4SupplyCard from "./stages/Stage4SupplyCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FlowSignal } from "../types";

export function AlphaHunterContent() {
    const { selectedTicker, investigations, isAtScanner, addInvestigation } = useAlphaHunter();
    const [refreshKey, setRefreshKey] = useState(0);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const handleRefresh = useCallback(() => {
        setRefreshKey(prev => prev + 1);
    }, []);

    const handleAddToInvestigation = useCallback((signal: FlowSignal) => {
        const stage1Data = {
            signal_score: signal.signal_score,
            signal_strength: signal.signal_strength,
            conviction: signal.conviction,
            patterns: signal.patterns || [],
            flow: signal.flow,
            change: signal.change,
            price: signal.price,
            entry_zone: signal.entry_zone,
            detected_at: new Date().toISOString()
        };

        addInvestigation(signal.symbol, stage1Data);
    }, [addInvestigation]);

    const toggleSidebar = useCallback(() => {
        setSidebarCollapsed(prev => !prev);
    }, []);

    return (
        <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
            {/* Left Sidebar: Watchlist */}
            <div className={sidebarCollapsed ? "w-14 shrink-0 transition-all" : "w-80 shrink-0 transition-all"}>
                <WatchlistSidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Dynamic Header */}
                <InvestigationHeader onRefresh={handleRefresh} />

                {/* Content Area */}
                <ScrollArea className="flex-1">
                    <div className="p-6">
                        {isAtScanner ? (
                            // Scanner View
                            <div className="space-y-6">
                                <div>
                                    <p className="text-slate-400">
                                        Detecting smart money accumulation patterns from NeoBDM fund flow data.
                                    </p>
                                </div>

                                <AnomalyScanTable
                                    key={refreshKey}
                                    onAddToWatchlist={handleRefresh}
                                    onAddToInvestigation={handleAddToInvestigation}
                                />
                            </div>
                        ) : selectedTicker && investigations[selectedTicker] ? (
                            // Investigation View
                            <div className="space-y-6 pb-20">
                                {/* Stage 1 Summary */}
                                <Stage1Summary ticker={selectedTicker} />

                                {/* Stage 2: VPA */}
                                <Stage2VPACard ticker={selectedTicker} />

                                {/* Stage 3: Smart Money Flow */}
                                <Stage3FlowCard ticker={selectedTicker} />

                                {/* Stage 4: Supply Analysis */}
                                <Stage4SupplyCard ticker={selectedTicker} />
                            </div>
                        ) : (
                            // Fallback: No ticker selected
                            <div className="flex items-center justify-center h-96">
                                <div className="text-center">
                                    <div className="text-4xl mb-4">🔍</div>
                                    <h3 className="text-xl font-semibold text-slate-400 mb-2">
                                        No Investigation Selected
                                    </h3>
                                    <p className="text-slate-500">
                                        Select a ticker from the watchlist or add one from the Scanner.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
}
