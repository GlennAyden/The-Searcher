/**
 * Alpha Hunter Types & Interfaces
 */

// Stage status enum
export type StageStatus = 'locked' | 'idle' | 'loading' | 'ready' | 'error';

// Pattern definition
export interface Pattern {
    name: string;
    display: string;
    score: number;
    icon: string;
}

// Flow signal from Stage 1 scanner
export interface FlowSignal {
    symbol: string;
    signal_score: number;
    signal_strength: string;
    conviction: string;
    entry_zone: string;
    flow: number;
    change: number;
    price: number;
    patterns: Pattern[];
    pattern_names: string[];
    has_positive_pattern: boolean;
    alignment_status: string;
    momentum_status: string;
    warning_status: string;
    pinky?: string;
    crossing?: string;
    unusual?: string;
}

// Scanner statistics
export interface ScanStats {
    by_conviction: {
        VERY_HIGH: number;
        HIGH: number;
        MEDIUM: number;
        LOW: number;
    };
    by_strength: {
        VERY_STRONG: number;
        STRONG: number;
        MODERATE: number;
        WEAK: number;
    };
    with_positive_pattern: number;
    in_sweet_spot: number;
}

// Stage 1 data (from scanner)
export interface Stage1Data {
    signal_score: number;
    signal_strength: string;
    conviction: string;
    patterns: Pattern[];
    flow: number;
    change: number;
    price: number;
    entry_zone: string;
    detected_at: string;
}

// Stage 2 VPA data
export interface Stage2Data {
    ticker: string;
    spike: {
        date: string;
        source: string;
        price_change_pct: number;
        volume_ratio: number | null;
        volume_category: string;
        trend_status?: string;
    };
    compression: {
        is_sideways: boolean;
        compression_score: number;
        sideways_days: number;
        volatility_pct: number;
        price_range_pct: number;
        avg_close?: number;
    };
    flow_impact: {
        flow_impact_pct: number;
        value_traded: number;
        market_cap: number;
        flow_score: number;
    };
    accumulation: {
        period_start: string | null;
        period_end: string | null;
        accumulation_days: number;
        total_volume: number;
        avg_daily_volume: number;
        volume_trend: string;
        up_days: number;
        down_days: number;
        net_movement_pct: number;
        detection_method: string;
    };
    scores: {
        volume_score: number;
        compression_score: number;
        flow_score: number;
        anomaly_score: number;
        signal_level: string;
        pullback_health_score: number;
        adjusted_health_score: number;
        asymmetry_bonus: number;
        stage2_score: number;
    };
    pullback: {
        days_tracked: number;
        distribution_days: number;
        healthy_days: number;
        volume_asymmetry: {
            volume_up_total: number;
            volume_down_total: number;
            asymmetry_ratio: number;
            verdict: string;
            score_bonus: number;
        };
        log: Array<{
            date: string;
            price: number;
            volume: number;
            price_chg: number;
            vol_chg: number;
            status: string;
        }>;
    };
    breakout_setup: {
        resistance_price: number | null;
        resistance_date: string | null;
        current_price: number | null;
        current_date: string | null;
        distance_pct: number | null;
        status: 'ENTRY' | 'NEAR_BREAKOUT' | 'WAITING' | 'FAR' | 'NO_DATA';
        is_breakout: boolean;
        breakout_info: {
            break_price: number;
            break_date: string;
            volume: number;
            volume_ratio: number;
            quality: 'STRONG' | 'MODERATE' | 'WEAK';
        } | null;
    };
    big_player_analysis?: {
        data_status: 'ready' | 'partial' | 'needs_broker_data' | 'no_data' | 'no_dates' | 'error';
        missing_dates: string[];
        top_accumulators: Array<{
            broker_code: string;
            total_net_lot: number;
            total_net_value: number;
            trade_count: number;
            first_date: string;
            last_date: string;
        }>;
        floor_price: {
            data_status: string;
            price: number;
            current_price: number;
            confidence: string;
            institutional_buy_value: number;
            institutional_buy_lot: number;
            gap_to_current_pct: number;
            days_analyzed: number;
            top_institutional: Array<{
                code: string;
                total_lot: number;
                total_value: number;
                avg_price: number;
            }>;
        };
        inventory_balance: {
            data_status: string;
            accumulated_lot: number;
            distributed_lot: number;
            current_holding: number;
            distribution_pct: number;
            status: 'HOLDING' | 'DISTRIBUTING' | 'NEUTRAL' | 'NO_DATA';
            smart_vs_retail?: {
                smart_net_lot: number;
                retail_net_lot: number;
                dominance_pct: number;
                conviction: string;
            };
            top_brokers: Array<{
                code: string;
                net_lot: number;
                net_value: number;
            }>;
            days_analyzed: number;
        };
    };
    verdict: string;
}

// Price ladder for scraping
export interface PriceLadder {
    id: string;
    range_start: number;
    range_end: number;
    label: string;
    importance: 'critical' | 'recommended' | 'optional';
    estimated_time_minutes: number;
    is_current_price: boolean;
}

// Scraping queue item
export interface ScrapingQueueItem {
    ladder: PriceLadder;
    status: 'pending' | 'scraping' | 'complete' | 'error';
    progress: number;
    transactions_scraped: number;
    time_elapsed_seconds: number;
    error_message?: string;
}

