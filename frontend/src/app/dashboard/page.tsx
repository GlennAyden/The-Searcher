'use client';

import React, { useEffect, useState } from 'react';
import { SentimentChart } from '@/components/dashboard/sentiment-chart';
import { TickerCloud } from '@/components/dashboard/ticker-cloud';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, Newspaper, Zap, Calendar as CalendarIcon, Search, HelpCircle } from 'lucide-react';
import { api } from '@/services/api';
import { useFilter } from '@/context/filter-context';
import { Line, LineChart, ResponsiveContainer } from 'recharts';

export default function DashboardPage() {
    const { ticker: globalTicker, dateRange } = useFilter();
    const [refreshing, setRefreshing] = useState(false);

    // Fallback for dashboard: if 'All' is selected, defaulting to IHSG (^JKSE) might be better for general market view,
    // or we could show an aggregate. For now let's default to ^JKSE if All.
    const ticker = globalTicker === 'All' ? '^JKSE' : globalTicker;

    const [metrics, setMetrics] = useState({
        price: 0,
        price_delta: 0,
        mood_score: 0,
        mood_label: 'Netral 😐',
        correlation: 0,
        volume: 0,
        trends: {
            price: [] as number[],
            mood: [] as number[],
            correlation: [] as number[],
            volume: [] as number[]
        }
    });

    const fetchMetrics = async () => {
        try {
            const stats = await api.getDashboardStats(ticker, dateRange.start, dateRange.end);
            setMetrics(stats);
        } catch (error) {
            console.error("Failed to fetch metrics:", error);
        }
    };

    useEffect(() => {
        const initDashboard = async () => {
            await fetchMetrics();

            // Auto-refresh logic: If volume is 0 (no news analyzed today) 
            // and we are looking at 'today' as end date, trigger a refresh.
            const today = new Date().toISOString().split('T')[0];
            if (metrics.volume === 0 && dateRange.end === today && !refreshing) {
                console.log("[Auto] No news found for today, triggering background intelligence refresh...");
                handleRefresh();
            }
        };
        initDashboard();
    }, [ticker, dateRange.start, dateRange.end]);

    const [refreshKey, setRefreshKey] = useState(Date.now());

    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        try {
            // Trigger scrapes for major sources
            await Promise.all([
                api.runScraper("CNBC Indonesia", dateRange.start, dateRange.end),
                api.runScraper("EmitenNews", dateRange.start, dateRange.end)
            ]);

            // Refresh metrics
            await fetchMetrics();

            // Note: Since we want the chart to also refresh, and it depends on ticker/date,
            // we could either rely on its internal useEffect OR force a reload if needed.
            // For a seamless "Auto" feel, let's just re-fetch the metrics.
            // If the user wants the CHART to also immediately show new candles,
            // we'll use a small trick: update a 'lastUpdate' timestamp to force re-renders.
            setRefreshKey(Date.now()); // Trigger chart update
        } catch (error) {
            console.error("Refresh failed:", error);
        } finally {
            setRefreshing(false);
        }
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="flex flex-col">
                    <h1 className="text-3xl font-bold text-zinc-100 italic tracking-tight">Market Intelligence Dashboard</h1>
                    <p className="text-zinc-500 mt-1">Real-time sentiment-price correlation and AI insights.</p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-lg font-bold text-sm transition-all shadow-lg active:scale-95 shadow-blue-900/20"
                >
                    <Zap className={`w-4 h-4 ${refreshing ? 'animate-pulse' : ''}`} />
                    {refreshing ? 'Refreshing Intelligence...' : 'Refresh Intelligence'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Latest Price"
                    value={metrics.price.toLocaleString()}
                    delta={`${metrics.price_delta > 0 ? '+' : ''}${metrics.price_delta.toFixed(2)}`}
                    icon={TrendingUp}
                    trend={metrics.price_delta >= 0 ? 'up' : 'down'}
                    sparklineData={metrics.trends.price}
                />
                <MetricCard
                    title="Market Mood"
                    value={metrics.mood_label}
                    delta={`${metrics.mood_score.toFixed(2)} Index`}
                    icon={Zap}
                    trend={metrics.mood_score >= 0 ? 'up' : 'down'}
                    sparklineData={metrics.trends.mood}
                />
                <MetricCard
                    title="Correlation (Pearson)"
                    value={`${metrics.correlation.toFixed(2)}`}
                    delta={metrics.correlation > 0.5 ? "Strong Pos" : metrics.correlation < -0.5 ? "Strong Neg" : "Weak"}
                    icon={Users}
                    trend={metrics.correlation >= 0 ? 'up' : 'down'}
                    sparklineData={metrics.trends.correlation}
                    tooltip="Measuring the linear relationship between stock price and sentiment. 1.0 = Perfect Positive, -1.0 = Perfect Negative."
                />
                <MetricCard
                    title="News Volume"
                    value={metrics.volume > 1000 ? `${(metrics.volume / 1000).toFixed(1)}k` : metrics.volume.toString()}
                    delta="Total News"
                    icon={Newspaper}
                    trend="neutral"
                    sparklineData={metrics.trends.volume}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <SentimentChart
                        key={refreshKey}
                        ticker={ticker}
                        startDate={dateRange.start}
                        endDate={dateRange.end}
                    />
                </div>
                <div className="lg:col-span-1">
                    <TickerCloud />
                </div>
            </div>
        </div>
    );
}

function MetricCard({ title, value, delta, icon: Icon, trend, sparklineData, tooltip }: any) {
    const chartData = (sparklineData || []).map((val: number, i: number) => ({ val, i }));

    return (
        <Card className="bg-zinc-950/50 border-zinc-900 backdrop-blur-sm shadow-xl relative overflow-hidden group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-1.5">
                    <CardTitle className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{title}</CardTitle>
                    {tooltip && (
                        <div className="group/tooltip relative">
                            <HelpCircle className="w-3 h-3 text-zinc-700 cursor-help" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] text-zinc-400 invisible group-hover/tooltip:visible z-50 shadow-2xl backdrop-blur-md">
                                {tooltip}
                            </div>
                        </div>
                    )}
                </div>
                <Icon className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
            </CardHeader>
            <CardContent>
                <div className="flex items-end justify-between">
                    <div>
                        <div className="text-2xl font-bold text-zinc-100">{value}</div>
                        <div className={`text-xs mt-1 font-medium ${trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-rose-500' : 'text-zinc-500'}`}>
                            {delta} {trend !== 'neutral' && <span className="text-zinc-600 font-normal ml-1">vs prev</span>}
                        </div>
                    </div>
                    {chartData.length > 0 && (
                        <div className="h-10 w-20 mb-1 opacity-50 group-hover:opacity-100 transition-opacity">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <Line
                                        type="monotone"
                                        dataKey="val"
                                        stroke={trend === 'up' ? '#10b981' : trend === 'down' ? '#f43f5e' : '#3b82f6'}
                                        strokeWidth={2}
                                        dot={false}
                                        isAnimationActive={true}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
