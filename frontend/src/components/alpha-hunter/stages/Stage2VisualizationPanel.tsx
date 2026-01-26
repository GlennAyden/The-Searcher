"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    RefreshCw,
    AlertCircle,
    TrendingDown,
    Target,
    Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/services/api/base";

interface Stage2VisualizationProps {
    ticker: string;
}

interface VisualizationData {
    ticker: string;
    analysis_period: {
        start_date: string;
        end_date: string;
        selling_climax_date: string;
        selling_climax_detected: boolean;
    };
    price_chart: {
        ohlcv: Array<{
            date: string;
            open: number;
            high: number;
            low: number;
            close: number;
            volume: number;
        }>;
        ma5: Array<{ date: string; value: number | null }>;
        ma10: Array<{ date: string; value: number | null }>;
        ma20: Array<{ date: string; value: number | null }>;
        markers: {
            selling_climax: Record<string, unknown> | null;
            volume_spikes: Array<Record<string, unknown>>;
        };
    };
    volume_chart: {
        volume: Array<{ date: string; value: number }>;
        ma20: Array<{ date: string; value: number | null }>;
        spikes: Array<{
            date: string;
            ratio: number;
            category: string;
            price_change_pct: number;
            price_direction: "UP" | "DOWN";
        }>;
    };
    money_flow_chart: {
        positive_flow: Array<{ date: string; value: number }>;
        negative_flow: Array<{ date: string; value: number }>;
        price_line: Array<{ date: string; value: number }>;
        data_available: boolean;
    };
    resistance_lines: Array<{
        start_date: string;
        end_date: string;
        price: number;
        is_broken: boolean;
        break_date: string | null;
    }>;
    recommendation: {
        status: "WAIT_FOR_PULLBACK" | "ENTRY_ZONE" | "WATCH" | "FAILED" | "NO_DATA";
        reason: string;
        action: string;
        pullback_valid?: boolean;
        resistance_price?: number;
        distance_pct?: number;
    };
}

// Custom Candlestick Component
const Candlestick = ({
    x,
    width,
    open,
    close,
    high,
    low,
    priceMin,
    priceMax,
    chartHeight,
}: {
    x: number;
    width: number;
    open: number;
    close: number;
    high: number;
    low: number;
    priceMin: number;
    priceMax: number;
    chartHeight: number;
}) => {
    const priceToY = (price: number) => {
        const range = priceMax - priceMin;
        return chartHeight - ((price - priceMin) / range) * chartHeight;
    };

    const isGreen = close >= open;
    const color = isGreen ? "#22c55e" : "#ef4444";
    const bodyTop = priceToY(Math.max(open, close));
    const bodyBottom = priceToY(Math.min(open, close));
    const bodyHeight = Math.max(1, bodyBottom - bodyTop);
    const wickTop = priceToY(high);
    const wickBottom = priceToY(low);
    const candleWidth = Math.max(4, width * 0.7);
    const candleX = x + (width - candleWidth) / 2;
    const wickX = x + width / 2;

    return (
        <g>
            {/* Wick */}
            <line
                x1={wickX}
                y1={wickTop}
                x2={wickX}
                y2={wickBottom}
                stroke={color}
                strokeWidth={1}
            />
            {/* Body */}
            <rect
                x={candleX}
                y={bodyTop}
                width={candleWidth}
                height={bodyHeight}
                fill={isGreen ? color : color}
                stroke={color}
                strokeWidth={1}
            />
        </g>
    );
};

