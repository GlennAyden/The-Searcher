import { API_BASE_URL, buildParams, handleResponse } from '@/services/api/base';
import type { StoryFinderResponse } from '../types';

type StoryFinderRequest = {
    keywords: string[];
    startDate: string;
    endDate: string;
};

export const storyFinderService = {
    getStories: async ({ keywords, startDate, endDate }: StoryFinderRequest): Promise<StoryFinderResponse> => {
        const params = buildParams({
            keywords: keywords.join(','),
            start_date: startDate,
            end_date: endDate
        });

        const response = await fetch(`${API_BASE_URL}/api/story-finder?${params}`);
        return await handleResponse<StoryFinderResponse>(response, {
            stories: [],
            keyword_stats: {},
            total: 0
        });
    }
};
