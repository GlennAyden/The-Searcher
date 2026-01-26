/**
 * RAG Chat Service
 * 
 * Wraps disclosures API for feature-specific usage.
 */
import { disclosuresApi, type Disclosure } from '@/services/api/disclosures';

export const ragChatService = {
    /**
     * Fetch disclosures with optional filters
     */
    getDisclosures: async (
        ticker?: string,
        startDate?: string,
        endDate?: string
    ): Promise<Disclosure[]> => {
        const normalizedTicker = ticker === 'All' ? undefined : ticker;
        return disclosuresApi.getDisclosures(normalizedTicker, startDate, endDate);
    },

    /**
     * Send chat message to RAG system
     */
    sendMessage: async (
        docId: number,
        docTitle: string,
        prompt: string
    ): Promise<string> => {
        return disclosuresApi.sendChatMessage(docId, docTitle, prompt);
    },

    /**
     * Sync disclosures database with filesystem
     */
    syncDisclosures: async (): Promise<Record<string, unknown>> => {
        return disclosuresApi.syncDisclosures();
    },

    /**
     * Open local file with system application
     */
    openFile: async (filePath: string): Promise<Record<string, unknown>> => {
        return disclosuresApi.openFile(filePath);
    },
};
