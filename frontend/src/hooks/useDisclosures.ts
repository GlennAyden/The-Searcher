/**
 * Disclosures and RAG-specific hooks
 * 
 * Encapsulates IDX disclosures and RAG chat logic
 */

import { useState, useEffect, useCallback } from 'react';
import { disclosuresApi, type Disclosure } from '@/services/api/disclosures';
import { useApi } from './useApi';

/**
 * Hook for fetching IDX disclosures
 */
export function useDisclosures(ticker?: string, startDate?: string, endDate?: string) {
    const { data, loading, error, execute } = useApi(disclosuresApi.getDisclosures);

    useEffect(() => {
        execute(ticker, startDate, endDate);
    }, [ticker, startDate, endDate, execute]);

    return {
        disclosures: data || [],
        loading,
        error,
        refetch: () => execute(ticker, startDate, endDate)
    };
}

/**
 * Hook for RAG chat functionality
 */
export function useRAGChat(docId: number, docTitle: string) {
    const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sendMessage = useCallback(async (prompt: string) => {
        // Add user message
        setMessages(prev => [...prev, { role: 'user', content: prompt }]);
        setLoading(true);
        setError(null);

        try {
            const response = await disclosuresApi.sendChatMessage(docId, docTitle, prompt);
            setMessages(prev => [...prev, { role: 'assistant', content: response }]);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to send message';
            setError(errorMsg);
            // Remove failed user message
            setMessages(prev => prev.slice(0, -1));
        } finally {
            setLoading(false);
        }
    }, [docId, docTitle]);

    const clearChat = useCallback(() => {
        setMessages([]);
        setError(null);
    }, []);

    return {
        messages,
        loading,
        error,
        sendMessage,
        clearChat
    };
}

/**
 * Hook for opening local files
 */
export function useFileOpener() {
    const [lastOpened, setLastOpened] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const openFile = useCallback(async (filePath: string) => {
        try {
            await disclosuresApi.openFile(filePath);
            setLastOpened(filePath);
            setError(null);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to open file';
            setError(errorMsg);
            console.error('File open error:', err);
        }
    }, []);

    return { openFile, lastOpened, error };
}

/**
 * Hook for disclosure synchronization
 */
export function useDisclosureSync() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const sync = useCallback(async () => {
        setIsSyncing(true);
        setError(null);

        try {
            const response = await disclosuresApi.syncDisclosures();
            setResult(response);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Sync failed';
            setError(errorMsg);
        } finally {
            setIsSyncing(false);
        }
    }, []);

    return { sync, isSyncing, result, error };
}
