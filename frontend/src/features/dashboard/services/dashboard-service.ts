import { dashboardApi } from '@/services/api/dashboard';
import type { DashboardStats, SentimentDataPoint } from '@/services/api/dashboard';
import type { StockData } from '@/types/market';

export const dashboardService = {
    getDashboardStats: async (ticker: string, startDate?: string, endDate?: string): Promise<DashboardStats> => {
        return await dashboardApi.getDashboardStats(ticker, startDate, endDate);
    },
    getMarketData: async (ticker: string, startDate?: string, endDate?: string): Promise<StockData[]> => {
        return await dashboardApi.getMarketData(ticker, startDate, endDate);
    },
    getSentimentHistory: async (ticker: string, startDate?: string, endDate?: string): Promise<SentimentDataPoint[]> => {
        return await dashboardApi.getSentimentHistory(ticker, startDate, endDate);
    }
};
