"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Target, Zap, Users, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SupplyData {
    ticker: string;
    fifty_pct_rule: {
        passed: boolean;
        retail_buy: number;
        retail_sell: number;
        depletion_pct: number;
        status: string;
    };
    one_click_orders: Array<{
        buyer: string;
        seller: string;
        lot: number;
        price: number;
        time: string;
        type: string;
    }>;
    broker_positions: {
        institutional: Array<{ broker: string; buy_lot: number; sell_lot: number; net_lot: number }>;
        retail: Array<{ broker: string; buy_lot: number; sell_lot: number; net_lot: number }>;
        foreign: Array<{ broker: string; buy_lot: number; sell_lot: number; net_lot: number }>;
    };
    entry_recommendation: {
        zone_low: number;
        zone_high: number;
        stop_loss: number;
        strategy: string;
    };
    data_available: boolean;
    total_trades: number;
    trades_parsed?: number;
}

interface SupplyAnalysisPanelProps {
    ticker: string;
}

export default function SupplyAnalysisPanel({ ticker }: SupplyAnalysisPanelProps) {
    const [data, setData] = useState<SupplyData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [rawData, setRawData] = useState("");
    const [parseError, setParseError] = useState<string | null>(null);

    useEffect(() => {
        if (ticker) fetchData();
    }, [ticker]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`http://localhost:8000/api/alpha-hunter/supply/${ticker}`);
            const json = await res.json();
            setData(json);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleParse = async () => {
        if (!rawData.trim()) {
            setParseError("Please paste Done Detail data first");
            return;
        }

        setIsParsing(true);
        setParseError(null);
        try {
            const res = await fetch("http://localhost:8000/api/alpha-hunter/parse-done-detail", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ticker, raw_data: rawData })
            });
            const json = await res.json();
            if (json.error) {
                setParseError(json.error);
            } else {
                setData(json);
                setRawData(""); // Clear on success
            }
        } catch (err) {
            setParseError("Failed to parse data");
            console.error(err);
        } finally {
            setIsParsing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="p-10 text-center animate-pulse text-slate-500">
                <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-2" />
                Loading Supply Analysis...
            </div>
        );
    }

    const getStrategyColor = (strategy: string) => {
        if (strategy.includes("STRONG BUY")) return "text-emerald-400 bg-emerald-950/30 border-emerald-500/50";
        if (strategy.includes("BUY")) return "text-green-400 bg-green-950/30 border-green-500/50";
        if (strategy.includes("SPECULATIVE")) return "text-amber-400 bg-amber-950/30 border-amber-500/50";
        return "text-slate-400 bg-slate-950/30 border-slate-500/50";
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-slate-100">Stage 4: Supply Analysis</h3>
                    <p className="text-slate-400 text-sm">Deep dive into Done Detail for final execution timing.</p>
                </div>
                {data?.data_available && (
                    <Badge className="text-sm px-3 py-1">
                        {data.total_trades.toLocaleString()} trades analyzed
                    </Badge>
                )}
            </div>

            {/* Paste Area */}
            <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="pt-6">
                    <h4 className="text-sm font-bold text-slate-400 uppercase mb-3">Paste Done Detail Data</h4>
                    <textarea
                        value={rawData}
                        onChange={(e) => setRawData(e.target.value)}
                        placeholder="Paste TSV data from Done Detail here...&#10;Format: Time TAB Price TAB Lot TAB Buyer TAB Seller"
                        className="w-full h-32 bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm font-mono text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
                    />
                    <div className="flex items-center justify-between mt-3">
                        <Button
                            onClick={handleParse}
                            disabled={isParsing || !rawData.trim()}
                            className="bg-indigo-600 hover:bg-indigo-500"
                        >
                            {isParsing ? (
                                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Parsing...</>
                            ) : (
                                <><Zap className="w-4 h-4 mr-2" /> Analyze Data</>
                            )}
                        </Button>
                        {parseError && (
                            <span className="text-sm text-red-400">{parseError}</span>
                        )}
                        {data?.trades_parsed && (
                            <span className="text-sm text-emerald-400">✓ {data.trades_parsed} trades parsed</span>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Results - only show if data available */}
            {data?.data_available && (
                <>
                    {/* Entry Recommendation */}
                    <Card className={cn("border-2", getStrategyColor(data.entry_recommendation.strategy))}>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Target className="w-5 h-5" /> Execution Guide
                                </h4>
                                <Badge className={cn("text-lg px-4 py-2", getStrategyColor(data.entry_recommendation.strategy))}>
                                    {data.entry_recommendation.strategy.split(" - ")[0]}
                                </Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-slate-950/50 p-4 rounded-lg text-center">
                                    <div className="text-xs text-slate-500 uppercase">Entry Zone Low</div>
                                    <div className="text-2xl font-black text-emerald-400">
                                        Rp {data.entry_recommendation.zone_low.toLocaleString()}
                                    </div>
                                </div>
                                <div className="bg-slate-950/50 p-4 rounded-lg text-center">
                                    <div className="text-xs text-slate-500 uppercase">Entry Zone High</div>
                                    <div className="text-2xl font-black text-blue-400">
                                        Rp {data.entry_recommendation.zone_high.toLocaleString()}
                                    </div>
                                </div>
                                <div className="bg-slate-950/50 p-4 rounded-lg text-center">
                                    <div className="text-xs text-slate-500 uppercase">Stop Loss</div>
                                    <div className="text-2xl font-black text-red-400">
                                        Rp {data.entry_recommendation.stop_loss.toLocaleString()}
                                    </div>
                                </div>
                            </div>
                            <p className="text-sm text-slate-400 mt-4 text-center">
                                {data.entry_recommendation.strategy}
                            </p>
                        </CardContent>
                    </Card>

                    {/* 50% Rule */}
                    <Card className="bg-slate-900/50 border-slate-800">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-bold text-slate-400 uppercase flex items-center gap-2">
                                    <TrendingDown className="w-4 h-4" /> 50% Rule (Retail Depletion)
                                </h4>
                                {data.fifty_pct_rule.passed ? (
                                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                        <CheckCircle2 className="w-3 h-3 mr-1" /> PASSED
                                    </Badge>
                                ) : (
                                    <Badge className="bg-slate-800 text-slate-400">
                                        <XCircle className="w-3 h-3 mr-1" /> NOT MET
                                    </Badge>
                                )}
                            </div>
                            <div className="relative h-8 bg-slate-950 rounded-full overflow-hidden">
                                <div
                                    className={cn(
                                        "h-full transition-all duration-1000 rounded-full",
                                        data.fifty_pct_rule.depletion_pct >= 50 ? "bg-emerald-500" : "bg-amber-500"
                                    )}
                                    style={{ width: `${Math.min(100, data.fifty_pct_rule.depletion_pct)}%` }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                                    {data.fifty_pct_rule.depletion_pct}% Retail Sold
                                </div>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500 mt-2">
                                <span>Retail Buy: {data.fifty_pct_rule.retail_buy.toLocaleString()} lot</span>
                                <span>Retail Sell: {data.fifty_pct_rule.retail_sell.toLocaleString()} lot</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* One-Click Orders */}
                    {data.one_click_orders.length > 0 && (
                        <Card className="bg-slate-900/50 border-amber-500/30">
                            <CardContent className="pt-6">
                                <h4 className="text-sm font-bold text-amber-400 uppercase mb-4 flex items-center gap-2">
                                    <Zap className="w-4 h-4" /> One-Click Hunter (Large Orders)
                                </h4>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {data.one_click_orders.slice(0, 10).map((order, i) => (
                                        <div key={i} className="flex items-center justify-between bg-slate-950/50 p-3 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <Badge className={order.type === "ONE_CLICK" ? "bg-amber-500/20 text-amber-400" : "bg-slate-700 text-slate-400"}>
                                                    {order.lot.toLocaleString()} lot
                                                </Badge>
                                                <span className="text-sm text-slate-300">
                                                    @ Rp {order.price.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className="text-emerald-400">{order.buyer}</span>
                                                <span className="text-slate-600">→</span>
                                                <span className="text-red-400">{order.seller}</span>
                                                <span className="text-slate-600">{order.time}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Broker Positions Grid */}
                    <div className="grid grid-cols-3 gap-4">
                        {/* Institutional */}
                        <Card className="bg-slate-900/50 border-blue-500/30">
                            <CardContent className="pt-4">
                                <h5 className="text-xs font-bold text-blue-400 uppercase mb-3 flex items-center gap-1">
                                    <Users className="w-3 h-3" /> Institutional
                                </h5>
                                <div className="space-y-1">
                                    {data.broker_positions.institutional.slice(0, 5).map((b) => (
                                        <div key={b.broker} className="flex justify-between text-xs">
                                            <span className="text-blue-400 font-bold">{b.broker}</span>
                                            <span className={b.net_lot > 0 ? "text-emerald-400" : "text-red-400"}>
                                                {b.net_lot > 0 ? "+" : ""}{b.net_lot.toLocaleString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Foreign */}
                        <Card className="bg-slate-900/50 border-purple-500/30">
                            <CardContent className="pt-4">
                                <h5 className="text-xs font-bold text-purple-400 uppercase mb-3">Foreign</h5>
                                <div className="space-y-1">
                                    {data.broker_positions.foreign.slice(0, 5).map((b) => (
                                        <div key={b.broker} className="flex justify-between text-xs">
                                            <span className="text-purple-400 font-bold">{b.broker}</span>
                                            <span className={b.net_lot > 0 ? "text-emerald-400" : "text-red-400"}>
                                                {b.net_lot > 0 ? "+" : ""}{b.net_lot.toLocaleString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Retail */}
                        <Card className="bg-slate-900/50 border-orange-500/30">
                            <CardContent className="pt-4">
                                <h5 className="text-xs font-bold text-orange-400 uppercase mb-3">Retail</h5>
                                <div className="space-y-1">
                                    {data.broker_positions.retail.slice(0, 5).map((b) => (
                                        <div key={b.broker} className="flex justify-between text-xs">
                                            <span className="text-orange-400 font-bold">{b.broker}</span>
                                            <span className={b.net_lot > 0 ? "text-emerald-400" : "text-red-400"}>
                                                {b.net_lot > 0 ? "+" : ""}{b.net_lot.toLocaleString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}

            {/* No Data State */}
            {!data?.data_available && !isLoading && (
                <Card className="bg-slate-900/50 border-slate-800 border-dashed">
                    <CardContent className="py-10 text-center">
                        <AlertCircle className="w-12 h-12 mx-auto text-slate-600 mb-4" />
                        <h3 className="text-lg font-semibold text-slate-500 mb-2">No Done Detail Data</h3>
                        <p className="text-slate-600 text-sm">
                            Paste Done Detail data above to analyze supply dynamics.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
