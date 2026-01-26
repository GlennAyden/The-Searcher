/**
 * Done Detail API Service
 * 
 * API methods for Done Detail feature - paste-based trade data analysis
 */
import { API_BASE_URL } from './base';

export interface DoneDetailRecord {
    id: number;
    ticker: string;
    trade_date: string;
    trade_time: string;
    board: string;
    price: number;
    qty: number;
    buyer_type: string;
    buyer_code: string;
    seller_code: string;
    seller_type: string;
}

export interface SavedHistory {
    ticker: string;
    trade_date: string;
    record_count: number;
    created_at: string;
}

export interface AccumDistAnalysis {
    status: 'AKUMULASI' | 'DISTRIBUSI' | 'NETRAL' | 'NO_DATA' | 'ERROR';
    retail_net_lot: number;
    institutional_net_lot: number;
    foreign_net_lot: number;
    retail_brokers: { code: string; net_lot: number }[];
    institutional_brokers: { code: string; net_lot: number }[];
    foreign_brokers: { code: string; net_lot: number }[];
    total_volume: number;
    error?: string;
}

export interface DateRangeInfo {
    min_date: string | null;
    max_date: string | null;
    dates: string[];
}

// All trades structure (raw data)
export interface TradeRecord {
    trade_date: string;
    trade_time: string;
    buyer_code: string;
    buyer_name: string;
    seller_code: string;
    seller_name: string;
    qty: number;
    price: number;
    value: number;
    is_imposter: boolean;
    imposter_side: 'BUY' | 'SELL' | 'BOTH' | null;
    imposter_broker: string | null;
}

// Imposter trade (when detected)
export interface ImposterTrade {
    trade_date: string;
    trade_time: string;
    broker_code: string;
    broker_name: string;
    direction: 'BUY' | 'SELL';
    qty: number;
    price: number;
    value: number;
    counterparty: string;
    level: 'STRONG' | 'POSSIBLE';
    percentile: number;
    broker_type: 'retail' | 'mixed';
}

export interface ImposterBrokerStats {
    broker: string;
    name: string;
    count: number;
    buy_count: number;
    sell_count: number;
    total_value: number;
    total_lot: number;
    strong_count: number;
    possible_count: number;
}

export interface ImposterAnalysis {
    ticker: string;
    date_range: { start: string; end: string };
    total_transactions: number;
    imposter_count: number;
    thresholds: {
        p95: number;
        p99: number;
        median: number;
        mean: number;
    };
    all_trades: TradeRecord[];
    imposter_trades: ImposterTrade[];
    by_broker: ImposterBrokerStats[];
    summary: {
        total_value: number;
        total_lot: number;
        imposter_value: number;
        imposter_lot: number;
        imposter_percentage: number;
        strong_count: number;
        possible_count: number;
    };
    error?: string;
    message?: string;
}

// Speed Analysis interfaces
export interface SpeedBrokerStats {
    broker: string;
    name: string;
    total_trades: number;
    buy_trades: number;
    sell_trades: number;
    total_value: number;
    seconds_active: number;
    trades_per_second: number;
}

export interface BurstEvent {
    trade_time: string;
    trade_count: number;
}

export interface TimelinePoint {
    time: string;
    trades: number;
}

export interface SpeedAnalysis {
    ticker: string;
    date_range: { start: string; end: string };
    speed_by_broker: SpeedBrokerStats[];
    broker_timelines: Record<string, TimelinePoint[]>;
    burst_events: BurstEvent[];
    timeline: TimelinePoint[];
    summary: {
        total_trades: number;
        unique_seconds: number;
        avg_trades_per_second: number;
        max_trades_per_second: number;
        peak_time: string | null;
    };
    error?: string;
    message?: string;
}

// Combined Analysis interfaces (merges Impostor + Speed)
export interface SignalInfo {
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    level: 'STRONG' | 'MODERATE' | 'WEAK' | 'NEUTRAL';
    confidence: number;
    description: string;
}

export interface ImpostorFlow {
    buy_value: number;
    sell_value: number;
    net_value: number;
    buy_count: number;
    sell_count: number;
    buy_pct: number;
    sell_pct: number;
}

