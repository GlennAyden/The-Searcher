/**
 * RAG Chat Feature Module
 * 
 * Provides document-based chat interface using RAG (Retrieval Augmented Generation).
 * 
 * Components:
 * - RagChatInterface: Main composite component
 * - DisclosureSidebar: Document list panel
 * - ChatWorkspace: Chat messages and input
 * 
 * Hooks:
 * - useRagChat: State management for disclosures and chat
 * 
 * Services:
 * - ragChatService: API wrapper for disclosures and chat
 */

export { RagChatInterface } from './components/RagChatInterface';
export { DisclosureSidebar } from './components/DisclosureSidebar';
export { ChatWorkspace } from './components/ChatWorkspace';
export { ChatHeader } from './components/ChatHeader';
export { MessageFeed } from './components/MessageFeed';
export { ChatInput } from './components/ChatInput';
export { useRagChat } from './hooks/useRagChat';
export { ragChatService } from './services/rag-chat-service';
export type { Message, RagChatState } from './types';
