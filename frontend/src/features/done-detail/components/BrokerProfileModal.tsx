import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Loader2, ArrowUp, ArrowDown, DollarSign, Activity, Users, Clock } from "lucide-react";
import { doneDetailApi, BrokerProfile } from '@/services/api/doneDetail';

interface BrokerProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticker: string;
    brokerCode: string;
    startDate: string;
    endDate: string;
}

const formatRupiah = (value: number) => {
    if (Math.abs(value) >= 1_000_000_000) {
        return `Rp${(value / 1_000_000_000).toFixed(1)}B`;
    }
    if (Math.abs(value) >= 1_000_000) {
        return `Rp${(value / 1_000_000).toFixed(0)}M`;
    }
    return `Rp${value.toLocaleString()}`;
};

export const BrokerProfileModal: React.FC<BrokerProfileModalProps> = ({
    isOpen, onClose, ticker, brokerCode, startDate, endDate
}) => {
    const [profile, setProfile] = useState<BrokerProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadProfile = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await doneDetailApi.getBrokerProfile(ticker, brokerCode, startDate, endDate);
            setProfile(data);
        } catch (err: unknown) {
            const message = err instanceof Error && err.message ? err.message : 'Failed to load profile';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [ticker, brokerCode, startDate, endDate]);

    useEffect(() => {
        if (isOpen && brokerCode) {
            loadProfile();
        }
    }, [isOpen, brokerCode, loadProfile]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden bg-slate-950 border border-slate-800 rounded-xl relative shadow-2xl flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl font-black text-white shadow-lg">
                            {brokerCode}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                {profile?.name || brokerCode}
                                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-xs font-mono">
                                    {ticker}
                                </span>
                            </h2>
                            <div className="text-sm text-slate-400">
                                Trade Analysis • {startDate} to {endDate}
                            </div>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-800 text-slate-400">
                        <X className="w-6 h-6" />
                    </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64">
                            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                            <p className="text-slate-400">Analyzing Broker Activity...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-20 text-red-400 bg-red-900/10 rounded-lg">
                            <p>{error}</p>
                            <Button variant="outline" onClick={loadProfile} className="mt-4 border-red-500/30 text-red-400 hover:bg-red-900/20">Retry</Button>
                        </div>
                    ) : profile && (
                        <>
                            {/* Summary Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <Card className="bg-slate-900/50 border-slate-800">
                                    <div className="p-4">
                                        <div className="text-xs text-slate-500 text-center mb-1">NET VALUE</div>
                                        <div className={`text-2xl font-black text-center ${profile.summary.net_value > 0 ? 'text-green-400' : profile.summary.net_value < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                            {formatRupiah(profile.summary.net_value)}
                                        </div>
                                        <div className="text-xs text-center mt-2 flex justify-center gap-2">
                                            <span className="text-green-400 flex items-center"><ArrowUp className="w-3 h-3" /> Buy</span>
                                            <span className="text-slate-600">|</span>
                                            <span className="text-red-400 flex items-center"><ArrowDown className="w-3 h-3" /> Sell</span>
                                        </div>
                                    </div>
                                </Card>
                                <Card className="bg-slate-900/50 border-slate-800">
                                    <div className="p-4">
                                        <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3" /> TOTAL BUY</div>
                                        <div className="text-xl font-bold text-green-400">{formatRupiah(profile.summary.buy_value)}</div>
                                        <div className="text-xs text-slate-400 mt-1">
                                            Freq: {profile.summary.buy_freq.toLocaleString()}x
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5">
                                            Avg: {profile.summary.avg_buy_price.toLocaleString()}
                                        </div>
                                    </div>
                                </Card>
                                <Card className="bg-slate-900/50 border-slate-800">
                                    <div className="p-4">
                                        <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3" /> TOTAL SELL</div>
                                        <div className="text-xl font-bold text-red-400">{formatRupiah(profile.summary.sell_value)}</div>
                                        <div className="text-xs text-slate-400 mt-1">
                                            Freq: {profile.summary.sell_freq.toLocaleString()}x
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5">
                                            Avg: {profile.summary.avg_sell_price.toLocaleString()}
                                        </div>
                                    </div>
                                </Card>
                                <Card className="bg-slate-900/50 border-slate-800">
                                    <div className="p-4 flex flex-col justify-center h-full">
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-green-400">Buy</span>
                                            <span className="text-red-400">Sell</span>
                                        </div>
                                        <div className="h-4 bg-slate-800 rounded-full overflow-hidden flex">
                                            <div
                                                className="bg-green-500 h-full transition-all duration-500"
                                                style={{ width: `${(profile.summary.buy_freq / (profile.summary.buy_freq + profile.summary.sell_freq)) * 100}%` }}
                                            />
                                            <div
                                                className="bg-red-500 h-full transition-all duration-500"
                                                style={{ width: `${(profile.summary.sell_freq / (profile.summary.buy_freq + profile.summary.sell_freq)) * 100}%` }}
                                            />
                                        </div>
                                        <div className="text-center text-xs text-slate-500 mt-2">
                                            Activity Balance
                                        </div>
                                    </div>
                                </Card>
                            </div>

                            {/* Charts Row */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Hourly Activity */}
                                <Card className="bg-slate-900/50 border-slate-800">
                                    <CardHeader className="py-3 px-4 border-b border-slate-800">
                                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-indigo-400">
                                            <Clock className="w-4 h-4" /> Hourly Activity
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 pt-6">
                                        <div className="h-48 flex items-end justify-between gap-1 overflow-x-auto">
                                            {profile.hourly_stats.map((stat, i) => {
                                                const maxVal = Math.max(...profile.hourly_stats.map(s => s.buy_val + s.sell_val));
                                                const buyH = maxVal > 0 ? (stat.buy_val / maxVal) * 100 : 0;
                                                const sellH = maxVal > 0 ? (stat.sell_val / maxVal) * 100 : 0;

                                                return (
                                                    <div key={i} className="flex flex-col items-center gap-1 group w-full min-w-[20px]">
                                                        <div className="w-full bg-slate-800 rounded-t overflow-hidden relative flex flex-col-reverse justify-start" style={{ height: '150px' }}>
                                                            <div className="w-full bg-green-500/80 hover:bg-green-400 transition-colors" style={{ height: `${buyH}%` }} title={`Buy: ${formatRupiah(stat.buy_val)}`} />
                                                            <div className="w-full bg-red-500/80 hover:bg-red-400 transition-colors" style={{ height: `${sellH}%` }} title={`Sell: ${formatRupiah(stat.sell_val)}`} />
                                                        </div>
                                                        <span className="text-[10px] text-slate-500 font-mono">{stat.hour}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Counterparties */}
                                <Card className="bg-slate-900/50 border-slate-800">
                                    <CardHeader className="py-3 px-4 border-b border-slate-800">
                                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-purple-400">
                                            <Users className="w-4 h-4" /> Top Counterparties
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <div className="text-xs text-slate-500 mb-2 uppercase font-bold">Bought From (Sellers)</div>
                                                <div className="space-y-2">
                                                    {profile.counterparties.top_sellers.map((cp, i) => (
                                                        <div key={i} className="flex justify-between items-center text-xs p-2 bg-slate-800/50 rounded border border-slate-700">
                                                            <span className="font-bold text-slate-300">{cp.broker}</span>
                                                            <span className="text-red-400">{formatRupiah(cp.value)}</span>
                                                        </div>
                                                    ))}
                                                    {profile.counterparties.top_sellers.length === 0 && <div className="text-xs text-slate-600 italic">No data</div>}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-slate-500 mb-2 uppercase font-bold">Sold To (Buyers)</div>
                                                <div className="space-y-2">
                                                    {profile.counterparties.top_buyers.map((cp, i) => (
                                                        <div key={i} className="flex justify-between items-center text-xs p-2 bg-slate-800/50 rounded border border-slate-700">
                                                            <span className="font-bold text-slate-300">{cp.broker}</span>
                                                            <span className="text-green-400">{formatRupiah(cp.value)}</span>
                                                        </div>
                                                    ))}
                                                    {profile.counterparties.top_buyers.length === 0 && <div className="text-xs text-slate-600 italic">No data</div>}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Recent Transactions */}
                            <Card className="bg-slate-900/50 border-slate-800">
                                <CardHeader className="py-3 px-4 border-b border-slate-800">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-300">
                                        <Activity className="w-4 h-4" /> Significant Trades (Top 50 by Value)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                                        <table className="w-full text-xs">
                                            <thead className="sticky top-0 bg-slate-800 z-10 text-slate-400">
                                                <tr>
                                                    <th className="py-2 px-3 text-left">Time</th>
                                                    <th className="py-2 px-3 text-left">Action</th>
                                                    <th className="py-2 px-3 text-right">Price</th>
                                                    <th className="py-2 px-3 text-right">Lot</th>
                                                    <th className="py-2 px-3 text-right">Value</th>
                                                    <th className="py-2 px-3 text-left">Counterparty</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {profile.recent_trades.map((trade, i) => (
                                                    <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/50">
                                                        <td className="py-2 px-3 font-mono text-slate-500">{trade.time}</td>
                                                        <td className="py-2 px-3">
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${trade.action === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                                {trade.action}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-3 text-right text-slate-300">{trade.price.toLocaleString()}</td>
                                                        <td className="py-2 px-3 text-right font-mono text-slate-500">{trade.qty.toLocaleString()}</td>
                                                        <td className="py-2 px-3 text-right font-mono text-white">{formatRupiah(trade.value)}</td>
                                                        <td className="py-2 px-3 font-bold text-slate-400">{trade.counterparty}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
