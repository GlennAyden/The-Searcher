/**
 * RAG Chat Types
 */
import type { Disclosure } from '@/services/api/disclosures';

export interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export interface RagChatState {
    disclosures: Disclosure[];
    selectedDoc: Disclosure | null;
    messages: Record<number, Message[]>;
    loading: boolean;
    syncing: boolean;
    chatLoading: boolean;
}
