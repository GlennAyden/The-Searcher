/**
 * Scrapers API client
 * 
 * Handles all scraper trigger operations
 */

import { API_BASE_URL } from './base';

/**
 * Scrapers API client
 */
export const scrapersApi = {
    /**
     * Run news/disclosure scraper
     */
    runScraper: async (
        source: string,
        startDate: string,
        endDate: string,
        ticker?: string,
        scrapeAllHistory?: boolean
    ) => {
        const response = await fetch(`${API_BASE_URL}/api/scrape`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source,
                start_date: startDate,
                end_date: endDate,
                ticker,
                scrape_all_history: scrapeAllHistory
            })
        });

        return await response.json();
    },
};
