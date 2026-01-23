"use client";

import React, { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface WatchlistItem {
    ticker: string;
    spike_date: string;
    initial_score: number;
    current_stage: number;
    added_at: string;
}

interface WatchlistSidebarProps {
    selectedTicker: string | null;
    onSelect: (ticker: string | null) => void;
    refreshTrigger: number;
}

export default function WatchlistSidebar({ selectedTicker, onSelect, refreshTrigger }: WatchlistSidebarProps) {
    const [items, setItems] = useState<WatchlistItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchWatchlist = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("http://localhost:8000/api/alpha-hunter/watchlist");
            const data = await res.json();
            setItems(data.watchlist || []);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchWatchlist();
    }, [refreshTrigger]);

    const handleRemove = async (e: React.MouseEvent, ticker: string) => {
        e.stopPropagation();
        if (!confirm(`Remove ${ticker} from watchlist?`)) return;

        try {
            await fetch("http://localhost:8000/api/alpha-hunter/watchlist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "remove", ticker })
            });
            fetchWatchlist();
            if (selectedTicker === ticker) onSelect(null);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-900/50">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h2 className="font-semibold text-slate-200">Investigations</h2>
                <Button variant="ghost" size="icon" onClick={() => onSelect(null)} title="New Investigation">
                    <Plus className="h-4 w-4 text-emerald-400" />
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {items.length === 0 && (
                    <div className="p-4 text-center text-slate-500 text-sm mt-10">
                        No active investigations.<br />Start a scan to add tickers.
                    </div>
                )}

                {items.map((item) => (
                    <div
                        key={item.ticker}
                        onClick={() => onSelect(item.ticker)}
                        className={cn(
                            "group flex flex-col p-3 rounded-md cursor-pointer transition-all border border-transparent hover:bg-slate-800",
                            selectedTicker === item.ticker
                                ? "bg-slate-800 border-indigo-500/50 shadow-md"
                                : "text-slate-400"
                        )}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "font-bold text-base",
                                    selectedTicker === item.ticker ? "text-indigo-400" : "text-slate-200"
                                )}>
                                    {item.ticker}
                                </span>
                                <Badge variant="secondary" className="text-[10px] h-5 bg-slate-950">
                                    Score: {item.initial_score}
                                </Badge>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-950/30"
                                onClick={(e) => handleRemove(e, item.ticker)}
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>

                        {/* Stage Progress Bar */}
                        <div className="flex items-center gap-1 w-full mt-1">
                            {[1, 2, 3, 4].map((stage) => (
                                <div
                                    key={stage}
                                    className={cn(
                                        "h-1.5 flex-1 rounded-full",
                                        stage < item.current_stage ? "bg-emerald-500" :
                                            stage === item.current_stage ? "bg-amber-400 animate-pulse" :
                                                "bg-slate-700"
                                    )}
                                />
                            ))}
                        </div>
                        <div className="flex justify-between mt-1 text-[10px] text-slate-500">
                            <span>Stage {item.current_stage}</span>
                            <span>{item.spike_date}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