export interface PowerBroker {
    broker_code: string;
    broker_name: string;
    broker_type: string;
    impostor_value: number;
    impostor_count: number;
    strong_count: number;
    possible_count: number;
    speed_trades: number;
    speed_tps: number;
    net_direction: 'BUY' | 'SELL';
    net_value: number;
    buy_value: number;
    sell_value: number;
}

export interface KeyMetrics {
    strong_impostor_count: number;
    possible_impostor_count: number;
    total_impostor_value: number;
    avg_tps: number;
    max_tps: number;
    peak_time: string | null;
    burst_count: number;
    total_trades: number;
}

export interface TimelinePointWithBurst {
    time: string;
    trades: number;
    has_burst: boolean;
}

export interface CombinedAnalysis {
    ticker: string;
    date_range: { start: string; end: string };
    signal: SignalInfo;
    impostor_flow: ImpostorFlow;
    power_brokers: PowerBroker[];
    key_metrics: KeyMetrics;
    timeline: TimelinePointWithBurst[];
    burst_events: BurstEvent[];
    thresholds: {
        p95: number;
        p99: number;
        median: number;
        mean: number;
    };
    // DEPRECATED: These fields have been removed from the API to prevent
    // socket hang up errors from massive payloads. Use separate endpoints instead:
    // - doneDetailApi.getImposterAnalysis() 
    // - doneDetailApi.getSpeedAnalysis()
    imposter_analysis?: ImposterAnalysis;
    speed_analysis?: SpeedAnalysis;
    error?: string;
    message?: string;
}

export interface BrokerProfile {
    broker: string;
    name: string;
    found: boolean;
    summary: {
        buy_value: number;
        sell_value: number;
        net_value: number;
        buy_freq: number;
        sell_freq: number;
        avg_buy_price: number;
        avg_sell_price: number;
    };
    hourly_stats: {
        hour: string;
        buy_val: number;
        sell_val: number;
        freq: number;
    }[];
    counterparties: {
        top_sellers: { broker: string; type: string; value: number }[];
        top_buyers: { broker: string; type: string; value: number }[];
    };
    recent_trades: {
        time: string;
        price: number;
        qty: number;
        value: number;
        action: 'BUY' | 'SELL';
        counterparty: string;
    }[];
}

