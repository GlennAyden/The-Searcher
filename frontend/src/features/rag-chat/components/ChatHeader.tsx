'use client';

import type { Disclosure } from '@/services/api/disclosures';

interface ChatHeaderProps {
    doc: Disclosure;
    onOpenFile: (e: React.MouseEvent, filePath: string) => void;
}

export function ChatHeader({ doc, onOpenFile }: ChatHeaderProps) {
    return (
        <div className="px-8 py-6 border-b border-zinc-800/50 bg-zinc-900/50">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-bold text-blue-400 tracking-widest uppercase">
                    Active Document
                </div>
                <div className="flex items-center gap-3">
                    {doc.local_path && (
                        <button
                            onClick={(e) => onOpenFile(e, doc.local_path)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-bold transition-all border border-zinc-700 hover:border-zinc-500"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            OPEN DOCUMENT
                        </button>
                    )}
                </div>
            </div>
            <h2 className="text-xl font-bold text-white line-clamp-1">{doc.title}</h2>
            <div className="mt-1 text-sm text-zinc-500 flex items-center gap-3">
                <span className="font-bold text-blue-500">{doc.ticker}</span>
                <span>•</span>
                <span>Published on {doc.date}</span>
                <span>•</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold border border-emerald-500/30">
                    {doc.status}
                </span>
            </div>

            {doc.summary && (
                <div className="mt-4 p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl">
                    <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                        AI Summary Preview
                    </div>
                    <div className="text-sm text-zinc-400 leading-relaxed italic">
                        {doc.summary}
                    </div>
                </div>
            )}
        </div>
    );
}
