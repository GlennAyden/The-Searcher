'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    Newspaper,
    MessageSquare,
    TrendingUp,
    ChevronLeft,
    ChevronRight,
    Filter,
    Activity,
    LineChart,
    BarChart3,
    PieChart,
    Zap,
    History,
    Search
} from 'lucide-react';
import { ScraperControl } from './scraper-control';
import { api } from '@/services/api';
import { useFilter } from '@/context/filter-context';

const navGroups = [
    {
        title: 'Core',
        items: [
            { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
            { icon: Newspaper, label: 'News Library', href: '/news-library' },
        ]
    },
    {
        title: 'NeoBDM Analysis',
        items: [
            { icon: BarChart3, label: 'Market Summary', href: '/neobdm-summary' },
            { icon: LineChart, label: 'Flow Tracker', href: '/neobdm-tracker' },
        ]
    },
    {
        title: 'Real-Time Trading',
        items: [
            { icon: Activity, label: 'Live Tape', href: '/running-trade' },
            { icon: History, label: 'RT History', href: '/running-trade/analysis' },
        ]
    },
    {
        title: 'Intelligence',
        items: [
            { icon: MessageSquare, label: 'RAG Chat', href: '/rag-chat' },
        ]
    }
];

export const Sidebar = () => {
    const [isCollapsed, setIsCollapsed] = React.useState(false);
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const currentTab = searchParams.get('tab');
    const { ticker, setTicker, dateRange, setDateRange } = useFilter();

    // Dynamic Tickers state
    const [tickers, setTickers] = React.useState<string[]>(['All']);

    React.useEffect(() => {
        const loadTickers = async () => {
            try {
                const list = await api.getTickers();
                // Ensure 'All' is always first and unique
                const uniqueTickers = Array.from(new Set(['All', ...list]));
                setTickers(uniqueTickers);
            } catch (error) {
                console.error("Failed to load tickers for sidebar:", error);
            }
        };
        loadTickers();
    }, []);

    return (
        <div className={cn(
            "h-full bg-[#09090b] border-r border-zinc-800/40 flex flex-col p-3 gap-4 transition-all duration-300 relative",
            isCollapsed ? "w-16" : "w-64"
        )}>
            {/* Toggle Button */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-3 top-10 bg-zinc-800 border border-zinc-700 rounded-full p-1 text-zinc-400 hover:text-white hover:bg-zinc-700 shadow-lg z-50"
            >
                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>

            <div className={cn("flex items-center gap-2 px-2 py-4 overflow-hidden whitespace-nowrap")}>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-emerald-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
                    <TrendingUp className="w-5 h-5 text-white" />
                </div>
                {!isCollapsed && (
                    <span className="text-lg font-black tracking-tighter text-zinc-100 italic animate-in fade-in duration-500">ANTIGRAVITY</span>
                )}
            </div>

            {/* Global Filters */}
            {!isCollapsed ? (
                <div className="space-y-4 px-2 py-3 bg-zinc-900/40 rounded-xl border border-zinc-800/50 animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="flex items-center gap-2 text-zinc-400 text-[9px] font-black uppercase tracking-[0.2em]">
                        <Filter className="w-3 h-3 text-blue-500" />
                        Market Scope
                    </div>

                    <div className="space-y-1.5">
                        <select
                            value={ticker}
                            onChange={(e) => setTicker(e.target.value)}
                            className="w-full bg-[#18181b] border border-zinc-800 text-zinc-200 text-xs font-bold rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-blue-500/50 appearance-none cursor-pointer"
                        >
                            {tickers.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="text-[9px] text-zinc-500 font-bold uppercase ml-1">From</label>
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                className="w-full bg-[#18181b] border border-zinc-800 text-zinc-200 text-[10px] rounded-lg p-2 outline-none [color-scheme:dark] cursor-pointer"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] text-zinc-500 font-bold uppercase ml-1">To</label>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                className="w-full bg-[#18181b] border border-zinc-800 text-zinc-200 text-[10px] rounded-lg p-2 outline-none [color-scheme:dark] cursor-pointer"
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="px-1 py-2 flex justify-center">
                    <button
                        onClick={() => setIsCollapsed(false)}
                        className="p-2.5 bg-zinc-900 rounded-xl text-zinc-500 hover:text-blue-400 border border-zinc-800 transition-all active:scale-95"
                        title="Expand Filters"
                    >
                        <Filter className="w-4 h-4" />
                    </button>
                </div>
            )}

            <div className="flex-1 flex flex-col gap-6 overflow-y-auto overflow-x-hidden scrollbar-none px-1">
                {navGroups.map((group) => (
                    <div key={group.title} className="space-y-1.5">
                        {!isCollapsed && (
                            <div className="px-3 mb-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest opacity-60">
                                {group.title}
                            </div>
                        )}
                        <div className="flex flex-col gap-0.5">
                            {group.items.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        title={isCollapsed ? item.label : undefined}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2 rounded-lg transition-all whitespace-nowrap border border-transparent group",
                                            isActive
                                                ? "bg-blue-500/10 text-blue-400 border-blue-500/20 font-bold shadow-sm"
                                                : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                                        )}
                                    >
                                        <item.icon className={cn(
                                            "w-5 h-5 shrink-0 transition-transform group-hover:scale-110",
                                            isActive ? "text-blue-500" : "text-zinc-500 group-hover:text-zinc-300"
                                        )} />
                                        {!isCollapsed && (
                                            <span className="text-xs animate-in fade-in slide-in-from-left-2 duration-300 tracking-tight">
                                                {item.label}
                                            </span>
                                        )}
                                        {!isCollapsed && isActive && (
                                            <div className="ml-auto w-1 h-3 rounded-full bg-blue-500 animate-in fade-in duration-500" />
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <ScraperControl isCollapsed={isCollapsed} />

            <div className={cn(
                "px-2 py-4 text-[10px] text-zinc-600 border-t border-zinc-900 overflow-hidden whitespace-nowrap transition-opacity",
                isCollapsed && "opacity-0 invisible"
            )}>
                v1.0.0 Alpha
            </div>
        </div>
    );
};