export const doneDetailApi = {
    /**
     * Check if data exists for ticker and date
     */
    checkExists: async (ticker: string, tradeDate: string): Promise<{ exists: boolean }> => {
        const response = await fetch(`${API_BASE_URL}/api/done-detail/exists/${ticker}/${tradeDate}`);
        return await response.json();
    },

    /**
     * Save pasted trade data
     */
    saveData: async (ticker: string, tradeDate: string, data: string): Promise<{ success: boolean; records_saved: number }> => {
        const response = await fetch(`${API_BASE_URL}/api/done-detail/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ticker,
                trade_date: tradeDate,
                data
            })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to save data');
        }
        return await response.json();
    },

    /**
     * Get trade records for ticker and date
     */
    getData: async (ticker: string, tradeDate: string): Promise<{ records: DoneDetailRecord[]; count: number }> => {
        const response = await fetch(`${API_BASE_URL}/api/done-detail/data/${ticker}/${tradeDate}`);
        return await response.json();
    },

    /**
     * Get all saved history
     */
    getHistory: async (): Promise<{ history: SavedHistory[] }> => {
        const response = await fetch(`${API_BASE_URL}/api/done-detail/history`);
        return await response.json();
    },

    /**
     * Delete records for ticker and date
     */
    deleteData: async (ticker: string, tradeDate: string): Promise<{ success: boolean }> => {
        const response = await fetch(`${API_BASE_URL}/api/done-detail/${ticker}/${tradeDate}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to delete data');
        }
        return await response.json();
    },

    /**
     * Get Accumulation/Distribution analysis based on broker classification
     */
    getAccumDistAnalysis: async (ticker: string, tradeDate: string): Promise<AccumDistAnalysis> => {
        const response = await fetch(`${API_BASE_URL}/api/done-detail/analysis/${ticker}/${tradeDate}`);
        return await response.json();
    },

    /**
     * Get list of tickers that have saved Done Detail data
     */
    getTickers: async (): Promise<{ tickers: string[] }> => {
        const response = await fetch(`${API_BASE_URL}/api/done-detail/tickers`);
        return await response.json();
    },

    /**
     * Get available date range for a ticker
     */
    getDateRange: async (ticker: string): Promise<DateRangeInfo> => {
        const response = await fetch(`${API_BASE_URL}/api/done-detail/dates/${ticker}`);
        return await response.json();
    },

    /**
     * Get Imposter Detection analysis
     * Returns all trades + imposter detection (value > 1B Rupiah from retail brokers)
     */
    getImposterAnalysis: async (ticker: string, startDate: string, endDate: string): Promise<ImposterAnalysis> => {
        const response = await fetch(
            `${API_BASE_URL}/api/done-detail/imposter/${ticker}?start_date=${startDate}&end_date=${endDate}`
        );
        return await response.json();
    },

    /**
     * Get Speed Analysis
     * Analyzes trading speed, burst patterns, and broker frequency
     */
    getSpeedAnalysis: async (ticker: string, startDate: string, endDate: string): Promise<SpeedAnalysis> => {
        const response = await fetch(
            `${API_BASE_URL}/api/done-detail/speed/${ticker}?start_date=${startDate}&end_date=${endDate}`
        );
        return await response.json();
    },

    /**
     * Get Combined Analysis
     * Merges Impostor and Speed data for trading signals
     */
    getCombinedAnalysis: async (ticker: string, startDate: string, endDate: string): Promise<CombinedAnalysis> => {
        const response = await fetch(
            `${API_BASE_URL}/api/done-detail/combined/${ticker}?start_date=${startDate}&end_date=${endDate}`
        );
        return await response.json();
    },

    getBrokerProfile: async (ticker: string, brokerCode: string, startDate: string, endDate: string): Promise<BrokerProfile> => {
        const response = await fetch(
            `${API_BASE_URL}/api/done-detail/broker/${ticker}/${brokerCode}?start_date=${startDate}&end_date=${endDate}`
        );
        return await response.json();
    },

    /**
     * Get Range Analysis
     * Analyzes date range for 50% Rule (Retail Capitulation) and Imposter Recurrence
     */
    getRangeAnalysis: async (ticker: string, startDate: string, endDate: string): Promise<RangeAnalysis> => {
        const response = await fetch(
            `${API_BASE_URL}/api/done-detail/range-analysis/${ticker}?start_date=${startDate}&end_date=${endDate}`
        );
        return await response.json();
    }
};

// ===== Range Analysis Interfaces =====

export interface RetailCapitulationBroker {
    broker: string;
    name: string;
    peak_position: number;
    current_position: number;
    distribution_pct: number;
    is_safe: boolean;
    history: Array<{ date: string; cumulative: number }>;
}

export interface RetailCapitulation {
    brokers: RetailCapitulationBroker[];
    overall_pct: number;
    safe_count: number;
    holding_count: number;
}

export interface ImposterRecurrenceBroker {
    broker: string;
    name: string;
    days_active: number;
    total_days: number;
    recurrence_pct: number;
    total_value: number;
    total_count: number;
    avg_lot: number;
    daily_activity: Array<{ date: string; value: number; count: number }>;
}

export interface BattleTimelineDay {
    date: string;
    total_imposter_value: number;
    trade_count: number;
    broker_breakdown: Record<string, number>;
}

export interface RangeSummary {
    total_imposter_trades: number;
    top_ghost_broker: string | null;
    top_ghost_name: string | null;
    peak_day: string | null;
    peak_value: number;
    avg_lot: number;
    avg_daily_imposter_pct: number;
    total_days: number;
    retail_capitulation_pct: number;
}

export interface RangeAnalysis {
    ticker: string;
    date_range: { start: string; end: string };
    retail_capitulation: RetailCapitulation;
    imposter_recurrence: { brokers: ImposterRecurrenceBroker[] };
    battle_timeline: BattleTimelineDay[];
    summary: RangeSummary;
    error?: string;
}
