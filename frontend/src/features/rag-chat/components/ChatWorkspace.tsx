'use client';

import type { Disclosure } from '@/services/api/disclosures';
import type { Message } from '../types';
import { ChatHeader } from './ChatHeader';
import { MessageFeed } from './MessageFeed';
import { ChatInput } from './ChatInput';

interface ChatWorkspaceProps {
    selectedDoc: Disclosure | null;
    messages: Message[];
    chatLoading: boolean;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    onSendMessage: (input: string) => void;
    onOpenFile: (e: React.MouseEvent, filePath: string) => void;
}

export function ChatWorkspace({
    selectedDoc,
    messages,
    chatLoading,
    messagesEndRef,
    onSendMessage,
    onOpenFile,
}: ChatWorkspaceProps) {
    if (!selectedDoc) {
        return (
            <div className="flex-1 flex flex-col bg-zinc-900/30 border border-zinc-800 rounded-3xl overflow-hidden backdrop-blur-xl relative shadow-2xl">
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
                    <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-zinc-800">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-zinc-400">Mulai Analisis Dokumen</h3>
                    <p className="mt-2 text-sm text-zinc-500 max-w-[300px] text-center">
                        Pilih dokumen dari panel kiri untuk mulai bertanya tentang isi keterbukaan informasi tersebut.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-zinc-900/30 border border-zinc-800 rounded-3xl overflow-hidden backdrop-blur-xl relative shadow-2xl">
            <ChatHeader doc={selectedDoc} onOpenFile={onOpenFile} />
            <MessageFeed
                messages={messages}
                chatLoading={chatLoading}
                messagesEndRef={messagesEndRef}
            />
            <ChatInput
                ticker={selectedDoc.ticker}
                chatLoading={chatLoading}
                onSend={onSendMessage}
            />
        </div>
    );
}
