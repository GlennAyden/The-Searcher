'use client';

import { SentimentChart } from '@/features/dashboard/components/sentiment-chart';
import { TickerCloud } from '@/features/dashboard/components/ticker-cloud';
import { MetricCard } from '@/features/dashboard/components/MetricCard';
import { TrendingUp, Users, Newspaper, Zap } from 'lucide-react';
import { useFilter } from '@/context/filter-context';
import { useDashboardMetrics } from '@/features/dashboard/hooks/useDashboardMetrics';

export default function DashboardPage() {
    const { ticker: globalTicker, dateRange } = useFilter();

    // Fallback for dashboard: if 'All' is selected, defaulting to IHSG (^JKSE) might be better for general market view,
    // or we could show an aggregate. For now let's default to ^JKSE if All.
    const ticker = globalTicker === 'All' ? '^JKSE' : globalTicker;

    const { metrics, refreshing, refreshKey, refresh } = useDashboardMetrics({
        ticker,
        startDate: dateRange.start,
        endDate: dateRange.end
    });

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="flex flex-col">
                    <h1 className="text-3xl font-bold text-zinc-100 italic tracking-tight">Market Intelligence Dashboard</h1>
                    <p className="text-zinc-500 mt-1">Real-time sentiment-price correlation and AI insights.</p>
                </div>
                <button
                    onClick={refresh}
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
                    delta={metrics.correlation > 0.5 ? 'Strong Pos' : metrics.correlation < -0.5 ? 'Strong Neg' : 'Weak'}
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
