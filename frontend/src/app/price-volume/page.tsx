'use client';

import React from 'react';
import { PriceVolumeHeader } from '@/features/price-volume/components/PriceVolumeHeader';
import { PriceVolumeRefreshBanner } from '@/features/price-volume/components/PriceVolumeRefreshBanner';
import { PriceVolumeSearch } from '@/features/price-volume/components/PriceVolumeSearch';
import { MarketCapStats } from '@/features/price-volume/components/MarketCapStats';
import { PriceVolumeChartPanel } from '@/features/price-volume/components/PriceVolumeChartPanel';
import { HKAnalysisPanel } from '@/features/price-volume/components/HKAnalysisPanel';
import { UnusualVolumeSection } from '@/features/price-volume/components/UnusualVolumeSection';
import { usePriceVolumeData } from '@/features/price-volume/hooks/usePriceVolumeData';

export default function PriceVolumePage() {
    const {
        ticker,
        searchInput,
        chartData,
        isLoading,
        error,
        suggestions,
        showSuggestions,
        unusualVolumes,
        isLoadingUnusual,
        spikeMarkers,
        marketCapData,
        isRefreshing,
        refreshResult,
        showRefreshResult,
        hkAnalysis,
        isLoadingHK,
        setShowSuggestions,
        setShowRefreshResult,
        handleRefreshAll,
        handleInputChange,
        handleSubmit,
        handleSuggestionClick,
        handleUnusualVolumeClick
    } = usePriceVolumeData();

    return (
        <div className="min-h-full flex flex-col gap-4 pb-6">
            <PriceVolumeHeader
                chartData={chartData}
                isRefreshing={isRefreshing}
                onRefreshAll={handleRefreshAll}
            />

            <PriceVolumeRefreshBanner
                refreshResult={refreshResult}
                show={showRefreshResult}
                onDismiss={() => setShowRefreshResult(false)}
            />

            <PriceVolumeSearch
                searchInput={searchInput}
                isLoading={isLoading}
                suggestions={suggestions}
                showSuggestions={showSuggestions}
                onInputChange={handleInputChange}
                onSubmit={handleSubmit}
                onSuggestionClick={handleSuggestionClick}
                onShowSuggestionsChange={setShowSuggestions}
            />

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex-shrink-0">
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            <MarketCapStats marketCapData={marketCapData} />

            <PriceVolumeChartPanel
                chartData={chartData}
                isLoading={isLoading}
                error={error}
                ticker={ticker}
                spikeMarkers={spikeMarkers}
                marketCapHistory={marketCapData?.history || []}
            />

            <HKAnalysisPanel
                chartData={chartData}
                hkAnalysis={hkAnalysis}
                isLoading={isLoadingHK}
            />

            <UnusualVolumeSection
                data={unusualVolumes}
                isLoading={isLoadingUnusual}
                onTickerClick={handleUnusualVolumeClick}
            />
        </div>
    );
}
