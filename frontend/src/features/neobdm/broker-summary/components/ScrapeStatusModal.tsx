'use client';

import React, { useState } from 'react';
import { Database, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { neobdmApi } from '@/services/api/neobdm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ScrapeStatusData {
    ticker: string;
    last_scraped: string;
    total_records: number;
}

export const ScrapeStatusModal = () => {
    const [statusData, setStatusData] = useState<ScrapeStatusData[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchStatus = async () => {
        setLoading(true);
        try {
            const data = await neobdmApi.getScrapeStatus();
            setStatusData(data.data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (dateStr: string) => {
        const today = new Date();
        const lastDate = new Date(dateStr);
        const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays <= 1) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
        if (diffDays <= 3) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
        return "bg-red-500/20 text-red-400 border-red-500/30";
    };

    return (
        <Dialog onOpenChange={(open: boolean) => open && fetchStatus()}>
            <DialogTrigger asChild>
                <button
                    className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all border border-zinc-700/50"
                    title="Check Data Status"
                >
                    <Database className="w-4 h-4" />
                    Data Status
                </button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl bg-zinc-950 border-zinc-800 text-zinc-100">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Database className="w-5 h-5 text-blue-500" />
                            Scrape Data Status
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="border border-zinc-800 rounded-md bg-zinc-900/20">
                        <div className="grid grid-cols-4 bg-zinc-900/80 p-3 text-xs font-bold text-zinc-400 border-b border-zinc-800">
                            <div>TICKER</div>
                            <div>LAST SCRAPED</div>
                            <div>TOTAL RECORDS</div>
                            <div>STATUS</div>
                        </div>
                        <ScrollArea className="h-[400px]">
                            {loading ? (
                                <div className="flex items-center justify-center h-full text-zinc-500">
                                    <RefreshCcw className="w-6 h-6 animate-spin" />
                                </div>
                            ) : statusData.length === 0 ? (
                                <div className="flex items-center justify-center p-8 text-zinc-500">
                                    No data found.
                                </div>
                            ) : (
                                <div className="divide-y divide-zinc-800/50">
                                    {statusData.map((item) => (
                                        <div key={item.ticker} className="grid grid-cols-4 p-3 text-sm hover:bg-zinc-900/40 transition-colors items-center">
                                            <div className="font-bold text-zinc-200">{item.ticker}</div>
                                            <div className="font-mono text-zinc-400">{item.last_scraped}</div>
                                            <div className="font-mono text-zinc-400">{item.total_records.toLocaleString()}</div>
                                            <div>
                                                <Badge variant="outline" className={cn("text-[10px] uppercase", getStatusColor(item.last_scraped))}>
                                                    {item.last_scraped === new Date().toISOString().split('T')[0] ? "Up to Date" : "Outdated"}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
