/**
 * Price Volume API Service
 * 
 * Handles API calls for OHLCV candlestick data and moving averages.
 */

import { API_BASE_URL } from './base';

export interface OHLCVRecord {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface MARecord {
    time: string;
    value: number;
}

export interface PriceVolumeResponse {
    ticker: string;
    data: OHLCVRecord[];
    ma5: MARecord[];
    ma10: MARecord[];
    ma20: MARecord[];
    volumeMa20: MARecord[];
    source: 'database' | 'fetched_full' | 'fetched_incremental';
    records_count: number;
    records_added: number;
}

export interface TickerDataStatus {
    ticker: string;
    exists: boolean;
    record_count: number;
    latest_date: string | null;
    earliest_date: string | null;
}

export const priceVolumeApi = {
    /**
     * Get OHLCV data with moving averages for a ticker.
     * 
     * @param ticker Stock ticker symbol (e.g., 'BBCA')
     * @param months Number of months of historical data (default: 9)
     * @returns OHLCV data with MA5, MA10, MA20, and Volume MA20
     */
    getOHLCV: async (ticker: string, months: number = 9): Promise<PriceVolumeResponse> => {
        const response = await fetch(
            `${API_BASE_URL}/api/price-volume/${ticker}?months=${months}`
        );

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
            throw new Error(error.detail || `Failed to fetch data for ${ticker}`);
        }

        return response.json();
    },

    /**
     * Check if data exists for a ticker in the database.
     * 
     * @param ticker Stock ticker symbol
     * @returns Status information about the ticker's data
     */
    checkDataExists: async (ticker: string): Promise<TickerDataStatus> => {
        const response = await fetch(
            `${API_BASE_URL}/api/price-volume/${ticker}/exists`
        );

        if (!response.ok) {
            throw new Error(`Failed to check data status for ${ticker}`);
        }

        return response.json();
    },

    /**
     * Scan for unusual volume events across all tickers.
     * 
     * @param scanDays Number of days to scan (default: 30)
     * @param minRatio Minimum volume/median ratio (default: 2.0)
     * @param lookbackDays Days to calculate median (default: 20)
     * @returns List of unusual volume events
     */
    scanUnusualVolumes: async (
        scanDays: number = 30,
        minRatio: number = 2.0,
        lookbackDays: number = 20
    ): Promise<UnusualVolumeResponse> => {
        const params = new URLSearchParams({
            scan_days: scanDays.toString(),
            min_ratio: minRatio.toString(),
            lookback_days: lookbackDays.toString()
        });

        const response = await fetch(
            `${API_BASE_URL}/api/price-volume/unusual/scan?${params}`
        );

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
            throw new Error(error.detail || 'Failed to fetch unusual volumes');
        }

