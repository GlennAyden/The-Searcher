'use client';

import React, { useState } from 'react';
import { FlowChartSection } from '@/features/neobdm/tracker/components/FlowChartSection';
import { FlowHistoryTable } from '@/features/neobdm/tracker/components/FlowHistoryTable';
import { FlowTrackerFooter } from '@/features/neobdm/tracker/components/FlowTrackerFooter';
import { FlowTrackerHeader } from '@/features/neobdm/tracker/components/FlowTrackerHeader';
import { HotSignalsSection } from '@/features/neobdm/tracker/components/HotSignalsSection';
import { SymbolSummaryCards } from '@/features/neobdm/tracker/components/SymbolSummaryCards';
import { VolumeChartSection } from '@/features/neobdm/tracker/components/VolumeChartSection';
import { useFlowTrackerData } from '@/features/neobdm/tracker/hooks/useFlowTrackerData';

export default function NeoBDMTrackerPage() {
    const [symbol, setSymbol] = useState('BBCA');
    const [limit, setLimit] = useState(30);
    const [flowMetric, setFlowMetric] = useState('flow_d0');
    const method = 'm';
    const period = 'c';

    const {
        availableTickers,
        hotSignals,
        chartData,
        loading,
        error,
        volumeData,
        volumeLoading,
        volumeError
    } = useFlowTrackerData({
        symbol,
        method,
        period,
        limit,
        flowMetric,
        onSymbolChange: setSymbol
    });

    return (
        <div className="flex flex-col gap-0 min-h-screen bg-[#0f1115] text-zinc-100 font-mono">
            <FlowTrackerHeader
                symbol={symbol}
                availableTickers={availableTickers}
                flowMetric={flowMetric}
                limit={limit}
                onSymbolChange={setSymbol}
                onFlowMetricChange={setFlowMetric}
                onLimitChange={setLimit}
            />

            <HotSignalsSection
                hotSignals={hotSignals}
                symbol={symbol}
                onSelectSymbol={setSymbol}
            />

            <div className="flex-1 p-4 flex flex-col gap-4 overflow-auto scrollbar-thin scrollbar-thumb-zinc-800">
                <SymbolSummaryCards symbol={symbol} method={method} chartData={chartData} />
                <FlowChartSection flowMetric={flowMetric} chartData={chartData} loading={loading} error={error} />
                <VolumeChartSection volumeData={volumeData} volumeLoading={volumeLoading} volumeError={volumeError} />
                <FlowHistoryTable chartData={chartData} loading={loading} />
            </div>

            <FlowTrackerFooter />
        </div>
    );
}
