'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Activity,
    AlertTriangle,
    ArrowRightLeft,
    Calendar,
    Clipboard,
    Filter,
    Loader2,
    X
} from 'lucide-react';
import { doneDetailApi } from '@/services/api/doneDetail';
import { DoneDetailHeader } from './DoneDetailHeader';
import { BrokerProfileModal } from './BrokerProfileModal';
import { ImposterTreeMap } from './ImposterTreeMap';
import { DoneDetailPasteModal } from './DoneDetailPasteModal';
import { DoneDetailOverviewTab } from './DoneDetailOverviewTab';
import { DoneDetailImposterTab } from './DoneDetailImposterTab';
import { DoneDetailSpeedTab } from './DoneDetailSpeedTab';
import { DoneDetailRangeSection } from './DoneDetailRangeSection';
import { useDoneDetailData } from '../hooks/useDoneDetailData';
import { formatLot, getErrorMessage, parseFilterExpr } from '../utils';
import type { ColumnFilters, DivergingBarRow, SortConfig } from '../types';

interface DoneDetailSectionProps {
    ticker: string;
}

export function DoneDetailSection({ ticker }: DoneDetailSectionProps) {
    const {
        availableTickers,
        selectedTicker,
        setSelectedTicker,
        dateRangeInfo,
        dateMode,
        setDateMode,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        loading,
        message,
        setMessage,
        analysisData,
        speedData,
        combinedData,
        rangeData,
        loadTickers,
        loadDateRange,
        loadData
    } = useDoneDetailData(ticker);

    const [saving, setSaving] = useState(false);
    const [showPasteModal, setShowPasteModal] = useState(false);
    const [pasteData, setPasteData] = useState('');
    const [pasteTickerInput, setPasteTickerInput] = useState('');
    const [pasteDateInput, setPasteDateInput] = useState('');

    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<ColumnFilters>({ time: '', seller: '', buyer: '', lot: '', price: '', value: '' });
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);

    const [activeTab, setActiveTab] = useState<'overview' | 'imposter' | 'speed' | 'range'>('overview');
    const [selectedBroker, setSelectedBroker] = useState<string | null>(null);
    const [selectedSpeedBrokers, setSelectedSpeedBrokers] = useState<string[]>([]);

    const handleSave = async () => {
        if (!pasteTickerInput || !pasteDateInput || !pasteData) {
            setMessage({ type: 'error', text: 'Please fill ticker, date, and paste data' });
            return;
        }
        setSaving(true);
        try {
            const result = await doneDetailApi.saveData(pasteTickerInput, pasteDateInput, pasteData);
            if (result.success) {
                setMessage({ type: 'success', text: `Saved ${result.records_saved} records` });
                setShowPasteModal(false);
                setPasteData('');
                setPasteTickerInput('');
                setPasteDateInput('');
                await loadTickers();
                setSelectedTicker(pasteTickerInput.toUpperCase());
                setStartDate(pasteDateInput);
                setEndDate(pasteDateInput);
            }
        } catch (error: unknown) {
            setMessage({ type: 'error', text: getErrorMessage(error, 'Failed to save data') });
        } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!selectedTicker || !startDate) return;
        if (!confirm(`Delete data for ${selectedTicker} on ${startDate}?`)) return;
        try {
            await doneDetailApi.deleteData(selectedTicker, startDate);
            setMessage({ type: 'success', text: 'Data deleted' });
            await loadTickers();
            await loadDateRange(selectedTicker);
        } catch {
            setMessage({ type: 'error', text: 'Failed to delete data' });
        }
    };

    const handlePasteFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setPasteData(text);
        } catch {
            setMessage({ type: 'error', text: 'Please allow clipboard access' });
        }
    };

    const clearFilters = () => {
        setFilters({ time: '', seller: '', buyer: '', lot: '', price: '', value: '' });
        setSortConfig(null);
    };

    useEffect(() => {
        if (message) {
            const t = setTimeout(() => setMessage(null), 3000);
            return () => clearTimeout(t);
        }
    }, [message, setMessage]);

    const treeMapData = useMemo(() => {
        if (!analysisData) return [];

        const brokerNetCalcs = new Map<string, number>();

        analysisData.imposter_trades.forEach(t => {
            const current = brokerNetCalcs.get(t.broker_code) || 0;
            if (t.direction === 'BUY') {
                brokerNetCalcs.set(t.broker_code, current + t.value);
            } else {
                brokerNetCalcs.set(t.broker_code, current - t.value);
            }
        });

        return analysisData.by_broker.map(b => ({
            broker: b.broker,
            total_value: b.total_value,
            net_value: brokerNetCalcs.get(b.broker) || 0,
            strong_count: b.strong_count,
            possible_count: b.possible_count
        }));
    }, [analysisData]);

    const divergingBarData = useMemo<DivergingBarRow[]>(() => {
        if (!analysisData) return [];

        const brokerStats = new Map<string, { buy: number, sell: number }>();

        analysisData.imposter_trades.forEach(t => {
            const current = brokerStats.get(t.broker_code) || { buy: 0, sell: 0 };
            if (t.direction === 'BUY') {
                current.buy += t.value;
            } else {
                current.sell += t.value;
            }
            brokerStats.set(t.broker_code, current);
        });

        return analysisData.by_broker.map(b => {
            const stats = brokerStats.get(b.broker) || { buy: 0, sell: 0 };
            return {
                broker: b.broker,
                name: b.name,
                total_value: b.total_value,
                buy_value: stats.buy,
                sell_value: stats.sell,
                net_value: stats.buy - stats.sell
            };
        });
    }, [analysisData]);

    const imposterSparklineData = useMemo(() => {
        if (!analysisData?.imposter_trades) return [];

        const grouped = new Map<string, number>();
        analysisData.imposter_trades.forEach(t => {
            const timeKey = t.trade_time.substring(0, 5);
            grouped.set(timeKey, (grouped.get(timeKey) || 0) + 1);
        });

        return Array.from(grouped.entries())
            .map(([time, count]) => ({ time, count }))
            .sort((a, b) => a.time.localeCompare(b.time));
    }, [analysisData]);

    const speedTreemapData = useMemo(() => {
        if (!speedData?.speed_by_broker) return [];

        return speedData.speed_by_broker
            .filter(b => b.total_trades > 0)
            .map(b => ({
                name: b.broker,
                broker_name: b.name,
                size: b.total_trades,
                tps: b.trades_per_second,
                value: b.total_value
            }))
            .sort((a, b) => b.size - a.size);
    }, [speedData]);

    const displayedSpeedTimeline = useMemo(() => {
        if (!speedData?.timeline) return [];

        if (selectedSpeedBrokers.length === 0) {
            return speedData.timeline;
        }

        const combinedTimelineMap = new Map<string, number>();

        selectedSpeedBrokers.forEach(broker => {
            const brokerTimeline = speedData.broker_timelines?.[broker];
            if (brokerTimeline) {
                brokerTimeline.forEach((point) => {
                    const current = combinedTimelineMap.get(point.time) || 0;
                    combinedTimelineMap.set(point.time, current + point.trades);
                });
            }
        });

        return Array.from(combinedTimelineMap.entries())
            .map(([time, trades]) => ({ time, trades }))
            .sort((a, b) => a.time.localeCompare(b.time));

    }, [speedData, selectedSpeedBrokers]);

    const displayedTrades = useMemo(() => {
        if (!analysisData?.all_trades) return [];

        let trades = analysisData.all_trades.filter(t => t.is_imposter);

        if (filters.time) {
            const f = filters.time.toLowerCase();
            trades = trades.filter(t => t.trade_time.toLowerCase().includes(f));
        }
        if (filters.seller) {
            const f = filters.seller.toUpperCase();
            trades = trades.filter(t => t.seller_code.toUpperCase().includes(f));
        }
        if (filters.buyer) {
            const f = filters.buyer.toUpperCase();
            trades = trades.filter(t => t.buyer_code.toUpperCase().includes(f));
        }
        if (filters.lot) {
            const filterFn = parseFilterExpr(filters.lot);
            if (filterFn) trades = trades.filter(t => filterFn(t.qty));
        }
        if (filters.price) {
            const filterFn = parseFilterExpr(filters.price);
            if (filterFn) trades = trades.filter(t => filterFn(t.price));
        }
        if (filters.value) {
            const filterFn = parseFilterExpr(filters.value);
            if (filterFn) trades = trades.filter(t => filterFn(t.value));
        }

        if (sortConfig) {
            trades.sort((a, b) => {
                const aVal = a[sortConfig.key];
                const bVal = b[sortConfig.key];

                if (typeof aVal === 'string' && typeof bVal === 'string') {
                    return sortConfig.direction === 'asc'
                        ? aVal.localeCompare(bVal)
                        : bVal.localeCompare(aVal);
                }

                const aNum = typeof aVal === 'number' ? aVal : Number(aVal);
                const bNum = typeof bVal === 'number' ? bVal : Number(bVal);
                return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
            });
        }

        return trades;
    }, [analysisData, filters, sortConfig]);

    const hasActiveFilters = Object.values(filters).some(f => f) || sortConfig !== null;

    const isRangeMode = dateMode === 'range' && startDate !== endDate && rangeData !== null;

    return (
        <div className="space-y-3">
            <DoneDetailHeader
                availableTickers={availableTickers}
                selectedTicker={selectedTicker}
                onSelectTicker={setSelectedTicker}
                dateRangeInfo={dateRangeInfo}
                dateMode={dateMode}
                onDateModeChange={setDateMode}
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onOpenPaste={() => setShowPasteModal(true)}
                onRefresh={loadData}
                onDelete={handleDelete}
                loading={loading}
                analysisData={analysisData}
                message={message}
            />

            {loading ? (
                <div className="flex items-center justify-center h-80"><Loader2 className="w-6 h-6 animate-spin text-teal-400" /></div>
            ) : analysisData ? (
                <div className="space-y-3">
                    {!isRangeMode && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <Card className="bg-slate-900/50 border-slate-700">
                                <CardContent className="py-3 px-4 text-center">
                                    <div className="text-2xl font-black text-white">{analysisData.total_transactions.toLocaleString()}</div>
                                    <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
                                        <Activity className="w-3 h-3" />Total Transaksi
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-slate-900/50 border-slate-700">
                                <CardContent className="py-3 px-4 text-center">
                                    <div className="text-2xl font-black text-teal-400">{formatLot(analysisData.summary.total_lot)}</div>
                                    <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
                                        <ArrowRightLeft className="w-3 h-3" />Total Lot
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className={`${analysisData.imposter_count > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-900/50 border-slate-700'}`}>
                                <CardContent className="py-3 px-4 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <span className="text-lg font-black text-red-500">{analysisData.summary.strong_count || 0}</span>
                                        <span className="text-slate-500">/</span>
                                        <span className="text-lg font-black text-orange-400">{analysisData.summary.possible_count || 0}</span>
                                    </div>
                                    <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />Strong/Possible
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className={`${analysisData.summary.imposter_percentage > 5 ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-900/50 border-slate-700'}`}>
                                <CardContent className="py-3 px-4 text-center">
                                    <div className="text-xs text-slate-500 mb-1">
                                        P95: {analysisData.thresholds?.p95 || 0} | P99: {analysisData.thresholds?.p99 || 0} lot
                                    </div>
                                    <div className="text-xl font-black text-orange-400">{analysisData.summary.imposter_percentage.toFixed(1)}%</div>
                                    <div className="text-xs text-slate-400">Imposter Value %</div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {!isRangeMode && analysisData.by_broker.length > 0 && (
                        <div className="mb-4">
                            <div className="text-xs text-slate-500 mb-2">Imposter Brokers Distribution:</div>
                            <ImposterTreeMap data={treeMapData} />
                        </div>
                    )}

                    {!isRangeMode && (
                        <div className="flex items-center gap-1 border-b border-slate-700 pb-1">
                            {([
                                { id: 'overview', label: '📊 Overview' },
                                { id: 'imposter', label: '🎭 Imposter' },
                                { id: 'speed', label: '⚡ Speed' }
                            ] as const).map((tab) => (
                                <button key={tab.id}
                                    className={`px-3 py-1.5 text-xs rounded-t ${activeTab === tab.id
                                        ? 'bg-slate-800 text-teal-400 border border-b-0 border-slate-600'
                                        : 'text-slate-500 hover:text-slate-300'}`}
                                    onClick={() => setActiveTab(tab.id)}
                                >{tab.label}</button>
                            ))}

                            <div className="ml-auto flex items-center gap-2">
                                {hasActiveFilters && (
                                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-xs text-slate-400 hover:text-white">
                                        <X className="w-3 h-3 mr-1" />Clear
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`h-6 text-xs ${showFilters ? 'border-teal-500 text-teal-400' : 'border-slate-600 text-slate-400'}`}
                                >
                                    <Filter className="w-3 h-3 mr-1" />Filter
                                </Button>
                            </div>
                        </div>
                    )}

                    {isRangeMode && (
                        <div className="flex items-center justify-between border-b border-purple-500/30 pb-2 mb-4">
                            <div className="flex items-center gap-3">
                                <div className="text-lg font-bold text-purple-400">📈 Range Analysis</div>
                                <span className="text-xs text-slate-500">
                                    {rangeData?.summary?.total_days ?? 0} days: {startDate} → {endDate}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                {hasActiveFilters && (
                                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-xs text-slate-400 hover:text-white">
                                        <X className="w-3 h-3 mr-1" />Clear
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`h-6 text-xs ${showFilters ? 'border-teal-500 text-teal-400' : 'border-slate-600 text-slate-400'}`}
                                >
                                    <Filter className="w-3 h-3 mr-1" />Filter
                                </Button>
                            </div>
                        </div>
                    )}

                    {!isRangeMode && activeTab === 'overview' && combinedData && (
                        <DoneDetailOverviewTab
                            combinedData={combinedData}
                            imposterSparklineData={imposterSparklineData}
                            onSelectBroker={(broker) => setSelectedBroker(broker)}
                            onSelectTab={(tab) => setActiveTab(tab)}
                        />
                    )}

                    {!isRangeMode && activeTab === 'imposter' && (
                        <DoneDetailImposterTab
                            analysisData={analysisData}
                            divergingBarData={divergingBarData}
                            displayedTrades={displayedTrades}
                            filters={filters}
                            onFiltersChange={setFilters}
                            sortConfig={sortConfig}
                            onSortChange={setSortConfig}
                            showFilters={showFilters}
                            onSelectBroker={(broker) => setSelectedBroker(broker)}
                        />
                    )}

                    {!isRangeMode && activeTab === 'speed' && speedData && (
                        <DoneDetailSpeedTab
                            speedData={speedData}
                            selectedSpeedBrokers={selectedSpeedBrokers}
                            onSelectedSpeedBrokersChange={setSelectedSpeedBrokers}
                            displayedSpeedTimeline={displayedSpeedTimeline}
                            speedTreemapData={speedTreemapData}
                            onSelectBroker={(broker) => setSelectedBroker(broker)}
                        />
                    )}

                    {isRangeMode && rangeData && (
                        <DoneDetailRangeSection
                            rangeData={rangeData}
                            analysisData={analysisData}
                            onSelectBroker={(broker) => setSelectedBroker(broker)}
                        />
                    )}
                </div>
            ) : availableTickers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                    <Clipboard className="w-10 h-10 mb-2 text-slate-600" />
                    <p className="text-sm">No Done Detail data yet</p>
                    <p className="text-xs text-slate-500 mt-1">Click &quot;Paste New&quot; to add data</p>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                    <Calendar className="w-10 h-10 mb-2 text-slate-600" />
                    <p className="text-sm">Select a date to view analysis</p>
                </div>
            )}

            <BrokerProfileModal
                isOpen={!!selectedBroker}
                onClose={() => setSelectedBroker(null)}
                ticker={selectedTicker}
                brokerCode={selectedBroker || ''}
                startDate={startDate}
                endDate={endDate}
            />

            <DoneDetailPasteModal
                open={showPasteModal}
                saving={saving}
                pasteTickerInput={pasteTickerInput}
                pasteDateInput={pasteDateInput}
                pasteData={pasteData}
                onClose={() => setShowPasteModal(false)}
                onPasteTickerChange={setPasteTickerInput}
                onPasteDateChange={setPasteDateInput}
                onPasteDataChange={setPasteData}
                onPasteFromClipboard={handlePasteFromClipboard}
                onSave={handleSave}
            />
        </div>
    );
}