// Stage 3 Flow data
export interface Stage3Data {
    ticker: string;
    floor_price: number;
    current_price: number;
    gap_pct: number;
    conviction: string;
    smart_money_accumulation: {
        passed: boolean;
        net_lot: number;
        net_value: number;
        active_days: number;
        total_days: number;
        top_brokers: Array<{ code: string; net_lot: number; net_value: number }>;
    };
    retail_capitulation: {
        passed: boolean;
        net_lot: number;
        net_value: number;
    };
    smart_vs_retail: {
        passed: boolean;
        dominance_pct: number;
        smart_net_lot: number;
        retail_net_lot: number;
    };
    checks_passed: number;
    total_checks: number;
    scraped_ranges: PriceLadder[];
    last_scraped_at: string;
}

// Stage 4 Supply data
export interface Stage4Data {
    ticker: string;
    supply_risk: 'LOW' | 'MEDIUM' | 'HIGH';
    demand_strength: 'WEAK' | 'MODERATE' | 'STRONG';
    overall_signal: 'GO' | 'CAUTION' | 'STOP';
    confidence_score: number;
    fifty_pct_rule: {
        passed: boolean;
        retail_buy: number;
        retail_sell: number;
        depletion_pct: number;
    };
    floor_price_rule: {
        passed: boolean;
        floor_price: number;
        close_price: number;
        gap_pct: number;
    };
    broker_concentration: {
        passed: boolean;
        top_n_concentration: number;
    };
    entry_strategy: {
        zone_low: number;
        zone_high: number;
        stop_loss: number;
        target_1: number;
        target_2: number;
        risk_reward: number;
    };
    data_source: 'manual' | 'scraped';
    raw_data_preview?: string;
}

// Stage state wrapper
export interface StageState<T> {
    status: StageStatus;
    data: T | null;
    error: string | null;
    lastUpdated: string | null;
    progress?: number;
}

// Complete investigation state for a ticker
export interface InvestigationState {
    ticker: string;
    addedAt: string;
    stage1: StageState<Stage1Data>;
    stage2: StageState<Stage2Data>;
    stage3: StageState<Stage3Data> & {
        scrapingQueue: ScrapingQueueItem[];
        selectedLadders: string[]; // ladder IDs
        recommendedLadders: PriceLadder[];
    };
    stage4: StageState<Stage4Data> & {
        isSkipped: boolean;
        manualDataInput: string;
    };
    currentStage: 1 | 2 | 3 | 4;
    isComplete: boolean;
    completedAt: string | null;
    finalRecommendation?: {
        action: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'AVOID';
        entry_zone: { low: number; high: number };
        stop_loss: number;
        targets: number[];
        risk_reward: number;
        confidence: number;
    };
}

// Investigation map type
export type InvestigationsMap = Record<string, InvestigationState>;

// Filter options for Stage 1 scanner
export interface ScannerFilters {
    minScore: number;
    minFlow: number;
    maxPriceChange: number;
    strengthFilter: string | null;
    patternFilter: string[];
}

// Context value type
export interface AlphaHunterContextValue {
    // State
    selectedTicker: string | null;
    investigations: InvestigationsMap;
    isAtScanner: boolean;

    // Navigation
    selectTicker: (ticker: string | null) => void;
    goToScanner: () => void;

    // Investigation management
    addInvestigation: (ticker: string, stage1Data: Stage1Data) => void;
    removeInvestigation: (ticker: string) => void;

    // Stage updates
    updateStageStatus: (ticker: string, stage: 2 | 3 | 4, status: StageStatus, error?: string) => void;
    updateStage2Data: (ticker: string, data: Stage2Data) => void;
    updateStage3Data: (ticker: string, data: Stage3Data) => void;
    updateStage4Data: (ticker: string, data: Stage4Data) => void;

    // Stage 3 scraping
    setRecommendedLadders: (ticker: string, ladders: PriceLadder[]) => void;
    toggleLadderSelection: (ticker: string, ladderId: string) => void;
    updateScrapingQueue: (ticker: string, queue: ScrapingQueueItem[]) => void;

    // Stage 4 manual input
    setManualDataInput: (ticker: string, data: string) => void;
    skipStage4: (ticker: string) => void;

    // Completion
    markComplete: (ticker: string, recommendation: InvestigationState['finalRecommendation']) => void;

    // Utility
    getCurrentStageStatus: (ticker: string, stage: 2 | 3 | 4) => StageStatus;
    canProceedToStage: (ticker: string, stage: 3 | 4) => boolean;
}

// Create initial investigation state
export function createInitialInvestigation(ticker: string, stage1Data: Stage1Data): InvestigationState {
    return {
        ticker,
        addedAt: new Date().toISOString(),
        stage1: {
            status: 'ready',
            data: stage1Data,
            error: null,
            lastUpdated: new Date().toISOString(),
        },
        stage2: {
            status: 'idle',
            data: null,
            error: null,
            lastUpdated: null,
        },
        stage3: {
            status: 'locked',
            data: null,
            error: null,
            lastUpdated: null,
            scrapingQueue: [],
            selectedLadders: [],
            recommendedLadders: [],
        },
        stage4: {
            status: 'locked',
            data: null,
            error: null,
            lastUpdated: null,
            isSkipped: false,
            manualDataInput: '',
        },
        currentStage: 2,
        isComplete: false,
        completedAt: null,
    };
}
