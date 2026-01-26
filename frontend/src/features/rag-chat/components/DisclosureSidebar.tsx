'use client';

import type { Disclosure } from '@/services/api/disclosures';

interface DisclosureSidebarProps {
    disclosures: Disclosure[];
    selectedDoc: Disclosure | null;
    loading: boolean;
    syncing: boolean;
    onSelect: (doc: Disclosure) => void;
    onSync: () => void;
    onOpenFile: (e: React.MouseEvent, filePath: string) => void;
}

export function DisclosureSidebar({
    disclosures,
    selectedDoc,
    loading,
    syncing,
    onSelect,
    onSync,
    onOpenFile,
}: DisclosureSidebarProps) {
    return (
        <div className="w-[350px] flex flex-col bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-md">
            {/* Header */}
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
                    onClick={onSync}
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

            {/* Document List */}
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
                            onClick={() => onSelect(doc)}
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
                                                onClick={(e) => onOpenFile(e, doc.local_path)}
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
    );
}
