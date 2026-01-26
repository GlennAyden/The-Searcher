export interface StoryItem {
    id: string;
    date: string;
    date_display: string;
    ticker: string;
    title: string;
    matched_keywords: string[];
    primary_category: string;
    primary_icon: string;
    highlight_positions: number[][];
    sentiment_label: string;
    sentiment_score: number;
    source: string;
    url: string;
}

export interface KeywordInfo {
    keyword: string;
    category: string;
    icon: string;
}

export interface StoryFinderResponse {
    stories: StoryItem[];
    keyword_stats: Record<string, number>;
    total: number;
}
