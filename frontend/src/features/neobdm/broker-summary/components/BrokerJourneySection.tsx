'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, Info, Plus, RefreshCcw, TrendingUp, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import type { BrokerSummaryRow } from '@/types/broker-summary';
import type { BrokerJourneyResponse, JourneyChartRow } from '../types';

type BrokerJourneySectionProps = {
    ticker: string;
    date: string;
    availableDates: string[];
    showAllDates: boolean;
    onToggleShowAllDates: () => void;
    onSelectDate: (value: string) => void;
    journeyStartDate: string;
    journeyEndDate: string;
    onJourneyStartDateChange: (value: string) => void;
    onJourneyEndDateChange: (value: string) => void;
    selectedBrokers: string[];
    newBrokerCode: string;
    onNewBrokerCodeChange: (value: string) => void;
    onTrackTopBrokers: () => void;
    onAddBroker: () => void;
    onRemoveBroker: (broker: string) => void;
    buyData: BrokerSummaryRow[];
    loading: boolean;
    journeyData: BrokerJourneyResponse | null;
    formatNumber: (value: unknown, digits?: number) => string;
};

export function BrokerJourneySection({
    ticker,
    date,
    availableDates,
    showAllDates,
    onToggleShowAllDates,
    onSelectDate,
    journeyStartDate,
    journeyEndDate,
    onJourneyStartDateChange,
    onJourneyEndDateChange,
    selectedBrokers,
    newBrokerCode,
    onNewBrokerCodeChange,
    onTrackTopBrokers,
    onAddBroker,
    onRemoveBroker,
    buyData,
    loading,
    journeyData,
    formatNumber
}: BrokerJourneySectionProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest px-1 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    Broker Journey : {ticker || 'Select a ticker'}
                </h2>
            </div>

            {availableDates.length > 0 && (
                <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                        <div className="text-[10px] font-bold text-zinc-600 uppercase">
                            Available Dates ({availableDates.length} days)
                        </div>
                        {availableDates.length > 15 && (
                            <button
                                onClick={onToggleShowAllDates}
                                className="text-[10px] text-blue-400 hover:text-blue-300 font-bold px-2 py-0.5 border border-blue-500/20 rounded-lg hover:bg-blue-500/10 transition-all flex items-center gap-1"
                            >
                                {showAllDates ? (
                                    <>
                                        <X className="w-3 h-3" />
                                        Show Less
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-3 h-3" />
                                        Show All ({availableDates.length})
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                    <div className={cn(
                        'flex flex-wrap gap-2 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900',
                        showAllDates ? 'max-h-40' : 'max-h-20'
                    )}>
                        {(showAllDates ? availableDates : availableDates.slice(0, 15)).map(dateVal => (
                            <button
                                key={dateVal}
                                onClick={() => onSelectDate(dateVal)}
                                className={cn(
                                    'text-[10px] px-2 py-1 rounded border font-bold transition-all',
                                    date === dateVal
                                        ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20'
                                        : 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20'
                                )}
                            >
                                {dateVal.substring(5)}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3">
                    <div className="text-[10px] font-bold text-zinc-600 uppercase">Date Range</div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-zinc-600 uppercase px-1">From</label>
                            <input
                                type="date"
                                value={journeyStartDate}
                                onChange={(e) => onJourneyStartDateChange(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-medium [color-scheme:dark]"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-zinc-600 uppercase px-1">To</label>
                            <input
                                type="date"
                                value={journeyEndDate}
                                onChange={(e) => onJourneyEndDateChange(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-medium [color-scheme:dark]"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <div className="text-[10px] font-bold text-zinc-600 uppercase">Tracked Brokers (Max 5)</div>
                        {buyData.length > 0 && selectedBrokers.length === 0 && (
                            <button
                                onClick={onTrackTopBrokers}
                                className="text-[10px] text-blue-400 hover:text-blue-300 font-black flex items-center gap-1 group"
                                title="Track top 3 buyers"
                            >
                                <Plus className="w-3 h-3 group-hover:scale-125 transition-transform" />
                                TRACK TOP 3 BUYERS
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {selectedBrokers.map((broker) => (
                            <div
                                key={broker}
                                className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1.5 rounded-full text-xs font-bold"
                            >
                                {broker}
                                <button
                                    onClick={() => onRemoveBroker(broker)}
                                    className="hover:text-white transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {selectedBrokers.length < 5 && (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={newBrokerCode}
                                onChange={(e) => onNewBrokerCodeChange(e.target.value.toUpperCase())}
                                onKeyDown={(e) => e.key === 'Enter' && onAddBroker()}
                                placeholder="Broker code (e.g., YP)"
                                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-medium flex-1"
                                maxLength={4}
                            />
                            <button
                                onClick={onAddBroker}
                                disabled={!newBrokerCode.trim()}
                                className={cn(
                                    'p-2 rounded-xl transition-colors',
                                    newBrokerCode.trim()
                                        ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20'
                                        : 'bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed'
                                )}
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="h-[500px] bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl flex items-center justify-center">
                    <RefreshCcw className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
            ) : journeyData && journeyData.brokers && journeyData.brokers.length > 0 ? (
                <div className="bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-bold text-zinc-400">Cumulative Net Position (Billion Rp)</div>
                        {journeyData.price_data && journeyData.price_data.length > 0 && (
                            <div className="text-sm font-bold text-red-400">Harga Saham (Rp)</div>
                        )}
                    </div>

                    <ResponsiveContainer width="100%" height={500}>
                        <LineChart data={(() => {
                            const allDates = new Set<string>();

                            journeyData.brokers.forEach((broker) => {
                                broker.daily_data.forEach((day) => {
                                    allDates.add(day.date);
                                });
                            });

                            if (journeyData.price_data) {
                                journeyData.price_data.forEach((p) => {
                                    allDates.add(p.date);
                                });
                            }

                            const sortedDates = Array.from(allDates).sort();

                            return sortedDates.map((dateValue) => {
                                const dataPoint = { date: dateValue } as JourneyChartRow;

                                journeyData.brokers.forEach((broker) => {
                                    const dayData = broker.daily_data.find((d) => d.date === dateValue);
                                    dataPoint[broker.broker_code] = dayData ? dayData.cumulative_net_value : null;
                                });

                                if (journeyData.price_data) {
                                    const priceEntry = journeyData.price_data.find((p) => p.date === dateValue);
                                    dataPoint['Harga'] = priceEntry ? priceEntry.close_price : null;
                                }

                                return dataPoint;
                            });
                        })()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                            <XAxis
                                dataKey="date"
                                stroke="#71717a"
                                style={{ fontSize: '11px', fontWeight: 'bold' }}
                                tickFormatter={(value) => value.substring(5)}
                            />
                            <YAxis
                                yAxisId="left"
                                stroke="#71717a"
                                style={{ fontSize: '11px', fontWeight: 'bold' }}
                                tickFormatter={(value) => value.toFixed(1)}
                            />
                            {journeyData.price_data && journeyData.price_data.length > 0 && (
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    stroke="#ef4444"
                                    style={{ fontSize: '11px', fontWeight: 'bold' }}
                                    tickFormatter={(value) => value.toLocaleString()}
                                />
                            )}
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#18181b',
                                    border: '1px solid #3f3f46',
                                    borderRadius: '8px',
                                    fontSize: '12px'
                                }}
                                formatter={(value, name) => {
                                    const isNil = value === null || value === undefined;
                                    const numericValue = typeof value === 'number' ? value : Number(value);
                                    const hasNumber = !isNil && Number.isFinite(numericValue);
                                    if (name === 'Harga') {
                                        return [hasNumber ? `Rp ${numericValue.toLocaleString()}` : '-', 'Harga Saham'];
                                    }
                                    return [hasNumber ? `${numericValue.toFixed(2)}B` : '-', name ?? ''];
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />

                            {journeyData.brokers.map((broker, idx) => {
                                const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
                                return (
                                    <Line
                                        key={broker.broker_code}
                                        yAxisId="left"
                                        dataKey={broker.broker_code}
                                        type="monotoneX"
                                        name={broker.broker_code}
                                        stroke={colors[idx % colors.length]}
                                        strokeWidth={1.5}
                                        dot={{ r: 3 }}
                                        activeDot={{ r: 5 }}
                                        connectNulls={true}
                                    />
                                );
                            })}

                            {journeyData.price_data && journeyData.price_data.length > 0 && (
                                <Line
                                    yAxisId="right"
                                    dataKey="Harga"
                                    type="monotoneX"
                                    name="Harga"
                                    stroke="#ef4444"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={{ r: 2, fill: '#ef4444' }}
                                    activeDot={{ r: 4 }}
                                    connectNulls={true}
                                />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="h-[500px] bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl flex items-center justify-center">
                    <div className="text-center space-y-2">
                        <div className="text-zinc-600 text-sm font-bold">No journey data</div>
                        <div className="text-zinc-700 text-xs">
                            {selectedBrokers.length === 0
                                ? 'Add brokers to track their journey'
                                : 'No activity found for selected brokers in this period'}
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest px-1 flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-500" />
                    Broker Statistics
                </h2>

                {journeyData && journeyData.brokers && journeyData.brokers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                        {journeyData.brokers.map((broker, idx) => {
                            const colors = [
                                { bg: 'bg-blue-500/5', border: 'border-blue-500/20', text: 'text-blue-400', badge: 'bg-blue-500' },
                                { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-400', badge: 'bg-emerald-500' },
                                { bg: 'bg-amber-500/5', border: 'border-amber-500/20', text: 'text-amber-400', badge: 'bg-amber-500' },
                                { bg: 'bg-purple-500/5', border: 'border-purple-500/20', text: 'text-purple-400', badge: 'bg-purple-500' },
                                { bg: 'bg-pink-500/5', border: 'border-pink-500/20', text: 'text-pink-400', badge: 'bg-pink-500' },
                            ];
                            const color = colors[idx % colors.length];
                            const isAccumulating = broker.summary.is_accumulating;

                            return (
                                <motion.div
                                    key={broker.broker_code}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    className={cn(
                                        'bg-[#0c0c0e] border rounded-2xl overflow-hidden shadow-lg',
                                        color.border
                                    )}
                                >
                                    <div className={cn('px-4 py-3 border-b border-zinc-800/50 flex justify-between items-center', color.bg)}>
                                        <div className="flex items-center gap-2">
                                            <div className={cn('w-2 h-2 rounded-full', color.badge)} />
                                            <span className={cn('text-sm font-black uppercase', color.text)}>
                                                {broker.broker_code}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                'text-[10px] px-2 py-0.5 rounded border font-bold',
                                                isAccumulating
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                                            )}>
                                                {isAccumulating ? 'ACCUMULATING' : 'DISTRIBUTING'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="p-4 space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <div className="text-[9px] text-zinc-600 font-bold uppercase mb-1">Buy</div>
                                                <div className="text-lg font-black text-emerald-400">
                                                    {formatNumber(broker.summary.total_buy_value, 1)}B
                                                </div>
                                                <div className="text-[10px] text-zinc-500">
                                                    {formatNumber(broker.summary.total_buy_lot)} lot
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-[9px] text-zinc-600 font-bold uppercase mb-1">Sell</div>
                                                <div className="text-lg font-black text-red-400">
                                                    {formatNumber(broker.summary.total_sell_value, 1)}B
                                                </div>
                                                <div className="text-[10px] text-zinc-500">
                                                    {formatNumber(broker.summary.total_sell_lot)} lot
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-3 border-t border-zinc-800 space-y-2">
                                            <div className="flex justify-between items-end">
                                                <div>
                                                    <div className="text-[9px] text-zinc-600 font-bold uppercase mb-1">Net Position</div>
                                                    <div className={cn(
                                                        'text-xl font-black flex items-center gap-1',
                                                        isAccumulating ? 'text-emerald-400' : 'text-red-400'
                                                    )}>
                                                        {isAccumulating ? '+' : ''}{formatNumber(broker.summary.net_value, 1)}B
                                                        {isAccumulating ? <ArrowUpRight className="w-4 h-4" /> : <TrendingUp className="w-4 h-4 rotate-180" />}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[9px] text-zinc-600 font-bold uppercase">Days Active</div>
                                                    <div className="text-lg font-black text-zinc-400">
                                                        {broker.summary.days_active}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-2 border-t border-zinc-800/50">
                                                <div className="text-[9px] text-zinc-600 font-bold uppercase mb-1">Net Lot (Holdings)</div>
                                                <div className={cn(
                                                    'text-lg font-black',
                                                    isAccumulating ? 'text-blue-400' : 'text-orange-400'
                                                )}>
                                                    {formatNumber(broker.summary.net_lot)} lot
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="h-[160px] bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl flex items-center justify-center">
                        <div className="text-center space-y-2">
                            <div className="text-zinc-600 text-sm font-bold">No broker stats available</div>
                            <div className="text-zinc-700 text-xs">
                                Select brokers and date range to see statistics.
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