        return response.json();
    },

    /**
     * Get volume spike markers for a specific ticker to display on chart.
     * 
     * @param ticker Stock ticker symbol
     * @param lookbackDays Days to calculate median (default: 20)
     * @param minRatio Minimum volume/median ratio (default: 2.0)
     * @returns List of spike markers with position and styling info
     */
    getSpikeMarkers: async (
        ticker: string,
        lookbackDays: number = 20,
        minRatio: number = 2.0
    ): Promise<SpikeMarkersResponse> => {
        const params = new URLSearchParams({
            lookback_days: lookbackDays.toString(),
            min_ratio: minRatio.toString()
        });

        const response = await fetch(
            `${API_BASE_URL}/api/price-volume/${ticker}/spike-markers?${params}`
        );

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
            throw new Error(error.detail || `Failed to fetch spike markers for ${ticker}`);
        }

        return response.json();
    },

    /**
     * Get market cap data and history for a ticker.
     * 
     * @param ticker Stock ticker symbol
     * @param days Number of days of history (default: 90)
     * @returns Current market cap and historical trend
     */
    getMarketCap: async (ticker: string, days: number = 90): Promise<MarketCapResponse> => {
        const params = new URLSearchParams({
            days: days.toString()
        });

        const response = await fetch(
            `${API_BASE_URL}/api/price-volume/${ticker}/market-cap?${params}`
        );

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
            throw new Error(error.detail || `Failed to fetch market cap for ${ticker}`);
        }

        return response.json();
    },

    /**
     * Refresh OHLCV data for all existing tickers in the database.
     * 
     * @returns Refresh status with per-ticker results
     */
    refreshAllTickers: async (): Promise<RefreshAllResponse> => {
        const response = await fetch(
            `${API_BASE_URL}/api/price-volume/refresh-all`,
            { method: 'POST' }
        );

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
            throw new Error(error.detail || 'Failed to refresh tickers');
        }

        return response.json();
    },

    /**
     * Get HK Methodology analysis for a ticker (Volume Asymmetry, Pre-Spike Accumulation).
     * 
     * @param ticker Stock ticker symbol
     * @param spikeDate Optional specific spike date to analyze
     * @returns HK analysis data with volume asymmetry and accumulation details
     */
    getHKAnalysis: async (ticker: string, spikeDate?: string): Promise<HKAnalysisResponse> => {
        const params = new URLSearchParams();
        if (spikeDate) {
            params.set('spike_date', spikeDate);
        }

        const url = `${API_BASE_URL}/api/price-volume/${ticker}/hk-analysis${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url);

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
            throw new Error(error.detail || `Failed to fetch HK analysis for ${ticker}`);
        }

        return response.json();
    }
};

// Additional types for unusual volume
export interface UnusualVolumeEvent {
    ticker: string;
    date: string;
    volume: number;
    median_20d: number;
    ratio: number;
    category: 'elevated' | 'high' | 'extreme';
    close: number;
    price_change: number;
}

export interface UnusualVolumeResponse {
    unusual_volumes: UnusualVolumeEvent[];
    scan_params: {
        scan_days: number;
        lookback_days: number;
        min_ratio: number;
        start_date: string;
        end_date: string;
    };
    total_tickers_scanned: number;
    unusual_count: number;
}

// Types for spike markers
export interface SpikeMarker {
    time: string;
    volume: number;
    median_20d: number;
    ratio: number;
    category: 'elevated' | 'high' | 'extreme';
    color: string;
    close: number;
    price_change: number;
    position: 'aboveBar' | 'belowBar';
    shape: 'arrowUp' | 'arrowDown';
    text: string;
}

export interface SpikeMarkersResponse {
    ticker: string;
    markers: SpikeMarker[];
    marker_count: number;
}

// Market Cap types
export interface MarketCapHistory {
    date: string;
    market_cap: number;
    shares_outstanding: number | null;
    close_price: number | null;
}

export interface MarketCapResponse {
    ticker: string;
    current_market_cap: number | null;
    shares_outstanding: number | null;
    currency: string;
    change_1d_pct: number | null;
    change_7d_pct: number | null;
    change_30d_pct: number | null;
    history: MarketCapHistory[];
    history_count: number;
}

// Refresh All types
export interface RefreshTickerResult {
    ticker: string;
    status: 'updated' | 'already_up_to_date' | 'no_new_data' | 'no_existing_data';
    records_added: number;
    previous_latest?: string;
    new_latest?: string;
    latest_date?: string;
}

export interface RefreshError {
    ticker: string;
    error: string;
}

export interface RefreshAllResponse {
    tickers_processed: number;
    tickers_updated: number;
    total_records_added: number;
    results: RefreshTickerResult[];
    errors: RefreshError[];
    message?: string;
}

// HK Methodology Analysis types
export interface HKVolumeAsymmetry {
    volume_up_total: number;
    volume_down_total: number;
    asymmetry_ratio: number;
    verdict: 'STRONG_HOLDING' | 'HOLDING' | 'NEUTRAL' | 'DISTRIBUTING' | 'NO_DATA';
    days_analyzed: number;
    pullback_log: Array<{
        date: string;
        price: number;
        volume: number;
        price_chg: number;
        vol_chg: number;
        status: string;
    }>;
}

export interface HKAccumulation {
    period_start: string | null;
    period_end: string | null;
    detection_method: string;
    accumulation_days: number;
    total_volume: number;
    avg_daily_volume: number;
    volume_trend: 'INCREASING' | 'STABLE' | 'DECREASING' | 'NO_DATA';
    up_days: number;
    down_days: number;
    net_movement_pct: number;
}

export interface HKAnalysisResponse {
    ticker: string;
    spike_date: string;
    spike_source: 'auto_detected' | 'user_specified';
    volume_asymmetry: HKVolumeAsymmetry;
    accumulation: HKAccumulation;
}
