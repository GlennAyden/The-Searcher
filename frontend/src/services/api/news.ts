/**
 * News API client
 * 
 * Handles news articles, AI insights, word clouds, and ticker counts
 */

import { API_BASE_URL, buildParams, sanitizeDate, handleResponse } from './base';

export interface NewsItem {
    id: string;
    date: string;
    ticker: string;
    label: string;
    score: number;
    title: string;
    source?: string;
    url: string;
}

export interface TickerCount {
    ticker: string;
    count: number;
}

/**
 * News API client
 */
export const newsApi = {
    /**
     * Get filtered news articles
     */
    getNews: async (
        ticker?: string,
        startDate?: string,
        endDate?: string,
        sentiment: string = "All",
        source: string = "All"
    ): Promise<NewsItem[]> => {
        const params = buildParams({
            ticker: ticker !== 'All' ? ticker : undefined,
            start_date: sanitizeDate(startDate),
            end_date: sanitizeDate(endDate),
            sentiment,
            source
        });

        const response = await fetch(`${API_BASE_URL}/api/news?${params}`);
        return await handleResponse(response, []);
    },

    /**
     * Get AI-generated brief summary of news
     */
    getBriefNews: async (
        ticker?: string,
        startDate?: string,
        endDate?: string,
        sentiment: string = "All",
        source: string = "All"
    ): Promise<string> => {
        const params = buildParams({
            ticker: ticker !== 'All' ? ticker : undefined,
            start_date: sanitizeDate(startDate),
            end_date: sanitizeDate(endDate),
            sentiment,
            source
        });

        const response = await fetch(`${API_BASE_URL}/api/brief-news?${params}`);
        if (!response.ok) return "Failed to fetch summary.";

        const data = await response.json();
        return data.brief;
    },

    /**
     * Get AI insight for a single news article
     */
    getSingleNewsBrief: async (title: string, ticker?: string): Promise<string> => {
        const params = buildParams({ title, ticker });
        const response = await fetch(`${API_BASE_URL}/api/brief-single?${params}`);

        if (!response.ok) return "Failed to fetch insight.";

        const data = await response.json();
        return data.brief;
    },

    /**
     * Get word cloud image for ticker mentions
     */
    getWordCloud: async (
        ticker?: string,
        startDate?: string,
        endDate?: string
    ): Promise<{ image: string | null }> => {
        const params = buildParams({
            ticker,
            start_date: startDate,
            end_date: endDate
        });

        const response = await fetch(`${API_BASE_URL}/api/wordcloud?${params}`);
        return await response.json();
    },

    /**
     * Get ticker mention counts for trending analysis
     */
    getTickerCounts: async (
        ticker?: string,
        startDate?: string,
        endDate?: string
    ): Promise<TickerCount[]> => {
        const params = buildParams({
            ticker,
            start_date: startDate,
            end_date: endDate
        });

        const response = await fetch(`${API_BASE_URL}/api/ticker-counts?${params}`);
        const data = await response.json();
        return data.counts || [];
    },
};
