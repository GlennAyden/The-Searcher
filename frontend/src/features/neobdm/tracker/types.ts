import type { SignalItem } from '@/services/api/neobdm';

export type FlowHistoryRow = Record<string, string | number | null | undefined> & {
    scraped_at: string;
    flow?: number;
    crossing?: string;
    unusual?: string;
    pinky?: string;
    price?: number;
    pct_change?: number;
    change?: number;
};

export type HotSignal = SignalItem & {
    patterns?: Array<{ display: string; icon?: string }>;
    warnings?: Array<{ message: string }>;
};

export type VolumePoint = {
    trade_date: string;
    volume: number;
    close_price?: number | null;
    [key: string]: string | number | null | undefined;
};

export type VolumeChartPoint = VolumePoint & {
    date: string;
    fullDate: string;
};

export type ChartRow = FlowHistoryRow & {
    activeFlow?: number;
    date: string;
    fullDate: string;
    isCrossing: boolean;
    isUnusual: boolean;
    isPinky: boolean;
    crossingVal?: string;
    unusualVal?: string;
    pinkyVal?: string;
};
