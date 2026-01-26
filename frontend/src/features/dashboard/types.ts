export type DashboardTrends = {
    price: number[];
    mood: number[];
    correlation: number[];
    volume: number[];
};

export type DashboardMetrics = {
    price: number;
    price_delta: number;
    mood_score: number;
    mood_label: string;
    correlation: number;
    volume: number;
    trends: DashboardTrends;
};
