'use client';

import type { Message } from '../types';

interface MessageFeedProps {
    messages: Message[];
    chatLoading: boolean;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export function MessageFeed({ messages, chatLoading, messagesEndRef }: MessageFeedProps) {
    return (
        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin scrollbar-thumb-zinc-800">
            {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600 opacity-50 space-y-4">
                    <div className="w-12 h-12 border-2 border-dashed border-zinc-700 rounded-2xl flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                        </svg>
                    </div>
                    <p className="text-sm font-medium">Hello! Ask me anything about this document.</p>
                </div>
            )}
            {messages.map((msg, idx) => (
                <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                    <div className={`max-w-[85%] p-4 rounded-2xl ${msg.role === 'user'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                        : 'bg-zinc-800/80 text-zinc-100 border border-zinc-700/50'
                        }`}>
                        <div className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-60">
                            {msg.role === 'user' ? 'Pertanyaan Anda' : 'Analisis AI'}
                        </div>
                        <div className="text-[15px] leading-relaxed whitespace-pre-wrap">
                            {msg.content}
                        </div>
                    </div>
                </div>
            ))}
            {chatLoading && (
                <div className="flex justify-start">
                    <div className="bg-zinc-800/80 p-6 rounded-2xl border border-zinc-700/50 w-full animate-pulse">
                        <div className="h-2 w-32 bg-zinc-700 rounded-full mb-4"></div>
                        <div className="space-y-2">
                            <div className="h-2.5 bg-zinc-700 rounded-full w-full"></div>
                            <div className="h-2.5 bg-zinc-700 rounded-full w-5/6"></div>
                            <div className="h-2.5 bg-zinc-700 rounded-full w-4/6"></div>
                        </div>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>
    );
}