export default function Stage2VisualizationPanel({ ticker }: Stage2VisualizationProps) {
    const [data, setData] = useState<VisualizationData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchVisualizationData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/alpha-hunter/stage2/visualization/${ticker}`
            );

            if (!response.ok) {
                throw new Error("Failed to fetch visualization data");
            }

            const result = await response.json();
            setData(result);
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }, [ticker]);

    useEffect(() => {
        fetchVisualizationData();
    }, [fetchVisualizationData]);

    // Prepare chart data
    const chartData = useMemo(() => {
        if (!data) return [];

        const spikeMap = new Map(
            data.volume_chart.spikes.map((s) => [s.date, s])
        );

        const ma5Map = new Map(
            data.price_chart.ma5.filter(m => m.value).map(m => [m.date, m.value])
        );
        const ma10Map = new Map(
            data.price_chart.ma10.filter(m => m.value).map(m => [m.date, m.value])
        );
        const ma20Map = new Map(
            data.price_chart.ma20.filter(m => m.value).map(m => [m.date, m.value])
        );
        const volumeMa20Map = new Map(
            data.volume_chart.ma20.filter(m => m.value).map(m => [m.date, m.value])
        );

        return data.price_chart.ohlcv.map((item) => {
            const spike = spikeMap.get(item.date);
            return {
                ...item,
                shortDate: item.date.slice(5),
                isGreen: item.close >= item.open,
                ma5: ma5Map.get(item.date),
                ma10: ma10Map.get(item.date),
                ma20: ma20Map.get(item.date),
                volumeMa20: volumeMa20Map.get(item.date),
                isSpike: !!spike,
                spikeRatio: spike?.ratio,
                spikeDirection: spike?.price_direction,
            };
        });
    }, [data]);

    // Calculate price range
    const priceRange = useMemo(() => {
        if (!chartData.length) return { min: 0, max: 100 };
        const prices = chartData.flatMap(d => [d.high, d.low]);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const padding = (max - min) * 0.05;
        return { min: min - padding, max: max + padding };
    }, [chartData]);

    // Calculate volume range
    const volumeRange = useMemo(() => {
        if (!chartData.length) return { max: 1 };
        const volumes = chartData.map(d => d.volume);
        return { max: Math.max(...volumes) * 1.1 };
    }, [chartData]);

    const getRecommendationStyle = (status: string) => {
        switch (status) {
            case "ENTRY_ZONE":
                return {
                    bg: "bg-emerald-500/20",
                    border: "border-emerald-500/50",
                    text: "text-emerald-400",
                    icon: <Target className="w-5 h-5" />,
                };
            case "WAIT_FOR_PULLBACK":
                return {
                    bg: "bg-amber-500/20",
                    border: "border-amber-500/50",
                    text: "text-amber-400",
                    icon: <Activity className="w-5 h-5" />,
                };
            case "FAILED":
                return {
                    bg: "bg-red-500/20",
                    border: "border-red-500/50",
                    text: "text-red-400",
                    icon: <TrendingDown className="w-5 h-5" />,
                };
            default:
                return {
                    bg: "bg-slate-500/20",
                    border: "border-slate-500/50",
                    text: "text-slate-400",
                    icon: <AlertCircle className="w-5 h-5" />,
                };
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
                <p className="text-red-400 mb-4">{error}</p>
                <Button onClick={fetchVisualizationData} variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                </Button>
            </div>
        );
    }

    if (!data) return null;

    const recStyle = getRecommendationStyle(data.recommendation.status);
    const CHART_WIDTH = 800;
    const PRICE_CHART_HEIGHT = 280;
    const VOLUME_CHART_HEIGHT = 100;
    const candleWidth = Math.max(4, (CHART_WIDTH - 60) / chartData.length);

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white">{ticker}</span>
                    <Badge variant="outline" className="bg-slate-800/50 text-[10px]">
                        {data.analysis_period.start_date} → {data.analysis_period.end_date}
                    </Badge>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={fetchVisualizationData}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Recommendation Panel */}
            <div className={cn("rounded-lg p-3 border", recStyle.bg, recStyle.border)}>
                <div className="flex items-center gap-3">
                    <div className={recStyle.text}>{recStyle.icon}</div>
                    <div className="flex-1">
                        <div className={cn("text-base font-bold", recStyle.text)}>
                            {data.recommendation.status.replace(/_/g, " ")}
                        </div>
                        <div className="text-xs text-slate-400">{data.recommendation.reason}</div>
                    </div>
                    <div className="text-right text-xs">
                        <div className="text-slate-500">Action</div>
                        <div className="text-slate-300">{data.recommendation.action}</div>
                    </div>
                </div>
            </div>

            {/* TradingView-Style Chart */}
            <div className="bg-[#131722] rounded-lg p-4 border border-slate-800">
                {/* Price Chart with Candlesticks */}
                <div className="relative">
                    <svg
                        width="100%"
                        height={PRICE_CHART_HEIGHT + VOLUME_CHART_HEIGHT + 30}
                        viewBox={`0 0 ${CHART_WIDTH} ${PRICE_CHART_HEIGHT + VOLUME_CHART_HEIGHT + 30}`}
                        className="overflow-visible"
                    >
                        {/* Price Chart Area */}
                        <g transform={`translate(50, 10)`}>
                            {/* Grid Lines */}
                            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
                                <g key={i}>
                                    <line
                                        x1={0}
                                        y1={PRICE_CHART_HEIGHT * pct}
                                        x2={CHART_WIDTH - 60}
                                        y2={PRICE_CHART_HEIGHT * pct}
                                        stroke="#1e293b"
                                        strokeDasharray="2 2"
                                    />
                                    <text
                                        x={CHART_WIDTH - 55}
                                        y={PRICE_CHART_HEIGHT * pct + 4}
                                        fill="#64748b"
                                        fontSize="9"
                                    >
                                        {Math.round(priceRange.max - (priceRange.max - priceRange.min) * pct)}
                                    </text>
                                </g>
                            ))}

                            {/* Resistance Lines */}
                            {data.resistance_lines.map((res, idx) => {
                                const y = PRICE_CHART_HEIGHT - ((res.price - priceRange.min) / (priceRange.max - priceRange.min)) * PRICE_CHART_HEIGHT;
                                return (
                                    <g key={idx}>
                                        <line
                                            x1={0}
                                            y1={y}
                                            x2={CHART_WIDTH - 60}
                                            y2={y}
                                            stroke={res.is_broken ? "#22c55e" : "#f59e0b"}
                                            strokeWidth={1.5}
                                            strokeDasharray={res.is_broken ? "0" : "5 5"}
                                        />
                                        <text
                                            x={CHART_WIDTH - 55}
                                            y={y + 4}
                                            fill={res.is_broken ? "#22c55e" : "#f59e0b"}
                                            fontSize="9"
                                            fontWeight="bold"
                                        >
                                            {res.is_broken ? "✓" : "R"} {res.price.toLocaleString()}
                                        </text>
                                    </g>
                                );
                            })}

                            {/* Candlesticks */}
                            {chartData.map((d, i) => (
                                <Candlestick
                                    key={i}
                                    x={i * candleWidth}
                                    // y={0} - removed, not in Candlestick props
                                    width={candleWidth}
                                    // height={PRICE_CHART_HEIGHT} - removed, not in Candlestick props
                                    open={d.open}
                                    close={d.close}
                                    high={d.high}
                                    low={d.low}
                                    priceMin={priceRange.min}
                                    priceMax={priceRange.max}
                                    chartHeight={PRICE_CHART_HEIGHT}
                                />
                            ))}



                            {/* Spike Labels on Candles */}
                            {chartData.map((d, i) => {
                                if (!d.isSpike) return null;
                                const x = i * candleWidth + candleWidth / 2;
                                const y = PRICE_CHART_HEIGHT - ((d.high - priceRange.min) / (priceRange.max - priceRange.min)) * PRICE_CHART_HEIGHT;
                                return (
                                    <g key={`spike-${i}`}>
                                        <text
                                            x={x}
                                            y={y - 8}
                                            fill={d.spikeDirection === "UP" ? "#22c55e" : "#ef4444"}
                                            fontSize="10"
                                            fontWeight="bold"
                                            textAnchor="middle"
                                        >
                                            {d.spikeRatio?.toFixed(1)}x
                                        </text>
                                        {/* Arrow */}
                                        <path
                                            d={d.spikeDirection === "UP"
                                                ? `M ${x} ${y - 3} L ${x - 4} ${y + 2} L ${x + 4} ${y + 2} Z`
                                                : `M ${x} ${y + 3} L ${x - 4} ${y - 2} L ${x + 4} ${y - 2} Z`
                                            }
                                            fill={d.spikeDirection === "UP" ? "#22c55e" : "#ef4444"}
                                        />
                                    </g>
                                );
                            })}

                            {/* Current Price Label */}
                            {chartData.length > 0 && (
                                <g>
                                    <rect
                                        x={CHART_WIDTH - 58}
                                        y={PRICE_CHART_HEIGHT - ((chartData[chartData.length - 1].close - priceRange.min) / (priceRange.max - priceRange.min)) * PRICE_CHART_HEIGHT - 8}
                                        width={55}
                                        height={16}
                                        fill={chartData[chartData.length - 1].isGreen ? "#22c55e" : "#ef4444"}
                                        rx={2}
                                    />
                                    <text
                                        x={CHART_WIDTH - 30}
                                        y={PRICE_CHART_HEIGHT - ((chartData[chartData.length - 1].close - priceRange.min) / (priceRange.max - priceRange.min)) * PRICE_CHART_HEIGHT + 4}
                                        fill="white"
                                        fontSize="10"
                                        fontWeight="bold"
                                        textAnchor="middle"
                                    >
                                        {chartData[chartData.length - 1].close.toLocaleString()}
                                    </text>
                                </g>
                            )}
                        </g>

                        {/* Separator Line */}
                        <line
                            x1={50}
                            y1={PRICE_CHART_HEIGHT + 15}
                            x2={CHART_WIDTH - 10}
                            y2={PRICE_CHART_HEIGHT + 15}
                            stroke="#334155"
                            strokeWidth={1}
                        />

                        {/* Volume Chart Area */}
                        <g transform={`translate(50, ${PRICE_CHART_HEIGHT + 20})`}>
                            {/* Volume Bars */}
                            {chartData.map((d, i) => {
                                const barHeight = (d.volume / volumeRange.max) * VOLUME_CHART_HEIGHT;
                                return (
                                    <rect
                                        key={i}
                                        x={i * candleWidth + candleWidth * 0.15}
                                        y={VOLUME_CHART_HEIGHT - barHeight}
                                        width={candleWidth * 0.7}
                                        height={barHeight}
                                        fill={d.isGreen ? "#22c55e" : "#ef4444"}
                                        opacity={d.isSpike ? 1 : 0.5}
                                    />
                                );
                            })}



                            {/* Volume Labels */}
                            <text x={CHART_WIDTH - 55} y={10} fill="#64748b" fontSize="8">
                                {(volumeRange.max / 1000000).toFixed(0)}M
                            </text>
                            <text x={CHART_WIDTH - 55} y={VOLUME_CHART_HEIGHT} fill="#64748b" fontSize="8">
                                0
                            </text>
                        </g>

                        {/* X-Axis Labels */}
                        <g transform={`translate(50, ${PRICE_CHART_HEIGHT + VOLUME_CHART_HEIGHT + 25})`}>
                            {chartData.filter((_, i) => i % Math.ceil(chartData.length / 10) === 0).map((d, i) => {
                                const originalIndex = chartData.indexOf(d);
                                return (
                                    <text
                                        key={i}
                                        x={originalIndex * candleWidth + candleWidth / 2}
                                        y={0}
                                        fill="#64748b"
                                        fontSize="9"
                                        textAnchor="middle"
                                    >
                                        {d.shortDate}
                                    </text>
                                );
                            })}
                        </g>
                    </svg>
                </div>

                {/* Spike Legend */}
                <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-slate-800">
                    <span className="text-[10px] text-slate-500">Volume Spikes:</span>
                    {data.volume_chart.spikes.slice(-6).map((spike, idx) => (
                        <Badge
                            key={idx}
                            variant="outline"
                            className={cn(
                                "text-[10px] px-1.5 py-0",
                                spike.price_direction === "UP"
                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                                    : "bg-red-500/20 text-red-400 border-red-500/50"
                            )}
                        >
                            {spike.date.slice(5)}: {spike.ratio.toFixed(1)}x {spike.price_direction === "UP" ? "↑" : "↓"}
                        </Badge>
                    ))}
                </div>
            </div>


        </div>
    );
}
