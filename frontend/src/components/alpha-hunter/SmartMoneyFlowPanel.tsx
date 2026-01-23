"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, TrendingUp, Users, Ghost, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlowData {
    ticker: string;
    institutional_accumulation: {
        passed: boolean;
        net_lot: number;
        net_value: number;
        top_brokers: { code: string; lot: number; avg_price: number }[];
    };
    retail_capitulation: {
        passed: boolean;
        net_lot: number;
        pct_sold: number;
    };
    imposter_detected: {
        passed: boolean;
        suspects: { broker: string; total_lot: number; total_value: number; days_active: number }[];
    };
    floor_price_safe: {
        passed: boolean;
        floor_price: number;
        current_price: number;
        gap_pct: number;
    };
    overall_conviction: string;
    checks_passed: number;
    total_checks: number;
    data_available: boolean;
}

interface SmartMoneyFlowPanelProps {
    ticker: string;
    onStageComplete?: () => void;
}

export default function SmartMoneyFlowPanel({ ticker, onStageComplete }: SmartMoneyFlowPanelProps) {
    const [data, setData] = useState<FlowData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isScraping, setIsScraping] = useState(false);
    const [scrapeStatus, setScrapeStatus] = useState<string | null>(null);
    const [days, setDays] = useState(7);

    useEffect(() => {
        if (ticker) fetchData();
    }, [ticker, days]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`http://localhost:8000/api/alpha-hunter/flow/${ticker}?days=${days}`);
            const json = await res.json();
            setData(json);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleScrape = async () => {
        setIsScraping(true);
        setScrapeStatus("Scraping...");
        try {
            // Get last 7 trading days (simple approximation)
            const dates = [];
            const today = new Date();
            for (let i = 0; i < 10; i++) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                if (d.getDay() !== 0 && d.getDay() !== 6) { // Skip weekends
                    dates.push(d.toISOString().split('T')[0]);
                }
                if (dates.length >= 7) break;
            }

            const res = await fetch(`http://localhost:8000/api/alpha-hunter/scrape-broker/${ticker}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dates)
            });
            const result = await res.json();
            setScrapeStatus(`Scraped ${result.scraped} days, ${result.failed} failed`);

            // Refresh data after scrape
            setTimeout(() => fetchData(), 1000);
        } catch (err) {
            setScrapeStatus("Scrape failed");
            console.error(err);
        } finally {
            setIsScraping(false);
        }
    };

    if (isLoading) {
        return (
            <div className="p-10 text-center animate-pulse text-slate-500">
                <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-2" />
                Analyzing Smart Money Flow...
            </div>
        );
    }

    if (!data || !data.data_available) {
        return (
            <Card className="bg-slate-900/50 border-slate-800 border-dashed">
                <CardContent className="py-10 text-center">
                    <AlertCircle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-400 mb-2">No Broker Data Available</h3>
                    <p className="text-slate-500 text-sm mb-6">
                        Scrape broker summary data to unlock Smart Money Flow analysis.
                    </p>
                    <Button
                        onClick={handleScrape}
                        disabled={isScraping}
                        className="bg-indigo-600 hover:bg-indigo-500"
                    >
                        {isScraping ? (
                            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Scraping...</>
                        ) : (
                            <><RefreshCw className="w-4 h-4 mr-2" /> Scrape Broker Data</>
                        )}
                    </Button>
                    {scrapeStatus && (
                        <p className="text-xs text-slate-500 mt-2">{scrapeStatus}</p>
                    )}
                </CardContent>
            </Card>
        );
    }

    const getConvictionColor = (conviction: string) => {
        if (conviction === "HIGH") return "text-emerald-400 bg-emerald-950/30 border-emerald-500/50";
        if (conviction === "MEDIUM") return "text-amber-400 bg-amber-950/30 border-amber-500/50";
        return "text-red-400 bg-red-950/30 border-red-500/50";
    };

    const CheckItem = ({
        passed,
        title,
        icon: Icon,
        detail
    }: {
        passed: boolean;
        title: string;
        icon: React.ElementType;
        detail: string;
    }) => (
        <div className={cn(
            "flex items-center gap-3 p-4 rounded-lg border transition-all",
            passed
                ? "bg-emerald-950/20 border-emerald-500/30"
                : "bg-slate-950/50 border-slate-800"
        )}>
            <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                passed ? "bg-emerald-500/20" : "bg-slate-800"
            )}>
                {passed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                    <XCircle className="w-5 h-5 text-slate-600" />
                )}
            </div>
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <Icon className={cn("w-4 h-4", passed ? "text-emerald-400" : "text-slate-500")} />
                    <span className={cn("font-semibold text-sm", passed ? "text-emerald-400" : "text-slate-500")}>
                        {title}
                    </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{detail}</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header with Conviction Score */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-slate-100">Stage 3: Smart Money Flow</h3>
                    <p className="text-slate-400 text-sm">Validating institutional activity and floor price safety.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge className={cn("text-lg px-4 py-2 font-black", getConvictionColor(data.overall_conviction))}>
                        {data.overall_conviction} CONVICTION
                    </Badge>
                    <div className="text-right">
                        <div className="text-2xl font-black text-white">{data.checks_passed}/{data.total_checks}</div>
                        <div className="text-xs text-slate-500">Checks Passed</div>
                    </div>
                </div>
            </div>

            {/* Validation Checklist Grid */}
            <div className="grid grid-cols-2 gap-4">
                <CheckItem
                    passed={data.institutional_accumulation.passed}
                    title="Institutional Accumulation"
                    icon={Users}
                    detail={data.institutional_accumulation.passed
                        ? `+${data.institutional_accumulation.net_lot.toLocaleString()} lot accumulated`
                        : "No significant institutional buying"
                    }
                />
                <CheckItem
                    passed={data.retail_capitulation.passed}
                    title="Retail Capitulation"
                    icon={TrendingUp}
                    detail={data.retail_capitulation.passed
                        ? `${Math.abs(data.retail_capitulation.net_lot).toLocaleString()} lot sold by retail`
                        : "Retail still holding"
                    }
                />
                <CheckItem
                    passed={data.imposter_detected.passed}
                    title="Imposter Detected"
                    icon={Ghost}
                    detail={data.imposter_detected.passed
                        ? `${data.imposter_detected.suspects.length} suspicious broker(s) found`
                        : "No imposter activity"
                    }
                />
                <CheckItem
                    passed={data.floor_price_safe.passed}
                    title="Floor Price Safety"
                    icon={Shield}
                    detail={data.floor_price_safe.floor_price > 0
                        ? `Gap: ${data.floor_price_safe.gap_pct}% from Rp ${data.floor_price_safe.floor_price.toLocaleString()}`
                        : "No floor price data"
                    }
                />
            </div>

            {/* Floor Price Visualization */}
            {data.floor_price_safe.floor_price > 0 && (
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardContent className="pt-6">
                        <h4 className="text-sm font-bold text-slate-400 uppercase mb-4">Floor Price Zone</h4>
                        <div className="relative h-16 bg-slate-950 rounded-lg overflow-hidden">
                            {/* Floor Zone (Green) */}
                            <div
                                className="absolute left-0 top-0 h-full bg-emerald-500/20 border-r-2 border-emerald-500"
                                style={{ width: '60%' }}
                            />
                            {/* Current Price Marker */}
                            <div
                                className="absolute top-0 h-full w-1 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]"
                                style={{
                                    left: `${Math.min(95, Math.max(5, 60 + (data.floor_price_safe.gap_pct * 2)))}%`
                                }}
                            />
                            {/* Labels */}
                            <div className="absolute bottom-1 left-2 text-xs text-emerald-400 font-bold">
                                Floor: Rp {data.floor_price_safe.floor_price.toLocaleString()}
                            </div>
                            <div className="absolute top-1 right-2 text-xs text-indigo-400 font-bold">
                                Now: Rp {data.floor_price_safe.current_price.toLocaleString()} (+{data.floor_price_safe.gap_pct}%)
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Top Institutional Buyers */}
            {data.institutional_accumulation.top_brokers.length > 0 && (
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardContent className="pt-6">
                        <h4 className="text-sm font-bold text-slate-400 uppercase mb-4">Top Institutional Buyers</h4>
                        <div className="flex flex-wrap gap-2">
                            {data.institutional_accumulation.top_brokers.map((b, i) => (
                                <div key={b.code} className="bg-blue-950/30 border border-blue-500/30 rounded-lg px-4 py-2">
                                    <div className="font-bold text-blue-400">{b.code}</div>
                                    <div className="text-xs text-slate-500">{b.lot.toLocaleString()} lot @ Rp {b.avg_price.toLocaleString()}</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Imposter Suspects */}
            {data.imposter_detected.suspects.length > 0 && (
                <Card className="bg-slate-900/50 border-purple-500/30">
                    <CardContent className="pt-6">
                        <h4 className="text-sm font-bold text-purple-400 uppercase mb-4 flex items-center gap-2">
                            <Ghost className="w-4 h-4" /> Imposter Suspects
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {data.imposter_detected.suspects.map((s) => (
                                <div key={s.broker} className="bg-purple-950/30 border border-purple-500/30 rounded-lg px-4 py-2">
                                    <div className="font-bold text-purple-400">{s.broker}</div>
                                    <div className="text-xs text-slate-500">{s.total_lot.toLocaleString()} lot in {s.days_active} days</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchData}>
                        <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleScrape} disabled={isScraping}>
                        {isScraping ? "Scraping..." : "Re-scrape Data"}
                    </Button>
                </div>
                {scrapeStatus && (
                    <span className="text-xs text-slate-500">{scrapeStatus}</span>
                )}
            </div>
        </div>
    );
}
