/**
 * NeoBDM API client
 * 
 * Handles market maker analysis, fund flow data, and hot signals
 */

import { API_BASE_URL, buildParams } from './base';

// Re-export from brokerFive for backward compatibility
export { type BrokerFiveItem } from './brokerFive';

export interface NeoBDMData {
    scraped_at: string | null;
    data: unknown[];
}

export interface NeoBDMHistory {
    symbol: string;
    history: unknown[];
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
    [key: string]: unknown;
}

export interface HotSignal {
    signals: SignalItem[];
}

export interface TopHolderItem {
    broker_code: string;
    total_net_lot: number;
    total_net_value: number;
    trade_count: number;
    first_date: string;
    last_date: string;
}

export interface TopHoldersResponse {
    ticker: string;
    top_holders: TopHolderItem[];
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
            scrape_date: startDate,
            end_date: endDate
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
        buy: unknown[];
        sell: unknown[];
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
    },

    /**
     * Get available dates for a ticker (broker summary)
     */
    getAvailableDatesForTicker: async (ticker: string): Promise<{
        ticker: string;
        available_dates: string[];
        total_count: number;
    }> => {
        const response = await fetch(`${API_BASE_URL}/api/neobdm-broker-summary/available-dates/${ticker}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch available dates');
        }
        return await response.json();
    },

    /**
     * Get broker journey data (accumulation/distribution over time)
     */
    getBrokerJourney: async (
        ticker: string,
        brokers: string[],
        startDate: string,
        endDate: string
    ): Promise<{
        ticker: string;
        date_range: { start: string; end: string };
        brokers: Array<{
            broker_code: string;
            daily_data: Array<{
                date: string;
                buy_lot: number;
                buy_value: number;
                buy_avg_price: number;
                sell_lot: number;
                sell_value: number;
                sell_avg_price: number;
                net_lot: number;
                net_value: number;
                cumulative_net_lot: number;
                cumulative_net_value: number;
            }>;
            summary: {
                total_buy_lot: number;
                total_buy_value: number;
                total_sell_lot: number;
                total_sell_value: number;
                net_lot: number;
                net_value: number;
                avg_buy_price: number;
                avg_sell_price: number;
                days_active: number;
                is_accumulating: boolean;
            };
        }>;
    }> => {
        const response = await fetch(`${API_BASE_URL}/api/neobdm-broker-summary/journey`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ticker,
                brokers,
                start_date: startDate,
                end_date: endDate
            })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch broker journey');
        }
        return await response.json();
    },

    /**
     * Get top N holders for a ticker based on cumulative net lot
     */
    getTopHolders: async (
        ticker: string,
        limit: number = 3
    ): Promise<TopHoldersResponse> => {
        const response = await fetch(
            `${API_BASE_URL}/api/neobdm-broker-summary/top-holders/${ticker}?limit=${limit}`
        );
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch top holders');
        }
        return await response.json();
    },

    /**
     * Get floor price analysis based on institutional broker buy prices
     */
    getFloorPriceAnalysis: async (
        ticker: string,
        days: number = 30
    ): Promise<FloorPriceAnalysis> => {
        const response = await fetch(
            `${API_BASE_URL}/api/neobdm-broker-summary/floor-price/${ticker}?days=${days}`
        );
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch floor price analysis');
        }
        return await response.json();
    },

    /**
     * Get scrape status for all tickers (from Done Detail)
     */
    getScrapeStatus: async (): Promise<{ data: { ticker: string, last_scraped: string, total_records: number }[] }> => {
        const response = await fetch(`${API_BASE_URL}/api/done-detail/status`);
        if (!response.ok) {
            throw new Error('Failed to fetch scrape status');
        }
        return await response.json();
    },

    
};

export interface FloorPriceBroker {
    code: string;
    total_lot: number;
    total_value: number;
    avg_price: number;
    trade_count: number;
}

export interface FloorPriceAnalysis {
    ticker: string;
    floor_price: number;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NO_DATA' | 'ERROR';
    institutional_buy_value: number;
    institutional_buy_lot: number;
    foreign_buy_value?: number;
    foreign_buy_lot?: number;
    institutional_brokers: FloorPriceBroker[];
    foreign_brokers: FloorPriceBroker[];
    days_analyzed: number;
    latest_date: string | null;
    error?: string;
}
