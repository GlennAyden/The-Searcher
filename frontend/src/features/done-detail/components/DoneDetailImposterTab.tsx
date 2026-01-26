'use client';

import React from 'react';
import { AlertTriangle, ArrowDown, ArrowRightLeft, ArrowUp, Check, Filter, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BrokerDivergingBars } from './BrokerDivergingBars';
import { formatLot, formatRupiah } from '../utils';
import type { ImposterAnalysis } from '@/services/api/doneDetail';
import type { ColumnFilters, DivergingBarRow, SortConfig } from '../types';

type DoneDetailImposterTabProps = {
    analysisData: ImposterAnalysis;
    divergingBarData: DivergingBarRow[];
    displayedTrades: ImposterAnalysis['all_trades'];
    filters: ColumnFilters;
    onFiltersChange: React.Dispatch<React.SetStateAction<ColumnFilters>>;
    sortConfig: SortConfig;
    onSortChange: React.Dispatch<React.SetStateAction<SortConfig>>;
    showFilters: boolean;
    onSelectBroker: (broker: string) => void;
};

type SortIconProps = {
    sortConfig: SortConfig;
    column: NonNullable<SortConfig>['key'];
};

function SortIcon({ sortConfig, column }: SortIconProps) {
    if (!sortConfig || sortConfig.key !== column) return <ArrowDown className="w-3 h-3 opacity-30" />;
    return sortConfig.direction === 'asc'
        ? <ArrowUp className="w-3 h-3 text-teal-400" />
        : <ArrowDown className="w-3 h-3 text-teal-400" />;
}

