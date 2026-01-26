/**
 * Disclosures & RAG API client
 * 
 * Handles IDX disclosures, RAG chat, and file operations
 */

import { API_BASE_URL, buildParams } from './base';

export interface Disclosure {
    id: number;
    date: string;
    ticker: string;
    title: string;
    status: string;
    summary: string;
    local_path: string;
}

/**
 * Disclosures API client
 */
export const disclosuresApi = {
    /**
     * Get filtered IDX disclosures
     */
    getDisclosures: async (
        ticker?: string,
        startDate?: string,
        endDate?: string
    ): Promise<Disclosure[]> => {
        const params = buildParams({
            ticker,
            start_date: startDate,
            end_date: endDate
        });

        const response = await fetch(`${API_BASE_URL}/api/disclosures?${params}`);
        if (!response.ok) return [];
        return await response.json();
    },

    /**
     * Send chat message to RAG system
     */
    sendChatMessage: async (
        docId: number,
        docTitle: string,
        prompt: string
    ): Promise<string> => {
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                doc_id: docId,
                doc_title: docTitle,
                prompt
            })
        });

        if (!response.ok) {
            throw new Error('Failed to send message');
        }

        const data = await response.json();
        return data.response;
    },

    /**
     * Open local file with system default application
     */
    openFile: async (filePath: string): Promise<Record<string, unknown>> => {
        const response = await fetch(`${API_BASE_URL}/api/open-file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_path: filePath })
        });

        return await response.json();
    },

    /**
     * Sync disclosure database with filesystem
     */
    syncDisclosures: async (): Promise<Record<string, unknown>> => {
        const response = await fetch(`${API_BASE_URL}/api/sync-disclosures`, {
            method: 'POST'
        });
        return await response.json();
    },
};
