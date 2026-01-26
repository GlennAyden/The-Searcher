'use client';

import { useRagChat } from '../hooks/useRagChat';
import { DisclosureSidebar } from './DisclosureSidebar';
import { ChatWorkspace } from './ChatWorkspace';

/**
 * RagChatInterface - Main composite component for RAG Chat feature
 * 
 * Combines DisclosureSidebar and ChatWorkspace with shared state from useRagChat hook.
 */
export function RagChatInterface() {
    const {
        disclosures,
        selectedDoc,
        currentChat,
        loading,
        syncing,
        chatLoading,
        messagesEndRef,
        setSelectedDoc,
        handleSync,
        sendMessage,
        openFile,
    } = useRagChat();

    return (
        <div className="flex h-[calc(100vh-180px)] gap-4 text-zinc-100 font-sans">
            <DisclosureSidebar
                disclosures={disclosures}
                selectedDoc={selectedDoc}
                loading={loading}
                syncing={syncing}
                onSelect={setSelectedDoc}
                onSync={handleSync}
                onOpenFile={openFile}
            />
            <ChatWorkspace
                selectedDoc={selectedDoc}
                messages={currentChat}
                chatLoading={chatLoading}
                messagesEndRef={messagesEndRef}
                onSendMessage={sendMessage}
                onOpenFile={openFile}
            />
        </div>
    );
}
