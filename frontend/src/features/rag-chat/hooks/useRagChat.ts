'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useFilter } from '@/context/filter-context';
import { ragChatService } from '../services/rag-chat-service';
import type { Disclosure } from '@/services/api/disclosures';
import type { Message } from '../types';

/**
 * useRagChat - Custom hook for RAG chat state management
 * 
 * Handles:
 * - Disclosure fetching and filtering
 * - Chat message state per document
 * - Sync and loading states
 */
export function useRagChat() {
    const [disclosures, setDisclosures] = useState<Disclosure[]>([]);
    const [selectedDoc, setSelectedDoc] = useState<Disclosure | null>(null);
    const [messages, setMessages] = useState<Record<number, Message[]>>({});
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [chatLoading, setChatLoading] = useState(false);

    const { ticker, dateRange } = useFilter();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch disclosures based on filters
    const fetchDisclosures = useCallback(async () => {
        setLoading(true);
        try {
            const data = await ragChatService.getDisclosures(
                ticker,
                dateRange.start,
                dateRange.end
            );
            setDisclosures(data);
        } catch (error) {
            console.error("Failed to fetch disclosures:", error);
        } finally {
            setLoading(false);
        }
    }, [ticker, dateRange.start, dateRange.end]);

    // Auto-fetch on filter change
    useEffect(() => {
        fetchDisclosures();
    }, [fetchDisclosures]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [selectedDoc, messages]);

    // Sync disclosures with filesystem
    const handleSync = useCallback(async () => {
        setSyncing(true);
        try {
            await ragChatService.syncDisclosures();
            await fetchDisclosures();
        } catch (error) {
            console.error("Sync failure:", error);
            alert("Gagal melakukan sinkronisasi.");
        } finally {
            setSyncing(false);
        }
    }, [fetchDisclosures]);

    // Send chat message
    const sendMessage = useCallback(async (input: string) => {
        if (!input.trim() || !selectedDoc || chatLoading) return;

        const docId = selectedDoc.id;
        const userMsg: Message = { role: 'user', content: input };

        // Add user message immediately
        setMessages(prev => ({
            ...prev,
            [docId]: [...(prev[docId] || []), userMsg]
        }));

        setChatLoading(true);
        try {
            const response = await ragChatService.sendMessage(docId, selectedDoc.title, input);
            const assistantMsg: Message = { role: 'assistant', content: response };

            setMessages(prev => ({
                ...prev,
                [docId]: [...(prev[docId] || []), assistantMsg]
            }));
        } catch (error) {
            console.error("Chat failure:", error);
            const errorMsg: Message = {
                role: 'assistant',
                content: "Maaf, terjadi kesalahan saat memproses pertanyaan Anda."
            };
            setMessages(prev => ({
                ...prev,
                [docId]: [...(prev[docId] || []), errorMsg]
            }));
        } finally {
            setChatLoading(false);
        }
    }, [selectedDoc, chatLoading]);

    // Open file locally
    const openFile = useCallback(async (e: React.MouseEvent, filePath: string) => {
        e.stopPropagation();
        if (!filePath) return;
        try {
            await ragChatService.openFile(filePath);
        } catch (error) {
            console.error("Failed to open file:", error);
            alert("Gagal membuka file. Pastikan backend berjalan dan file tersedia.");
        }
    }, []);

    // Get current chat messages
    const currentChat = selectedDoc ? messages[selectedDoc.id] || [] : [];

    return {
        // State
        disclosures,
        selectedDoc,
        currentChat,
        loading,
        syncing,
        chatLoading,
        messagesEndRef,

        // Actions
        setSelectedDoc,
        handleSync,
        sendMessage,
        openFile,
    };
}
