import { API_BASE_URL, buildParams, handleResponse } from '@/services/api/base';
import type { StoryFinderResponse } from '../types';

type StoryFinderRequest = {
    keywords: string[];
    startDate: string;
    endDate: string;
    ticker?: string;
    allTime?: boolean;
};

export const storyFinderService = {
    getStories: async ({ keywords, startDate, endDate, ticker, allTime }: StoryFinderRequest): Promise<StoryFinderResponse> => {
        const params = buildParams({
            keywords: keywords.length > 0 ? keywords.join(',') : ' ',
            start_date: allTime ? undefined : startDate,
            end_date: allTime ? undefined : endDate,
            ticker: ticker || '',
            all_time: allTime ? true : undefined
        });

        const response = await fetch(`${API_BASE_URL}/api/story-finder?${params}`);
        return await handleResponse<StoryFinderResponse>(response, {
            stories: [],
            keyword_stats: {},
            total: 0
        });
    }
};
