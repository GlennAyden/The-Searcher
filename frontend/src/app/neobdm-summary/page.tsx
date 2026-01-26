'use client';

import { SummaryControls } from '@/features/neobdm/summary/components/SummaryControls';
import { SummaryFooter } from '@/features/neobdm/summary/components/SummaryFooter';
import { SummaryTable } from '@/features/neobdm/summary/components/SummaryTable';
import { SummaryTitleRow } from '@/features/neobdm/summary/components/SummaryTitleRow';
import { useNeoBDMSummary } from '@/features/neobdm/summary/hooks/useNeoBDMSummary';

export default function NeoBDMSummaryPage() {
    const {
        method,
        setMethod,
        period,
        setPeriod,
        loading,
        scrapedAt,
        error,
        filters,
        handleFilterChange,
        isBatchLoading,
        availableDates,
        selectedDate,
        setSelectedDate,
        sortConfig,
        handleSort,
        currentPage,
        setCurrentPage,
        totalPages,
        allColumns,
        paginatedData,
        processedData,
        analysisTitle,
        handleBatchSync
    } = useNeoBDMSummary();

    return (
        <div className="flex flex-col gap-0 p-0 min-h-screen bg-[#0f1115] text-zinc-100 font-mono">
            <SummaryControls
                method={method}
                period={period}
                availableDates={availableDates}
                selectedDate={selectedDate}
                scrapedAt={scrapedAt}
                loading={loading}
                isBatchLoading={isBatchLoading}
                onMethodChange={setMethod}
                onPeriodChange={setPeriod}
                onDateChange={setSelectedDate}
                onBatchSync={handleBatchSync}
            />

            <SummaryTitleRow
                title={analysisTitle}
                period={period}
                recordCount={processedData.length}
            />

            <SummaryTable
                allColumns={allColumns}
                paginatedData={paginatedData}
                filters={filters}
                sortConfig={sortConfig}
                loading={loading}
                isBatchLoading={isBatchLoading}
                onSort={handleSort}
                onFilterChange={handleFilterChange}
            />

            <SummaryFooter
                paginatedCount={paginatedData.length}
                totalCount={processedData.length}
                error={error}
                currentPage={currentPage}
                totalPages={totalPages}
                onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))}
                onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            />
        </div>
    );
}
