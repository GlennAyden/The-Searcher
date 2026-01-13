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

export interface SignalItem {
    symbol: string;
    signal_score: number;
    signal_strength: 'VERY_STRONG' | 'STRONG' | 'MODERATE' | 'WEAK' | 'AVOID';
    momentum_icon: string;
    momentum_status: string;
    flow: number;
    price: number;
    change: number;
    [key: string]: any;
}

export interface HotSignal {
    signals: SignalItem[];
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
        const params = buildParams({
            symbol,
            method,
            period,
            limit: limit.toString(),
            _t: Date.now().toString() // Cache busting
        });
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

    /**
     * Get broker summary data (Net Buy & Net Sell)
     */
    getNeoBDMBrokerSummary: async (
        ticker: string,
        tradeDate: string,
        scrape: boolean = false
    ): Promise<{
        ticker: string;
        trade_date: string;
        buy: any[];
        sell: any[];
        source: string;
    }> => {
        const params = buildParams({
            ticker,
            trade_date: tradeDate,
            scrape: scrape.toString()
        });
        const response = await fetch(`${API_BASE_URL}/api/neobdm-broker-summary?${params}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch broker summary');
        }
        return await response.json();
    },

    /**
     * Run a batch scraping job for multiple tickers and dates
     */
    runNeoBDMBrokerSummaryBatch: async (
        tasks: Array<{ ticker: string, dates: string[] }>
    ): Promise<{ status: string, message: string }> => {
        const response = await fetch(`${API_BASE_URL}/api/neobdm-broker-summary-batch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tasks)
        });
        return await response.json();
    },

    /**
     * Get daily volume data for a ticker with smart incremental fetching
     */
    getVolumeDaily: async (ticker: string): Promise<{
        ticker: string;
        data: Array<{
            trade_date: string;
            volume: number;
            open_price?: number;
            high_price?: number;
            low_price?: number;
            close_price?: number;
        }>;
        source: string;
        records_added: number;
    }> => {
        const params = buildParams({ ticker });
        const response = await fetch(`${API_BASE_URL}/api/volume-daily?${params}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch volume data');
        }
        return await response.json();
    }
};
