'use client';

import { useState } from 'react';

interface ChatInputProps {
    ticker: string;
    chatLoading: boolean;
    onSend: (input: string) => void;
}

export function ChatInput({ ticker, chatLoading, onSend }: ChatInputProps) {
    const [input, setInput] = useState('');

    const handleSend = () => {
        if (!input.trim() || chatLoading) return;
        onSend(input);
        setInput('');
    };

    return (
        <div className="p-8 pt-0">
            <div className="relative max-w-4xl mx-auto shadow-2xl">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={`Tanya tentang ${ticker}...`}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-5 pl-7 pr-32 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-zinc-200 shadow-inner placeholder:text-zinc-600 transition-all text-[15px]"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <span className="text-[10px] text-zinc-600 font-mono mr-2 hidden sm:inline">Press Enter ↵</span>
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || chatLoading}
                        className={`p-3 rounded-xl transition-all ${input.trim() && !chatLoading
                            ? 'bg-blue-600 text-white hover:bg-blue-500 hover:scale-105 active:scale-95 shadow-lg shadow-blue-600/30'
                            : 'bg-zinc-900 text-zinc-600 grayscale bg-opacity-50'
                            }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </button>
                </div>
            </div>
            <div className="mt-3 text-[10px] text-center text-zinc-600 uppercase tracking-[0.2em] font-medium italic">
                Powered by Llama 3.2 & RAG Engine
            </div>
        </div>
    );
}
