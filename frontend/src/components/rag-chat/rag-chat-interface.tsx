'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { disclosuresApi, type Disclosure } from '@/services/api/disclosures';
import { useFilter } from '@/context/filter-context';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export const RagChatInterface = () => {
    // State
    const [disclosures, setDisclosures] = useState<Disclosure[]>([]);
    const [selectedDoc, setSelectedDoc] = useState<Disclosure | null>(null);
    const [messages, setMessages] = useState<Record<number, Message[]>>({});
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [chatLoading, setChatLoading] = useState(false);

    // Global filters
    const { ticker, dateRange } = useFilter();

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const fetchDisclosures = useCallback(async () => {
        setLoading(true);
        try {
            const data = await disclosuresApi.getDisclosures(ticker === 'All' ? undefined : ticker, dateRange.start, dateRange.end);
            setDisclosures(data);
        } catch (error) {
            console.error("Failed to fetch disclosures:", error);
        } finally {
            setLoading(false);
        }
    }, [ticker, dateRange.start, dateRange.end]);

    useEffect(() => {
        fetchDisclosures();
    }, [fetchDisclosures]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [selectedDoc, messages]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            await disclosuresApi.syncDisclosures();
            await fetchDisclosures();
        } catch (error) {
            console.error("Sync failure:", error);
            alert("Gagal melakukan sinkronisasi.");
        } finally {
            setSyncing(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || !selectedDoc || chatLoading) return;

        const currentInput = input;
        setInput('');

        const docId = selectedDoc.id;
        const userMsg: Message = { role: 'user', content: currentInput };

        setMessages(prev => ({
            ...prev,
            [docId]: [...(prev[docId] || []), userMsg]
        }));

        setChatLoading(true);
        try {
            const response = await disclosuresApi.sendChatMessage(docId, selectedDoc.title, currentInput);
            const assistantMsg: Message = { role: 'assistant', content: response };

            setMessages(prev => ({
                ...prev,
                [docId]: [...(prev[docId] || []), assistantMsg]
            }));
        } catch (error) {
            console.error("Chat failure:", error);
            const errorMsg: Message = { role: 'assistant', content: "Maaf, terjadi kesalahan saat memproses pertanyaan Anda." };
            setMessages(prev => ({
                ...prev,
                [docId]: [...(prev[docId] || []), errorMsg]
            }));
        } finally {
            setChatLoading(false);
        }
    };

    const handleOpenFile = async (e: React.MouseEvent, filePath: string) => {
        e.stopPropagation();
        if (!filePath) return;
        try {
            await disclosuresApi.openFile(filePath);
        } catch (error) {
            console.error("Failed to open file:", error);
            alert("Gagal membuka file. Pastikan backend berjalan dan file tersedia.");
        }
    };

    const currentChat = selectedDoc ? messages[selectedDoc.id] || [] : [];

    return (
        <div className="flex h-[calc(100vh-180px)] gap-4 text-zinc-100 font-sans">
            {/* Sidebar Sumber */}
            <div className="w-[350px] flex flex-col bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-md">
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/60">
                    <div className="flex flex-col">
                        <h2 className="text-xs font-bold tracking-widest text-zinc-500 uppercase">SUMBER</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 font-mono border border-zinc-700/50">
                                {disclosures.length} DOKUMEN
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className={`p-2 rounded-xl transition-all border ${syncing
                            ? 'bg-blue-600/20 border-blue-500/30 text-blue-400'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 hover:border-zinc-600'
                            }`}
                        title="Sinkronisasi Data"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-none">
                    {loading ? (
                        <div className="h-full flex items-center justify-center text-zinc-600 font-mono text-xs animate-pulse">
                            MENCARI DOKUMEN...
                        </div>
                    ) : disclosures.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-zinc-600 text-xs italic text-center p-8">
                            Tidak ada dokumen keterbukaan informasi untuk rentang waktu ini.
                        </div>
                    ) : (
                        disclosures.map((doc) => (
                            <div
                                key={doc.id}
                                onClick={() => setSelectedDoc(doc)}
                                className={`group p-3 rounded-xl border transition-all cursor-pointer ${selectedDoc?.id === doc.id
                                    ? 'bg-blue-600/10 border-blue-500/50 shadow-lg shadow-blue-900/10'
                                    : 'bg-zinc-900/50 border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-800/50'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-lg ${selectedDoc?.id === doc.id ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-500 group-hover:text-zinc-300'}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[11px] font-bold text-zinc-500 uppercase flex items-center gap-2">
                                            <span>{doc.ticker}</span>
                                            <span>•</span>
                                            <span>{doc.date}</span>
                                        </div>
                                        <div className={`mt-1 text-sm font-medium leading-snug truncate-2-lines ${selectedDoc?.id === doc.id ? 'text-blue-100' : 'text-zinc-300'}`}>
                                            {doc.title}
                                        </div>
                                    </div>
                                    {selectedDoc?.id === doc.id && (
                                        <div className="flex flex-col gap-2">
                                            <div className="text-blue-500">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                            {doc.local_path && (
                                                <button
                                                    onClick={(e) => handleOpenFile(e, doc.local_path)}
                                                    className="p-1.5 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 rounded-md transition-colors shadow-sm"
                                                    title="Buka File Lokal"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Chat Workspace */}
            <div className="flex-1 flex flex-col bg-zinc-900/30 border border-zinc-800 rounded-3xl overflow-hidden backdrop-blur-xl relative shadow-2xl">
                {!selectedDoc ? (
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
                ) : (
                    <>
                        {/* Chat Header */}
                        <div className="px-8 py-6 border-b border-zinc-800/50 bg-zinc-900/50">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-bold text-blue-400 tracking-widest uppercase">
                                    Active Document
                                </div>
                                <div className="flex items-center gap-3">
                                    {selectedDoc.local_path && (
                                        <button
                                            onClick={(e) => handleOpenFile(e, selectedDoc.local_path)}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-bold transition-all border border-zinc-700 hover:border-zinc-500"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                            OPEN DOCUMENT
                                        </button>
                                    )}
                                    <button className="text-zinc-500 hover:text-zinc-300 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <h2 className="text-xl font-bold text-white line-clamp-1">{selectedDoc.title}</h2>
                            <div className="mt-1 text-sm text-zinc-500 flex items-center gap-3">
                                <span className="font-bold text-blue-500">{selectedDoc.ticker}</span>
                                <span>•</span>
                                <span>Published on {selectedDoc.date}</span>
                                <span>•</span>
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold border border-emerald-500/30">
                                    {selectedDoc.status}
                                </span>
                            </div>

                            {selectedDoc.summary && (
                                <div className="mt-4 p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl">
                                    <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                                        AI Summary Preview
                                    </div>
                                    <div className="text-sm text-zinc-400 leading-relaxed italic">
                                        {selectedDoc.summary}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Message Feed */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin scrollbar-thumb-zinc-800">
                            {currentChat.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-600 opacity-50 space-y-4">
                                    <div className="w-12 h-12 border-2 border-dashed border-zinc-700 rounded-2xl flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                                        </svg>
                                    </div>
                                    <p className="text-sm font-medium">Hello! Ask me anything about this document.</p>
                                </div>
                            )}
                            {currentChat.map((msg, idx) => (
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

                        {/* Input Area */}
                        <div className="p-8 pt-0">
                            <div className="relative max-w-4xl mx-auto shadow-2xl">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder={`Tanya tentang ${selectedDoc.ticker}...`}
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
                    </>
                )}
            </div>
        </div>
    );
};
