"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    RefreshCw,
    CheckCircle2,
    XCircle,
    AlertCircle,
    TrendingUp,
    BarChart3,
    Activity,
    Target,
    ChevronDown,
    ChevronUp,
    LayoutGrid,
    LineChart
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAlphaHunter } from "../AlphaHunterContext";
import StageCard from "./StageCard";
import Stage2VisualizationPanel from "./Stage2VisualizationPanel";
import { Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart, Bar, CartesianGrid, ReferenceLine } from 'recharts';

interface Stage2VPACardProps {
    ticker: string;
}

export default function Stage2VPACard({ ticker }: Stage2VPACardProps) {
    const {
        investigations,
        updateStageStatus,
        updateStage2Data
    } = useAlphaHunter();

    const investigation = investigations[ticker];
    const stage2 = investigation?.stage2;
    const [progress, setProgress] = useState(0);
    const [currentStep, setCurrentStep] = useState("");
    const [showDetails, setShowDetails] = useState(false);
    const [viewMode, setViewMode] = useState<'summary' | 'visualization'>('visualization');

    if (!investigation) return null;

    const fetchVPAData = async () => {
        updateStageStatus(ticker, 2, 'loading');
        setProgress(0);

        try {
            setCurrentStep("Connecting to yfinance...");
            setProgress(10);
            await new Promise(r => setTimeout(r, 500));

            setCurrentStep("Fetching OHLCV data...");
            setProgress(30);

            const response = await fetch(`http://localhost:8000/api/alpha-hunter/stage2/vpa/${ticker}`);

            if (!response.ok) {
                throw new Error("Failed to fetch VPA data");
            }

            setCurrentStep("Calculating volume metrics...");
            setProgress(60);
            await new Promise(r => setTimeout(r, 300));

            const data = await response.json();

            setCurrentStep("Analyzing pullback health...");
            setProgress(80);
            await new Promise(r => setTimeout(r, 300));

            setCurrentStep("Generating results...");
            setProgress(100);
            await new Promise(r => setTimeout(r, 200));

            updateStage2Data(ticker, data);

        } catch (error) {
            console.error("VPA fetch error:", error);
            updateStageStatus(ticker, 2, 'error', String(error));
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 70) return "text-emerald-400";
        if (score >= 50) return "text-amber-400";
        return "text-red-400";
    };

    const getVerdictColor = (verdict: string) => {
        if (verdict === 'PASS') return "bg-emerald-500/20 text-emerald-400 border-emerald-500/50";
        if (verdict === 'WATCH') return "bg-amber-500/20 text-amber-400 border-amber-500/50";
        return "bg-red-500/20 text-red-400 border-red-500/50";
    };

    const renderContent = () => {
        if (stage2.status === 'idle') {
            return (
                <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 mx-auto text-slate-500 mb-4" />
                    <h4 className="text-lg font-semibold text-slate-300 mb-2">
                        Data has not been fetched yet
                    </h4>
                    <p className="text-slate-500 text-sm mb-4">
                        Click below to start VPA analysis for {ticker}
                    </p>
                    <Button onClick={fetchVPAData} className="bg-gradient-to-r from-indigo-600 to-purple-600">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Fetch VPA Data
                    </Button>
                </div>
            );
        }

        if (stage2.status === 'loading') {
            return (
                <div className="text-center py-8">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                        <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full" />
                        <div
                            className="absolute inset-0 border-4 border-transparent border-t-indigo-500 rounded-full animate-spin"
                        />
                        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-indigo-400">
                            {progress}%
                        </div>
                    </div>
                    <p className="text-slate-400 text-sm">{currentStep}</p>
                    <div className="w-48 mx-auto mt-4 h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-indigo-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            );
        }

        if (stage2.status === 'error') {
            return (
                <div className="text-center py-8">
                    <XCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
                    <h4 className="text-lg font-semibold text-red-400 mb-2">
                        Analysis Failed
                    </h4>
                    <p className="text-slate-500 text-sm mb-4">
                        {stage2.error || "An error occurred during analysis"}
                    </p>
                    <Button onClick={fetchVPAData} variant="outline">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry
                    </Button>
                </div>
            );
        }

        // READY state - show results with new visual design
        const data = stage2.data;
        if (!data) return null;

        // Prepare chart data with colored volumes
        const chartData = data.pullback?.log?.map((entry: any) => {
            const priceChg = entry.price_chg || 0;
            // Calculate approximate open from close and price_chg
            const close = entry.price;
            const open = close / (1 + priceChg / 100);
            const isGreen = close >= open; // Green if accumulation (close >= open)

            return {
                date: entry.date?.slice(5) || '',
                close: close,
                open: open,
                volume: entry.volume,
                volumeGreen: isGreen ? entry.volume : 0,  // For green bars
                volumeRed: !isGreen ? entry.volume : 0,   // For red bars
                status: entry.status,
                priceChg: priceChg
            };
        }) || [];

        return (
            <div className="space-y-4">
                {/* ===== VIEW MODE TOGGLE ===== */}
                <div className="flex items-center gap-2 mb-2">
                    <Button
                        variant={viewMode === 'visualization' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('visualization')}
                        className={cn(
                            "text-xs",
                            viewMode === 'visualization' && "bg-indigo-600 hover:bg-indigo-700"
                        )}
                    >
                        <LineChart className="w-3 h-3 mr-1" />
                        Chart View
                    </Button>
                    <Button
                        variant={viewMode === 'summary' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('summary')}
                        className={cn(
                            "text-xs",
                            viewMode === 'summary' && "bg-indigo-600 hover:bg-indigo-700"
                        )}
                    >
                        <LayoutGrid className="w-3 h-3 mr-1" />
                        Summary
                    </Button>
                </div>

                {/* ===== VISUALIZATION MODE ===== */}
                {viewMode === 'visualization' && (
                    <Stage2VisualizationPanel ticker={ticker} />
                )}

                {/* ===== SUMMARY MODE (Original Layout) ===== */}
                {viewMode === 'summary' && (
                    <>
                        {/* ===== SECTION 1: Flow Timeline ===== */}
                        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-lg p-3 border border-slate-700">
                            <div className="flex items-center justify-between">
                                {/* Accumulation */}
                                <div className="flex-1 text-center">
                                    <div className="text-xs text-slate-500 mb-1">1. Accumulation</div>
                                    <div className="flex items-center justify-center gap-2">
                                        <Badge variant="outline" className={cn(
                                            "text-xs",
                                            data.accumulation?.volume_trend === "INCREASING"
                                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                                                : "bg-slate-500/20 text-slate-400 border-slate-500/50"
                                        )}>
                                            {data.accumulation?.accumulation_days || 0}d
                                        </Badge>
                                        <span className="text-xs text-slate-400">{data.accumulation?.volume_trend || "N/A"}</span>
                                    </div>
                                </div>

                                <div className="text-slate-600 px-2">→</div>

                                {/* Spike */}
                                <div className="flex-1 text-center">
                                    <div className="text-xs text-slate-500 mb-1">2. Spike</div>
                                    <div className="flex items-center justify-center gap-2">
                                        <span className={cn(
                                            "text-sm font-bold",
                                            (data.spike?.volume_ratio || 0) >= 3 ? "text-emerald-400" : "text-amber-400"
                                        )}>
                                            {data.spike?.volume_ratio?.toFixed(1) || 0}x
                                        </span>
                                        <span className={cn(
                                            "text-xs",
                                            (data.spike?.price_change_pct || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                                        )}>
                                            +{data.spike?.price_change_pct?.toFixed(1) || 0}%
                                        </span>
                                    </div>
                                </div>

                                <div className="text-slate-600 px-2">→</div>

                                {/* Pullback */}
                                <div className="flex-1 text-center">
                                    <div className="text-xs text-slate-500 mb-1">3. Pullback</div>
                                    <div className="flex items-center justify-center gap-2">
                                        <span className="text-lg">
                                            {data.pullback?.volume_asymmetry?.verdict === "STRONG_HOLDING" ? "💎" :
                                                data.pullback?.volume_asymmetry?.verdict === "HOLDING" ? "🤝" : "⚠️"}
                                        </span>
                                        <span className="text-xs text-slate-400">{data.pullback?.volume_asymmetry?.asymmetry_ratio?.toFixed(1) || 0}:1</span>
                                    </div>
                                </div>

                                <div className="text-slate-600 px-2">→</div>

                                {/* Breakout */}
                                <div className="flex-1 text-center">
                                    <div className="text-xs text-slate-500 mb-1">4. Breakout</div>
                                    <Badge variant="outline" className={cn(
                                        "text-xs",
                                        data.breakout_setup?.status === "ENTRY"
                                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                                            : data.breakout_setup?.status === "NEAR_BREAKOUT"
                                                ? "bg-amber-500/20 text-amber-400 border-amber-500/50"
                                                : "bg-slate-500/20 text-slate-400 border-slate-500/50"
                                    )}>
                                        {data.breakout_setup?.status === "ENTRY" ? "✅ ENTRY" :
                                            data.breakout_setup?.status === "NEAR_BREAKOUT" ? "🔥 NEAR" :
                                                `⏳ ${data.breakout_setup?.distance_pct?.toFixed(0) || 0}%`}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        {/* ===== SECTION 2: Mini Chart + Health Score ===== */}
                        <div className="grid grid-cols-3 gap-4">
                            {/* Mini Chart */}
                            <div className="col-span-2 bg-slate-950/50 rounded-lg p-3 border border-slate-800">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase">Price & Volume (Post-Spike)</h4>
                                    {data.breakout_setup?.resistance_price && (
                                        <span className="text-xs text-amber-400">
                                            Resistance: Rp {data.breakout_setup.resistance_price.toLocaleString()}
                                        </span>
                                    )}
                                </div>
                                <div className="h-32">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                            <XAxis
                                                dataKey="date"
                                                tick={{ fill: '#64748b', fontSize: 9 }}
                                                axisLine={{ stroke: '#334155' }}
                                            />
                                            <YAxis
                                                yAxisId="price"
                                                orientation="right"
                                                tick={{ fill: '#64748b', fontSize: 9 }}
                                                axisLine={{ stroke: '#334155' }}
                                                domain={['auto', 'auto']}
                                            />
                                            <YAxis
                                                yAxisId="volume"
                                                orientation="left"
                                                tick={{ fill: '#64748b', fontSize: 9 }}
                                                axisLine={{ stroke: '#334155' }}
                                                tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: '#1e293b',
                                                    border: '1px solid #334155',
                                                    borderRadius: '8px',
                                                    fontSize: '11px'
                                                }}
                                            />
                                            {data.breakout_setup?.resistance_price && (
                                                <ReferenceLine
                                                    yAxisId="price"
                                                    y={data.breakout_setup.resistance_price}
                                                    stroke="#f59e0b"
                                                    strokeDasharray="5 5"
                                                    label={{ value: 'R', fill: '#f59e0b', fontSize: 10 }}
                                                />
                                            )}
                                            <Bar
                                                yAxisId="volume"
                                                dataKey="volume"
                                                fill="#3b82f6"
                                                opacity={0.4}
                                                radius={[2, 2, 0, 0]}
                                            />
                                            <Line
                                                yAxisId="price"
                                                type="monotone"
                                                dataKey="close"
                                                stroke="#22c55e"
                                                strokeWidth={2}
                                                dot={{ fill: '#22c55e', r: 3 }}
                                            />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Health Score Card */}
                            <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800 flex flex-col justify-between">
                                <div>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Health Score</h4>
                                    <div className={cn(
                                        "text-4xl font-bold text-center",
                                        getScoreColor(data.scores?.adjusted_health_score || 0)
                                    )}>
                                        {data.scores?.adjusted_health_score || 0}
                                    </div>
                                    <div className="text-xs text-slate-500 text-center mt-1">
                                        Adjusted
                                    </div>
                                </div>

                                <div className="mt-3 pt-3 border-t border-slate-800">
                                    <Badge variant="outline" className={cn(
                                        "w-full justify-center text-sm py-1",
                                        getVerdictColor(data.verdict || '')
                                    )}>
                                        {data.verdict === "PASS" ? "✓ PASS" :
                                            data.verdict === "WATCH" ? "👀 WATCH" : "✗ FAIL"}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        {/* ===== SECTION 3: Pullback Heatmap ===== */}
                        <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase">Pullback Days</h4>
                                <span className="text-xs text-slate-500">
                                    {data.pullback?.healthy_days || 0}/{data.pullback?.days_tracked || 0} healthy
                                </span>
                            </div>
                            <div className="flex items-center gap-1 flex-wrap">
                                {data.pullback?.log?.map((entry: any, idx: number) => (
                                    <div
                                        key={idx}
                                        className={cn(
                                            "w-6 h-6 rounded flex items-center justify-center text-[10px] font-medium cursor-pointer transition-all hover:scale-110",
                                            entry.status === "HEALTHY_PULLBACK" ? "bg-emerald-500/40 text-emerald-300" :
                                                entry.status === "DISTRIBUTION_RISK" ? "bg-red-500/40 text-red-300" :
                                                    entry.status === "WEAK_UP" ? "bg-amber-500/40 text-amber-300" :
                                                        "bg-slate-700 text-slate-400"
                                        )}
                                        title={`${entry.date}: ${entry.status}\nPrice: ${entry.price_chg?.toFixed(1)}%\nVol: ${entry.vol_chg?.toFixed(0)}%`}
                                    >
                                        {idx + 1}
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500">
                                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-500/40" /> Healthy</span>
                                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-500/40" /> Weak</span>
                                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-500/40" /> Danger</span>
                            </div>
                        </div>

                        {/* ===== SECTION 4: Volume Asymmetry + Entry Setup ===== */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Volume Asymmetry */}
                            <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Bandar Status</h4>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-2xl">
                                        {data.pullback?.volume_asymmetry?.verdict === "STRONG_HOLDING" ? "💎" :
                                            data.pullback?.volume_asymmetry?.verdict === "HOLDING" ? "🤝" : "⚠️"}
                                    </span>
                                    <div>
                                        <div className={cn(
                                            "text-lg font-bold",
                                            data.pullback?.volume_asymmetry?.verdict === "STRONG_HOLDING" ? "text-emerald-400" :
                                                data.pullback?.volume_asymmetry?.verdict === "HOLDING" ? "text-cyan-400" : "text-red-400"
                                        )}>
                                            {data.pullback?.volume_asymmetry?.asymmetry_ratio?.toFixed(1) || 0}:1
                                        </div>
                                        <div className="text-xs text-slate-500">Vol Asymmetry</div>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-emerald-400 w-8">UP</span>
                                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500 rounded-full"
                                                style={{ width: `${Math.min(100, ((data.pullback?.volume_asymmetry?.volume_up_total || 0) / Math.max(data.pullback?.volume_asymmetry?.volume_up_total || 1, data.pullback?.volume_asymmetry?.volume_down_total || 1)) * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-red-400 w-8">DN</span>
                                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-red-500 rounded-full"
                                                style={{ width: `${Math.min(100, ((data.pullback?.volume_asymmetry?.volume_down_total || 0) / Math.max(data.pullback?.volume_asymmetry?.volume_up_total || 1, data.pullback?.volume_asymmetry?.volume_down_total || 1)) * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Entry Setup */}
                            <div className={cn(
                                "rounded-lg p-3 border",
                                data.breakout_setup?.status === "ENTRY"
                                    ? "bg-emerald-950/30 border-emerald-500/50"
                                    : data.breakout_setup?.status === "NEAR_BREAKOUT"
                                        ? "bg-amber-950/30 border-amber-500/50"
                                        : "bg-slate-950/50 border-slate-800"
                            )}>
                                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Entry Setup</h4>
                                <div className="grid grid-cols-2 gap-2 text-center mb-2">
                                    <div>
                                        <div className="text-[10px] text-slate-500">Resistance</div>
                                        <div className="text-sm font-semibold text-amber-400">
                                            Rp {data.breakout_setup?.resistance_price?.toLocaleString() || "N/A"}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-500">Distance</div>
                                        <div className={cn(
                                            "text-sm font-semibold",
                                            data.breakout_setup?.is_breakout ? "text-emerald-400" :
                                                (data.breakout_setup?.distance_pct || 0) <= 3 ? "text-amber-400" : "text-slate-300"
                                        )}>
                                            {data.breakout_setup?.is_breakout ? "BROKEN ✓" : `+${data.breakout_setup?.distance_pct?.toFixed(1) || 0}%`}
                                        </div>
                                    </div>
                                </div>
                                {!data.breakout_setup?.is_breakout && (
                                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full rounded-full",
                                                (data.breakout_setup?.distance_pct || 0) <= 3
                                                    ? "bg-gradient-to-r from-amber-500 to-emerald-400"
                                                    : "bg-cyan-500"
                                            )}
                                            style={{ width: `${Math.max(0, Math.min(100, 100 - (data.breakout_setup?.distance_pct || 0) * 5))}%` }}
                                        />
                                    </div>
                                )}
                                {data.breakout_setup?.is_breakout && (
                                    <div className="text-[10px] text-emerald-400 text-center mt-1">
                                        ✅ Breakout @ {data.breakout_setup?.breakout_info?.volume_ratio || 0}x volume
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ===== SECTION 5: Expandable Details ===== */}
                        <div className="border border-slate-800 rounded-lg overflow-hidden">
                            <button
                                onClick={() => setShowDetails(!showDetails)}
                                className="w-full flex items-center justify-between p-3 bg-slate-900/50 hover:bg-slate-900 transition-colors"
                            >
                                <span className="text-xs text-slate-400 uppercase font-semibold">Detailed Metrics</span>
                                {showDetails ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </button>
                            {showDetails && (
                                <div className="p-3 bg-slate-950/50 grid grid-cols-3 gap-3 text-xs">
                                    <div>
                                        <div className="text-slate-500 mb-1">Spike</div>
                                        <div className="text-slate-300">{data.spike?.date}</div>
                                        <div className="text-slate-400">{data.spike?.volume_category}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-500 mb-1">Compression</div>
                                        <div className="text-slate-300">{data.compression?.sideways_days}d sideways</div>
                                        <div className="text-slate-400">Score: {data.compression?.compression_score}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-500 mb-1">Accumulation</div>
                                        <div className="text-slate-300">{data.accumulation?.accumulation_days}d period</div>
                                        <div className="text-slate-400">{data.accumulation?.volume_trend}</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ===== SECTION 6: Actions ===== */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={fetchVPAData}>
                                    <RefreshCw className="w-3 h-3 mr-1" />
                                    Refresh
                                </Button>
                                <span className="text-[10px] text-slate-600">
                                    {stage2.lastUpdated ? new Date(stage2.lastUpdated).toLocaleTimeString() : "Never"}
                                </span>
                            </div>

                            <Button
                                size="sm"
                                className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500"
                            >
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Stage 3 →
                            </Button>
                        </div>
                    </>
                )}
            </div>
        );
    };

    return (
        <StageCard
            stageNumber={2}
            title="Volume Price Analysis"
            description="Validating volume spike, compression, and pullback health"
            status={stage2.status}
        >
            {renderContent()}
        </StageCard>
    );
}
