import { newsApi, type NewsItem } from '@/services/api/news';

export const newsService = {
    getNews: async (
        ticker: string | undefined,
        startDate: string,
        endDate: string,
        sentimentFilter: string,
        sourceFilter: string
    ): Promise<NewsItem[]> => {
        return await newsApi.getNews(ticker, startDate, endDate, sentimentFilter, sourceFilter);
    },
    getSingleNewsBrief: async (title: string, ticker: string) => {
        return await newsApi.getSingleNewsBrief(title, ticker);
    }
};
