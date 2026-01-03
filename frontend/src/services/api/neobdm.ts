/**
 * NeoBDM API client
 * 
 * Handles market maker analysis, fund flow data, and hot signals
 */

import { API_BASE_URL, buildParams } from './base';

export interface NeoBDMData {
    scraped_at: string | null;
    data: any[];
}

export interface NeoBDMHistory {
    symbol: string;
    history: any[];
}

export interface HotSignal {
    signals: any[];
}

/**
 * NeoBDM API client
 */
export const neobdmApi = {
    /**
     * Get NeoBDM market summary
     */
    getNeoBDMSummary: async (
        method: string = 'm',
        period: string = 'c',
        scrape: boolean = false,
        startDate?: string,
        endDate?: string
    ): Promise<NeoBDMData> => {
        const params = buildParams({
            method,
            period,
            scrape: scrape.toString(),
            scrape_date: startDate
        });

        const response = await fetch(`${API_BASE_URL}/api/neobdm-summary?${params}`);
        return await response.json();
    },

    /**
     * Get available scrape dates
     */
    getNeoBDMDates: async (): Promise<{ dates: string[] }> => {
        const response = await fetch(`${API_BASE_URL}/api/neobdm-dates`);
        return await response.json();
    },

    /**
     * Run full batch scrape of all NeoBDM data
     */
    runNeoBDMBatchScrape: async (): Promise<{
        status: string;
        message: string;
        details?: string[];
    }> => {
        const response = await fetch(`${API_BASE_URL}/api/neobdm-batch-scrape`, {
            method: 'POST'
        });
        return await response.json();
    },

    /**
     * Get historical money flow for a symbol
     */
    getNeoBDMHistory: async (
        symbol: string,
        method: string = 'm',
        period: string = 'c',
        limit: number = 30
    ): Promise<NeoBDMHistory> => {
        const params = buildParams({ symbol, method, period, limit: limit.toString() });
        const response = await fetch(`${API_BASE_URL}/api/neobdm-history?${params}`);
        return await response.json();
    },

    /**
     * Get list of available tickers in NeoBDM data
     */
    getNeoBDMTickers: async (): Promise<{ tickers: string[] }> => {
        const response = await fetch(`${API_BASE_URL}/api/neobdm-tickers`);
        return await response.json();
    },

    /**
     * Get hot signals - stocks with interesting patterns
     */
    getNeoBDMHotList: async (): Promise<HotSignal> => {
        const response = await fetch(`${API_BASE_URL}/api/neobdm-hot`);
        return await response.json();
    },
};
