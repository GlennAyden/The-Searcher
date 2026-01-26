import { useCallback, useEffect, useState } from 'react';
import { dashboardService } from '../services/dashboard-service';
import { scraperService } from '../services/scraper-service';
import type { DashboardMetrics } from '../types';
import type { DashboardStats } from '@/services/api/dashboard';

const defaultMetrics: DashboardMetrics = {
    price: 0,
    price_delta: 0,
    mood_score: 0,
    mood_label: 'Netral',
    correlation: 0,
    volume: 0,
    trends: {
        price: [],
        mood: [],
        correlation: [],
        volume: []
    }
};

const mapStatsToMetrics = (stats: DashboardStats): DashboardMetrics => {
    const trends = (stats.trends && typeof stats.trends === 'object') ? (stats.trends as Partial<DashboardMetrics['trends']>) : {};

    return {
        price: stats.current_price || 0,
        price_delta: stats.price_change || 0,
        mood_score: (typeof stats.mood_score === 'number' ? stats.mood_score : 0),
        mood_label: stats.market_mood || 'Netral',
        correlation: stats.correlation || 0,
        volume: stats.news_volume || 0,
        trends: {
            price: Array.isArray(trends.price) ? trends.price : [],
            mood: Array.isArray(trends.mood) ? trends.mood : [],
            correlation: Array.isArray(trends.correlation) ? trends.correlation : [],
            volume: Array.isArray(trends.volume) ? trends.volume : []
        }
    };
};

type UseDashboardMetricsProps = {
    ticker: string;
    startDate: string;
    endDate: string;
};

export const useDashboardMetrics = ({ ticker, startDate, endDate }: UseDashboardMetricsProps) => {
    const [metrics, setMetrics] = useState<DashboardMetrics>(defaultMetrics);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshKey, setRefreshKey] = useState(Date.now());

    const fetchMetrics = useCallback(async () => {
        try {
            const stats = await dashboardService.getDashboardStats(ticker, startDate, endDate);
            setMetrics(mapStatsToMetrics(stats));
        } catch (error) {
            console.error('Failed to fetch metrics:', error);
        }
    }, [ticker, startDate, endDate]);

    useEffect(() => {
        fetchMetrics();
    }, [fetchMetrics]);

    const refresh = useCallback(async () => {
        if (refreshing) return;
        setRefreshing(true);
        try {
            await scraperService.runScrapers(startDate, endDate);
            await fetchMetrics();
            setRefreshKey(Date.now());
        } catch (error) {
            console.error('Refresh failed:', error);
        } finally {
            setRefreshing(false);
        }
    }, [endDate, fetchMetrics, refreshing, startDate]);

    return {
        metrics,
        refreshing,
        refreshKey,
        refresh
    };
};
