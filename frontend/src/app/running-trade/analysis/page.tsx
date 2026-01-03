'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, ArrowLeft, Filter, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from '@/services/api'; // Ensure this exists or use fetch directly
import { BrokerAnalysis } from "@/components/running-trade/BrokerAnalysis";
import { HistoricalScraper } from "@/components/running-trade/HistoricalScraper";
import Link from 'next/link';

export default function AnalysisPage() {
    const [ticker, setTicker] = useState("BBCA");
    const [selectedDates, setSelectedDates] = useState<string[]>([]);
    const [availableTickers, setAvailableTickers] = useState<string[]>([]);
    const [inventory, setInventory] = useState<{ ticker: string, scrape_date: string, count: number }[]>([]);
    const [isInventoryLoading, setIsInventoryLoading] = useState(true);
    const [showScraper, setShowScraper] = useState(false);
    const [isLoginMode, setIsLoginMode] = useState(false);
    const [isSavingSession, setIsSavingSession] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    const fetchInventory = async () => {
        try {
            const resI = await fetch('http://localhost:8000/api/rt/inventory');
            const dataI = await resI.json();
            if (Array.isArray(dataI)) setInventory(dataI);
        } catch (e) {
            console.error("Failed to fetch inventory:", e);
        }
    };

    const handleLogin = async () => {
        setIsLoginMode(true);
        try {
            await fetch('http://localhost:8000/api/rt/login', { method: 'POST' });
        } catch (e) {
            console.error("Failed to start login mode:", e);
        }
    };

    const handleSaveSession = async () => {
        setIsSavingSession(true);
        try {
            const res = await fetch('http://localhost:8000/api/rt/save-session', { method: 'POST' });
            const data = await res.json();
            if (data.status === 'success') {
                setIsLoginMode(false);
            }
        } catch (e) {
            console.error("Failed to save session:", e);
        } finally {
            setIsSavingSession(false);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Tickers
                const resT = await fetch('http://localhost:8000/api/rt/tickers');
                const dataT = await resT.json();
                if (dataT.tickers) setAvailableTickers(dataT.tickers);

                // Initial Inventory
                fetchInventory();
            } catch (e) {
                console.error("Failed to fetch page data:", e);
            } finally {
                setIsInventoryLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleDeleteItem = async (e: React.MouseEvent, item: { ticker: string, scrape_date: string }) => {
        e.stopPropagation();
        if (!confirm(`Hapus data ${item.ticker} tanggal ${item.scrape_date}?`)) return;

        try {
            const res = await fetch(`http://localhost:8000/api/rt/analysis/delete?ticker=${item.ticker}&date=${item.scrape_date}`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.status === 'success') {
                fetchInventory();
                if (ticker === item.ticker && selectedDates.includes(item.scrape_date)) {
                    const newDates = selectedDates.filter(d => d !== item.scrape_date);
                    setSelectedDates(newDates);
                    if (newDates.length === 0) setTicker("");
                }
            } else {
                alert("Gagal menghapus: " + (data.error || "Unknown error"));
            }
        } catch (err) {
            console.error("Delete failed:", err);
            alert("Terjadi kesalahan saat menghapus data.");
        }
    };

    const handleSelectItem = (e: React.MouseEvent, item: { ticker: string, scrape_date: string }) => {
        const isMulti = e.ctrlKey || e.metaKey;

        if (item.ticker !== ticker) {
            setTicker(item.ticker);
            setSelectedDates([item.scrape_date]);
        } else {
            if (isMulti) {
                setSelectedDates(prev => prev.includes(item.scrape_date)
                    ? prev.filter(d => d !== item.scrape_date)
                    : [...prev, item.scrape_date]);
            } else {
                setSelectedDates([item.scrape_date]);
            }
        }
        setShowScraper(false);
    };

    return (
        <div className="h-full w-full bg-black flex flex-col p-4 space-y-4 overflow-hidden">
            {/* Page Header */}
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <Link href="/running-trade" className="text-gray-500 hover:text-white transition-colors bg-white/5 p-2 rounded-lg">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-white">Running Trade Analysis</h1>
                        <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">Behavioral Broker Profiling</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {isLoginMode ? (
                        <Button
                            onClick={handleSaveSession}
                            disabled={isSavingSession}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white border-0 font-bold h-8 animate-pulse"
                        >
                            {isSavingSession ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
                            SAVE SESSION
                        </Button>
                    ) : (
                        <Button
                            onClick={handleLogin}
                            variant="ghost"
                            size="sm"
                            className="text-gray-500 hover:text-white text-[10px] font-black h-8 tracking-tighter"
                        >
                            FIX LOGIN
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex-1 flex gap-4 overflow-hidden transition-all duration-300">
                {/* Sidebar Inventory */}
                <Card className={`${isSidebarCollapsed ? 'w-12' : 'w-72'} shrink-0 bg-zinc-900/50 border-zinc-800 flex flex-col overflow-hidden transition-all duration-300 relative group/sidebar`}>
                    <Button
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        variant="ghost"
                        size="icon"
                        className="absolute -right-2 top-1/2 -translate-y-1/2 z-50 w-6 h-12 bg-zinc-800 border border-zinc-700 rounded-lg opacity-0 group-hover/sidebar:opacity-100 transition-opacity flex items-center justify-center hover:bg-zinc-700 hover:text-white text-zinc-400"
                    >
                        {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </Button>

                    {!isSidebarCollapsed ? (
                        <>
                            <CardHeader className="p-3 border-b border-zinc-800 shrink-0 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Filter className="w-4 h-4 text-amber-500" />
                                        <CardTitle className="text-sm font-bold text-white">Scraped History</CardTitle>
                                    </div>
                                </div>
                                <Button
                                    onClick={() => setShowScraper(!showScraper)}
                                    variant="secondary"
                                    size="sm"
                                    className={`w-full text-[10px] font-black h-7 tracking-tighter ${showScraper ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-white/5 hover:bg-white/10 text-amber-500'}`}
                                >
                                    {showScraper ? 'CANCEL SCRAPE' : 'SCRAPE NEW DATA'}
                                </Button>
                            </CardHeader>
                            <CardContent className="p-0 flex-1 overflow-y-auto custom-scrollbar">
                                {isInventoryLoading ? (
                                    <div className="p-4 flex flex-col items-center gap-2 text-zinc-500 italic text-xs">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Loading inventory...</span>
                                    </div>
                                ) : inventory.length === 0 ? (
                                    <div className="p-4 text-zinc-500 text-xs text-center italic">
                                        No history found. Start scraping!
                                    </div>
                                ) : (
                                    <div className="divide-y divide-zinc-800">
                                        {inventory.map((item, idx) => (
                                            <div key={idx} className="group relative">
                                                <button
                                                    onClick={(e) => handleSelectItem(e, item)}
                                                    className={`w-full p-3 text-left hover:bg-white/5 transition-colors flex flex-col gap-1 pr-10 ${ticker === item.ticker && selectedDates.includes(item.scrape_date) && !showScraper ? 'bg-amber-500/10 border-r-2 border-amber-500' : ''}`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-white font-black font-mono text-sm group-hover:text-amber-400 transition-colors uppercase">{item.ticker}</span>
                                                        <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-mono">
                                                            {item.count.toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] text-zinc-500 font-mono">
                                                        {item.scrape_date}
                                                    </div>
                                                </button>

                                                <button
                                                    onClick={(e) => handleDeleteItem(e, item)}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                    title="Delete history"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center pt-4 gap-6 text-zinc-600">
                            <Filter className="w-5 h-5" />
                            <div className="[writing-mode:vertical-lr] rotate-180 text-[10px] font-black tracking-widest uppercase opacity-40">
                                Scraped History
                            </div>
                        </div>
                    )}
                </Card>

                {/* Main Content Area */}
                <Card className="flex-1 bg-zinc-900/50 border-zinc-800 overflow-hidden flex flex-col shadow-2xl">
                    <CardContent className="flex-1 p-0 overflow-hidden relative">
                        <div className="absolute inset-0 flex flex-col">
                            {showScraper ? (
                                <div className="p-8 max-w-2xl mx-auto w-full overflow-y-auto custom-scrollbar">
                                    <HistoricalScraper
                                        availableTickers={availableTickers}
                                        onScrapeSuccess={fetchInventory}
                                    />
                                    <div className="mt-8 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs text-amber-200/60 leading-relaxed italic text-center">
                                        Data yang sudah di-scrape akan otomatis muncul di daftar "Scraped History" sebelah kiri.
                                    </div>
                                </div>
                            ) : (
                                <BrokerAnalysis
                                    ticker={ticker}
                                    initialDates={selectedDates}
                                    onClose={() => { }}
                                />
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
