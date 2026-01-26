import { scrapersApi } from '@/services/api/scrapers';

const DEFAULT_SOURCES = [
    'CNBC Indonesia',
    'EmitenNews',
    'Bisnis.com',
    'Investor.id'
];

export const scraperService = {
    runScrapers: async (startDate: string, endDate: string, sources: string[] = DEFAULT_SOURCES) => {
        await Promise.all(
            sources.map((source) =>
                scrapersApi.runScraper(source, startDate, endDate)
                    .catch((err) => {
                        console.warn(`[Refresh] ${source} failed:`, err);
                    })
            )
        );
    },
    defaultSources: DEFAULT_SOURCES
};
