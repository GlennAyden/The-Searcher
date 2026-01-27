import { newsApi, type NewsItem, type PaginatedNewsResponse } from '@/services/api/news';

export const newsService = {
    getNews: async (
        ticker: string | undefined,
        startDate: string,
        endDate: string,
        sentimentFilter: string,
        sourceFilter: string,
        allTime: boolean = false
    ): Promise<NewsItem[]> => {
        return await newsApi.getNews(ticker, startDate, endDate, sentimentFilter, sourceFilter, allTime);
    },
    getNewsPage: async (
        ticker: string | undefined,
        startDate: string,
        endDate: string,
        sentimentFilter: string,
        sourceFilter: string,
        allTime: boolean,
        limit: number,
        offset: number
    ): Promise<PaginatedNewsResponse> => {
        return await newsApi.getNewsPage(
            ticker,
            startDate,
            endDate,
            sentimentFilter,
            sourceFilter,
            allTime,
            limit,
            offset
        );
    },
    getSingleNewsBrief: async (title: string, ticker: string) => {
        return await newsApi.getSingleNewsBrief(title, ticker);
    }
};
