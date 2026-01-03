'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    LineChart,
    Scatter
} from 'recharts';
import { GripVertical, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/services/api';
import { StockData } from '@/types/market';

interface SentimentChartProps {
    ticker: string;
    startDate: string;
    endDate: string;
}

interface SentimentData {
    date: string;
    score: number;
    sma: number;
    count: number;
}

export const SentimentChart = ({ ticker, startDate, endDate }: SentimentChartProps) => {
    const [marketData, setMarketData] = useState<StockData[]>([]);
    const [sentimentData, setSentimentData] = useState<SentimentData[]>([]);
    const [loading, setLoading] = useState(true);

    // Zoom and Drag States
    const [zoomLevel, setZoomLevel] = useState(0.02); // 2% padding by default
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);

    useEffect(() => {
        const handleWindowMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;

            const deltaY = e.clientY - startY;
            // High sensitivity: 0.005 per pixel
            const sensitivity = 0.005;
            setZoomLevel(prev => Math.max(0.001, Math.min(1.0, prev + deltaY * sensitivity)));
            setStartY(e.clientY);
        };

        const handleWindowMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleWindowMouseMove);
            window.addEventListener('mouseup', handleWindowMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
        };
    }, [isDragging, startY]);

    const handleMouseDown = (e: any) => {
        // Support both direct mouse events and Recharts internal events
        const clientY = e.chartY !== undefined ? e.chartY : (e.clientY || 0);

        // Reset zoom on Shift + Click
        if (e.shiftKey) {
            setZoomLevel(0.02);
            return;
        }

        setIsDragging(true);
        setStartY(clientY);

        // Prevent browser selection/drag behavior
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [m, s] = await Promise.all([
                    api.getMarketData(ticker, startDate, endDate),
                    api.getSentimentHistory(ticker, startDate, endDate)
                ]);
                setMarketData(m);
                setSentimentData(s);
            } catch (error) {
                console.error("Failed to load chart data:", error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [ticker, startDate, endDate]);

    // Unified data preparation for both price and sentiment
    const combinedData = useMemo(() => {
        const normalize = (d: string) => d ? d.trim().split(/[ T]/)[0] : "";

        // Create a unique set of all dates from both sources
        const allDates = new Set([
            ...marketData.map(d => normalize(d.timestamp)),
            ...sentimentData.map(d => normalize(d.date))
        ]);

        return Array.from(allDates)
            .filter(d => d !== "")
            .sort() // Ensure chronological order
            .map(date => {
                const m = marketData.find(d => normalize(d.timestamp) === date);
                const s = sentimentData.find(d => normalize(d.date) === date);

                return {
                    date,
                    open: m?.open ?? null,
                    high: m?.high ?? null,
                    low: m?.low ?? null,
                    close: m?.close ?? null,
                    // bar for the "body" of the candle
                    openClose: m ? [m.open, m.close] : null,
                    // bar for the "wick" of the candle
                    highLow: m ? [m.low, m.high] : null,
                    isUp: m ? m.close >= m.open : null,
                    score: s?.score ?? null,
                    sma: s?.sma ?? null,
                    count: s?.count ?? 0,
                    // Impact check: count > 3 or |score| > 0.5
                    isHighImpact: (s?.count ?? 0) >= 3 || Math.abs(s?.score ?? 0) >= 0.5,
                    impactValue: (s?.count ?? 0) >= 3 || Math.abs(s?.score ?? 0) >= 0.5 ? (m?.close ?? null) : null
                };
            });
    }, [marketData, sentimentData]);

    // Calculate Price Domain with Padding
    const priceDomain = useMemo(() => {
        const prices = marketData.map(d => d.close).filter(p => p !== null) as number[];
        if (prices.length === 0) return ['auto', 'auto'];

        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const range = max - min;
        const padding = Math.max(1, range * zoomLevel);

        return [min - padding, max + padding];
    }, [marketData, zoomLevel]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;

            return (
                <div className="bg-zinc-950/90 backdrop-blur-md border border-zinc-800 p-4 rounded-xl shadow-2xl text-[11px] min-w-[180px] pointer-events-none ring-1 ring-white/5">
                    <p className="text-zinc-500 mb-3 font-mono uppercase tracking-[0.2em] text-[9px] border-b border-zinc-900 pb-2">{label}</p>
                    <div className="space-y-3">
                        {data.close !== null ? (
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="h-1 w-3 bg-blue-500 rounded-full"></div>
                                    <span className="text-zinc-400 font-bold uppercase tracking-wider text-[9px]">Market Performance</span>
                                </div>
                                <div className="grid grid-cols-2 gap-y-1 gap-x-4 pl-1">
                                    <p className="flex justify-between"><span className="text-zinc-500">O:</span><span className="text-zinc-300 font-mono">{data.open.toFixed(2)}</span></p>
                                    <p className="flex justify-between"><span className="text-zinc-500">H:</span><span className="text-zinc-300 font-mono">{data.high.toFixed(2)}</span></p>
                                    <p className="flex justify-between"><span className="text-zinc-500">L:</span><span className="text-zinc-300 font-mono">{data.low.toFixed(2)}</span></p>
                                    <p className="flex justify-between font-bold border-l-2 border-blue-500/30 pl-2">
                                        <span className="text-zinc-400">C:</span>
                                        <span className={data.isUp ? "text-emerald-400" : "text-rose-400"}>{data.close.toFixed(2)}</span>
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-1 opacity-60">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="h-1 w-3 bg-zinc-700 rounded-full"></div>
                                    <span className="text-zinc-500 font-bold uppercase tracking-wider text-[9px]">Market Closed</span>
                                </div>
                                <p className="text-zinc-600 italic text-[9px] pl-1">No trading data for this date.</p>
                            </div>
                        )}

                        {data.score !== null && (
                            <div className="pt-2 border-t border-zinc-900/50 space-y-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="h-1 w-3 bg-emerald-500 rounded-full"></div>
                                    <span className="text-zinc-400 font-bold uppercase tracking-wider text-[9px]">Sentiment Intelligence</span>
                                </div>
                                <div className="space-y-1 pl-1">
                                    <p className="flex justify-between">
                                        <span className="text-zinc-500">Score:</span>
                                        <span className={data.score >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                                            {(data.score >= 0 ? '+' : '') + data.score.toFixed(3)}
                                        </span>
                                    </p>
                                    <p className="flex justify-between">
                                        <span className="text-zinc-500">SMA (5):</span>
                                        <span className="text-amber-400 font-mono">{data.sma?.toFixed(3) ?? '0.000'}</span>
                                    </p>
                                    <p className="text-zinc-600 italic text-[9px] pt-1">
                                        <span className="text-zinc-600 italic">Analyzed {data.count} sources</span>
                                    </p>
                                </div>
                            </div>
                        )}

                        {data.isHighImpact && (
                            <div className="pt-2 border-t border-zinc-900/50">
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-md">
                                    <MessageSquare className="w-3 h-3 text-blue-400" />
                                    <span className="text-[9px] text-blue-400 font-bold uppercase tracking-tight">High Impact Intelligence</span>
                                </div>
                                <p className="text-[9px] text-zinc-500 mt-1 italic pl-1 leading-tight">
                                    Significant discussion or sentiment shift detected on this date.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            );
        }
        return null;
    };

    if (loading) {
        return <div className="h-[600px] w-full flex items-center justify-center text-zinc-500 font-mono animate-pulse">Initializing Market & Sentiment Engines...</div>;
    }

    return (
        <Card className="w-full bg-zinc-950 border-zinc-900 shadow-2xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-6 px-6">
                <CardTitle className="text-sm font-bold text-zinc-100 italic tracking-widest flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                    CORRELATION ENGINE: <span className="text-blue-500">{ticker}</span>
                    <button
                        onClick={() => setZoomLevel(prev => Math.max(0.001, prev - 0.01))}
                        className="ml-4 px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] hover:bg-zinc-800 text-zinc-400"
                    >+</button>
                    <button
                        onClick={() => setZoomLevel(prev => Math.min(1.0, prev + 0.01))}
                        className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] hover:bg-zinc-800 text-zinc-400"
                    >-</button>
                    <span className="ml-2 text-[10px] text-zinc-600 font-normal normal-case italic">Level: {zoomLevel.toFixed(3)}</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div
                    className={`flex flex-col h-[600px] w-full select-none ${isDragging ? 'cursor-ns-resize' : 'cursor-default'}`}
                >
                    {/* Price Chart (Top Pane) */}
                    <div className="h-[70%] w-full relative">
                        {/* Drag Handle Overlay */}
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none flex flex-col items-center gap-1">
                            <GripVertical className="w-4 h-4 text-zinc-700 animate-pulse" />
                            <span className="text-[8px] text-zinc-800 font-bold uppercase vertical-text tracking-widest">DRAG AXIS</span>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={combinedData}
                                syncId="marketSentiment"
                                margin={{ top: 20, right: 30, left: 30, bottom: 0 }}
                                onMouseDown={handleMouseDown}
                            >
                                <CartesianGrid vertical={false} stroke="#18181b" strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="date"
                                    hide
                                    padding={{ left: 20, right: 20 }}
                                />
                                <YAxis
                                    yAxisId="price"
                                    orientation="right"
                                    domain={priceDomain}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#3f3f46', fontSize: 10, fontFamily: 'monospace' }}
                                    mirror
                                />
                                <YAxis yAxisId="ghost" hide domain={['auto', 'auto']} />
                                <Tooltip
                                    content={<CustomTooltip />}
                                    isAnimationActive={false}
                                />

                                {/* Ghost Series for reliable triggering on all dates (including weekends) */}
                                <Bar
                                    yAxisId="ghost"
                                    dataKey="count"
                                    fill="transparent"
                                    isAnimationActive={false}
                                />

                                {/* Price Line */}
                                <Line
                                    yAxisId="price"
                                    type="monotone"
                                    dataKey="close"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    dot={false}
                                    connectNulls={true}
                                    isAnimationActive={true}
                                />

                                {/* Insight Markers (Scatter) - Remove local data to inherit parent and maintain index sync */}
                                <Scatter
                                    yAxisId="price"
                                    dataKey="impactValue"
                                    fill="#3b82f6"
                                    isAnimationActive={false}
                                >
                                    {combinedData.map((entry, index) => (
                                        <Cell
                                            key={`marker-${index}`}
                                            fill={entry.score !== null && entry.score >= 0 ? "#10b981" : "#f43f5e"}
                                            className="drop-shadow-[0_0_10px_rgba(0,0,0,0.5)] cursor-pointer"
                                            stroke="#fff"
                                            strokeWidth={2}
                                            r={entry.isHighImpact ? 6 : 0} // Only show if high impact
                                        />
                                    ))}
                                </Scatter>
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Sentiment Chart (Bottom Pane) */}
                    <div className="h-[30%] w-full border-t border-zinc-900">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={combinedData}
                                syncId="marketSentiment"
                                margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
                            >
                                <CartesianGrid vertical={false} stroke="#18181b" strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#3f3f46', fontSize: 9, fontFamily: 'monospace' }}
                                    minTickGap={60}
                                    padding={{ left: 20, right: 20 }}
                                />
                                <YAxis
                                    orientation="right"
                                    domain={[-1, 1]}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#3f3f46', fontSize: 10, fontFamily: 'monospace' }}
                                    mirror
                                />
                                <Bar
                                    dataKey="score"
                                    barSize={20}
                                >
                                    {combinedData.map((entry, index) => (
                                        <Cell
                                            key={`cell-s-${index}`}
                                            fill={entry.score === null ? "transparent" : (entry.score >= 0 ? "#10b981" : "#f43f5e")}
                                            fillOpacity={1}
                                        />
                                    ))}
                                </Bar>
                                <Line
                                    type="monotone"
                                    dataKey="sma"
                                    stroke="#fbbf24"
                                    strokeWidth={2}
                                    dot={false}
                                    isAnimationActive={true}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
