import { neobdmApi } from '@/services/api/neobdm';

export const neobdmSummaryService = {
    getDates: async () => {
        return await neobdmApi.getNeoBDMDates();
    },
    getSummary: async (
        method: string,
        period: string,
        selectedDate?: string
    ) => {
        return await neobdmApi.getNeoBDMSummary(
            method,
            period,
            false,
            selectedDate || undefined,
            selectedDate || undefined
        );
    },
    runBatchSync: async () => {
        return await neobdmApi.runNeoBDMBatchScrape();
    }
};
