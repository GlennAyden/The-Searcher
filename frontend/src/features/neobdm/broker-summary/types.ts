import { neobdmApi } from '@/services/api/neobdm';

export type BrokerJourneyResponse = Awaited<ReturnType<typeof neobdmApi.getBrokerJourney>> & {
    price_data?: Array<{ date: string; close_price: number }>;
};

export type JourneyChartRow = {
    date: string;
} & Record<string, number | null>;
