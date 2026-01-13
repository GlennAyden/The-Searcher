/**
 * Dashboard API client
 * 
 * Handles dashboard statistics, market data, and sentiment history
 */

import { StockData } from '@/types/market';
import { API_BASE_URL, buildParams } from './base';

export interface DashboardStats {
    current_price: number;
    price_change: number;
    price_change_pct: number;
    market_mood: string;
    correlation: number;
    news_volume: number;
    [key: string]: any;
}

export interface SentimentDataPoint {
    date: string;
    score: number;
    sma: number;
    count: number;
}

/**
 * Dashboard API client
 */
export const dashboardApi = {
    /**
     * Get list of available tickers
     */
    getTickers: async (): Promise<string[]> => {
        const response = await fetch(`${API_BASE_URL}/api/tickers`);
        const data = await response.json();
        return data.tickers;
    },

    /**
     * Get master list of issuer tickers
     */
    getIssuerTickers: async (): Promise<string[]> => {
        const response = await fetch(`${API_BASE_URL}/api/issuer-tickers`);
        const data = await response.json();
        return data.tickers;
    },

    /**
     * Get comprehensive dashboard statistics
     */
    getDashboardStats: async (
        ticker: string,
        startDate?: string,
        endDate?: string
    ): Promise<DashboardStats> => {
        const params = buildParams({ ticker, start_date: startDate, end_date: endDate });
        const response = await fetch(`${API_BASE_URL}/api/dashboard-stats?${params}`);
        return await response.json();
    },

    /**
     * Get OHLC market data for charts
     */
    getMarketData: async (
        ticker: string,
        startDate?: string,
        endDate?: string
    ): Promise<StockData[]> => {
        const params = buildParams({ ticker, start_date: startDate, end_date: endDate });
        const response = await fetch(`${API_BASE_URL}/api/market-data?${params}`);
        return await response.json();
    },

    /**
     * Get sentiment history with daily aggregation
     */
    getSentimentHistory: async (
        ticker: string,
        startDate?: string,
        endDate?: string
    ): Promise<SentimentDataPoint[]> => {
        const params = buildParams({ ticker, start_date: startDate, end_date: endDate });
        const response = await fetch(`${API_BASE_URL}/api/sentiment-data?${params}`);
        return await response.json();
    },
};