export function DoneDetailImposterTab({
    analysisData,
    divergingBarData,
    displayedTrades,
    filters,
    onFiltersChange,
    sortConfig,
    onSortChange,
    showFilters,
    onSelectBroker
}: DoneDetailImposterTabProps) {
    const handleSort = (key: NonNullable<SortConfig>['key']) => {
        onSortChange(prev => {
            if (prev && prev.key === key) {
                return prev.direction === 'asc' ? { key, direction: 'desc' } : null;
            }
            return { key, direction: 'asc' };
        });
    };

    const buyTrades = analysisData.imposter_trades.filter(t => t.direction === 'BUY');
    const sellTrades = analysisData.imposter_trades.filter(t => t.direction === 'SELL');
    const buyValue = buyTrades.reduce((sum, t) => sum + t.value, 0);
    const sellValue = sellTrades.reduce((sum, t) => sum + t.value, 0);
    const netValue = buyValue - sellValue;

    return (
        <div className="space-y-3">
            {analysisData.imposter_trades.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Card className="bg-gradient-to-br from-green-900/30 to-green-800/10 border-green-500/30">
                        <CardContent className="py-4 px-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-green-400 font-bold">ðŸ“ˆ BUY IMPOSTOR</span>
                                <ArrowUp className="w-4 h-4 text-green-400" />
                            </div>
                            <div className="text-2xl font-black text-green-400 mb-1">
                                {formatRupiah(buyValue)}
                            </div>
                            <div className="text-xs text-slate-400">
                                {buyTrades.length} trades
                                {' '}â€¢{' '}
                                <span className="text-red-400">
                                    {buyTrades.filter(t => t.level === 'STRONG').length}S
                                </span>
                                /
                                <span className="text-orange-400">
                                    {buyTrades.filter(t => t.level === 'POSSIBLE').length}P
                                </span>
                            </div>
                            {buyTrades.length > 0 && (
                                <div className="text-xs text-green-300 mt-1">
                                    Top: {buyTrades.reduce((max, t) => (max.value || 0) < t.value ? t : max).broker_code}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-red-900/30 to-red-800/10 border-red-500/30">
                        <CardContent className="py-4 px-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-red-400 font-bold">ðŸ“‰ SELL IMPOSTOR</span>
                                <ArrowDown className="w-4 h-4 text-red-400" />
                            </div>
                            <div className="text-2xl font-black text-red-400 mb-1">
                                {formatRupiah(sellValue)}
                            </div>
                            <div className="text-xs text-slate-400">
                                {sellTrades.length} trades
                                {' '}â€¢{' '}
                                <span className="text-red-400">
                                    {sellTrades.filter(t => t.level === 'STRONG').length}S
                                </span>
                                /
                                <span className="text-orange-400">
                                    {sellTrades.filter(t => t.level === 'POSSIBLE').length}P
                                </span>
                            </div>
                            {sellTrades.length > 0 && (
                                <div className="text-xs text-red-300 mt-1">
                                    Top: {sellTrades.reduce((max, t) => (max.value || 0) < t.value ? t : max).broker_code}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className={`${netValue > 0
                        ? 'bg-gradient-to-br from-teal-900/30 to-teal-800/10 border-teal-500/30'
                        : netValue < 0
                            ? 'bg-gradient-to-br from-purple-900/30 to-purple-800/10 border-purple-500/30'
                            : 'bg-slate-900/50 border-slate-700'
                        }`}>
                        <CardContent className="py-4 px-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-teal-400 font-bold">ðŸ’° NET FLOW</span>
                                {netValue > 0
                                    ? <TrendingUp className="w-4 h-4 text-green-400" />
                                    : netValue < 0
                                        ? <TrendingDown className="w-4 h-4 text-red-400" />
                                        : <ArrowRightLeft className="w-4 h-4 text-slate-400" />}
                            </div>
                            <div className={`text-2xl font-black mb-1 ${netValue > 0 ? 'text-green-400' : netValue < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                {(netValue >= 0 ? '+' : '') + formatRupiah(netValue)}
                            </div>
                            <div className="text-xs text-slate-400">
                                {(() => {
                                    const totalValue = buyValue + sellValue;
                                    if (totalValue === 0) return 'Neutral';
                                    const percentage = ((Math.abs(netValue) / totalValue) * 100).toFixed(1);
                                    return netValue > 0
                                        ? `${percentage}% BUY dominance`
                                        : `${percentage}% SELL dominance`;
                                })()}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {divergingBarData.length > 0 && (
                <Card className="bg-slate-900/50 border-slate-700">
                    <CardHeader className="py-2 px-4">
                        <CardTitle className="text-sm text-purple-400">ðŸ† Top Impostor Brokers (Net Flow)</CardTitle>
                    </CardHeader>
                    <CardContent className="py-2 px-4">
                        <BrokerDivergingBars
                            data={divergingBarData}
                            onBrokerClick={onSelectBroker}
                            height={500}
                        />
                    </CardContent>
                </Card>
            )}

            <Card className="bg-slate-900/80 border-slate-700">
                <CardHeader className="py-2 px-4 border-b border-slate-700">
                    <CardTitle className="text-sm flex items-center gap-2 text-teal-400">
                        <AlertTriangle className="w-4 h-4" />Imposter Trades (Top 1-5% Lot dari Broker Retail/Mixed)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {displayedTrades.length > 0 || showFilters ? (
                        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-slate-800 z-10">
                                    <tr className="border-b border-slate-700 text-slate-400">
                                        <th className="text-left py-2 px-2 cursor-pointer hover:text-white" onClick={() => handleSort('trade_time')}>
                                            <div className="flex items-center gap-1">Time <SortIcon sortConfig={sortConfig} column="trade_time" /></div>
                                        </th>
                                        <th className="text-left py-2 px-2 cursor-pointer hover:text-white" onClick={() => handleSort('seller_code')}>
                                            <div className="flex items-center gap-1">Seller <SortIcon sortConfig={sortConfig} column="seller_code" /></div>
                                        </th>
                                        <th className="text-center py-2 px-2">â†’</th>
                                        <th className="text-left py-2 px-2 cursor-pointer hover:text-white" onClick={() => handleSort('buyer_code')}>
                                            <div className="flex items-center gap-1">Buyer <SortIcon sortConfig={sortConfig} column="buyer_code" /></div>
                                        </th>
                                        <th className="text-right py-2 px-2 cursor-pointer hover:text-white" onClick={() => handleSort('qty')}>
                                            <div className="flex items-center justify-end gap-1">Lot <SortIcon sortConfig={sortConfig} column="qty" /></div>
                                        </th>
                                        <th className="text-right py-2 px-2 cursor-pointer hover:text-white" onClick={() => handleSort('price')}>
                                            <div className="flex items-center justify-end gap-1">Price <SortIcon sortConfig={sortConfig} column="price" /></div>
                                        </th>
                                        <th className="text-right py-2 px-2 cursor-pointer hover:text-white" onClick={() => handleSort('value')}>
                                            <div className="flex items-center justify-end gap-1">Value <SortIcon sortConfig={sortConfig} column="value" /></div>
                                        </th>
                                        <th className="text-center py-2 px-2">Status</th>
                                    </tr>
                                    {showFilters && (
                                        <tr className="border-b border-slate-600 bg-slate-800/80">
                                            <td className="py-1 px-1">
                                                <input
                                                    type="text"
                                                    placeholder="hh:mm"
                                                    value={filters.time}
                                                    onChange={(e) => onFiltersChange({ ...filters, time: e.target.value })}
                                                    className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-xs text-white"
                                                />
                                            </td>
                                            <td className="py-1 px-1">
                                                <input
                                                    type="text"
                                                    placeholder="Code"
                                                    value={filters.seller}
                                                    onChange={(e) => onFiltersChange({ ...filters, seller: e.target.value })}
                                                    className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-xs text-white uppercase"
                                                />
                                            </td>
                                            <td></td>
                                            <td className="py-1 px-1">
                                                <input
                                                    type="text"
                                                    placeholder="Code"
                                                    value={filters.buyer}
                                                    onChange={(e) => onFiltersChange({ ...filters, buyer: e.target.value })}
                                                    className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-xs text-white uppercase"
                                                />
                                            </td>
                                            <td className="py-1 px-1">
                                                <input
                                                    type="text"
                                                    placeholder=">1000"
                                                    value={filters.lot}
                                                    onChange={(e) => onFiltersChange({ ...filters, lot: e.target.value })}
                                                    className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-xs text-white text-right"
                                                />
                                            </td>
                                            <td className="py-1 px-1">
                                                <input
                                                    type="text"
                                                    placeholder=">1000"
                                                    value={filters.price}
                                                    onChange={(e) => onFiltersChange({ ...filters, price: e.target.value })}
                                                    className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-xs text-white text-right"
                                                />
                                            </td>
                                            <td className="py-1 px-1">
                                                <input
                                                    type="text"
                                                    placeholder=">1B"
                                                    value={filters.value}
                                                    onChange={(e) => onFiltersChange({ ...filters, value: e.target.value })}
                                                    className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-xs text-white text-right"
                                                />
                                            </td>
                                            <td></td>
                                        </tr>
                                    )}
                                </thead>
                                <tbody>
                                    {displayedTrades.map((trade, i) => (
                                        <tr key={i} className={`border-b border-slate-800 hover:bg-slate-800/50 ${trade.is_imposter ? 'bg-red-500/5' : ''}`}>
                                            <td className="py-2 px-2 text-slate-400 font-mono">{trade.trade_time}</td>
                                            <td className="py-2 px-2">
                                                <span className={`font-bold ${trade.imposter_side === 'SELL' || trade.imposter_side === 'BOTH' ? 'text-red-400' : 'text-white'}`}>
                                                    {trade.seller_code}
                                                </span>
                                            </td>
                                            <td className="py-2 px-2 text-center text-slate-600">â†’</td>
                                            <td className="py-2 px-2">
                                                <span className={`font-bold ${trade.imposter_side === 'BUY' || trade.imposter_side === 'BOTH' ? 'text-green-400' : 'text-white'}`}>
                                                    {trade.buyer_code}
                                                </span>
                                            </td>
                                            <td className="py-2 px-2 text-right font-mono text-white">{formatLot(trade.qty)}</td>
                                            <td className="py-2 px-2 text-right font-mono text-slate-300">{trade.price.toLocaleString()}</td>
                                            <td className="py-2 px-2 text-right font-mono text-teal-400">{formatRupiah(trade.value)}</td>
                                            <td className="py-2 px-2 text-center">
                                                {trade.is_imposter ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/40">
                                                        ðŸŽ­ {trade.imposter_side}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-600">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {displayedTrades.length === 0 && showFilters && (
                                <div className="text-center py-8 text-slate-400">
                                    <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No trades match your filters</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-400">
                            <Check className="w-10 h-10 mx-auto mb-2 text-green-500" />
                            <p className="font-medium">No Imposter Transactions</p>
                            <p className="text-xs mt-1">No retail/mixed broker transactions in top 5% lot size</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
