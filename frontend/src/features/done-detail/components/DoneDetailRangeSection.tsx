'use client';

import React from 'react';
import { BattleTimelineChartV2 } from './BattleTimelineChartV2';
import { BattleTimelineSummary } from './BattleTimelineSummary';
import { DetailedImposterTrades } from './DetailedImposterTrades';
import { GhostBrokerRanking } from './GhostBrokerRanking';
import { ImposterRecurrenceHeatmap } from './ImposterRecurrenceHeatmap';
import { RangeSummaryCards } from './RangeSummaryCards';
import { RetailCapitulationMonitor } from './RetailCapitulationMonitor';
import type { ImposterAnalysis, RangeAnalysis } from '@/services/api/doneDetail';

type DoneDetailRangeSectionProps = {
    rangeData: RangeAnalysis;
    analysisData: ImposterAnalysis | null;
    onSelectBroker: (broker: string) => void;
};

export function DoneDetailRangeSection({
    rangeData,
    analysisData,
    onSelectBroker
}: DoneDetailRangeSectionProps) {
    return (
        <div className="space-y-6">
            {!rangeData.summary || !rangeData.retail_capitulation || !rangeData.imposter_recurrence || !rangeData.battle_timeline ? (
                <div className="text-center py-8">
                    <div className="text-red-400 text-sm mb-2">âš ï¸ Incomplete Range Analysis Data</div>
                    <div className="text-slate-500 text-xs">
                        {rangeData.error || 'Some required data is missing. Please try refreshing or selecting a different date range.'}
                    </div>
                </div>
            ) : (
                <>
                    <RangeSummaryCards summary={rangeData.summary} />

                    <div>
                        <div className="text-sm text-orange-400 mb-3 font-bold flex items-center gap-2">
                            ðŸ“Š Section 1: Retail Capitulation Monitor
                            <span className="text-xs text-slate-500 font-normal">(50% Rule)</span>
                        </div>
                        <RetailCapitulationMonitor
                            brokers={rangeData.retail_capitulation.brokers}
                            overallPct={rangeData.retail_capitulation.overall_pct}
                            safeCount={rangeData.retail_capitulation.safe_count}
                            holdingCount={rangeData.retail_capitulation.holding_count}
                        />
                    </div>

                    <div>
                        <div className="text-sm text-purple-400 mb-3 font-bold flex items-center gap-2">
                            ðŸ” Section 2: Imposter Recurrence Analysis
                            <span className="text-xs text-slate-500 font-normal">(Ghost Broker Detection)</span>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <ImposterRecurrenceHeatmap
                                brokers={rangeData.imposter_recurrence.brokers}
                                allDates={rangeData.battle_timeline.map(d => d.date)}
                            />

                            <GhostBrokerRanking
                                brokers={rangeData.imposter_recurrence.brokers}
                                onBrokerClick={onSelectBroker}
                            />
                        </div>
                    </div>

                    <div>
                        <div className="text-sm text-blue-400 mb-3 font-bold flex items-center gap-2">
                            âš”ï¸ Section 3: Battle Timeline
                            <span className="text-xs text-slate-500 font-normal">(Daily Smart Money Activity)</span>
                        </div>
                        <BattleTimelineSummary
                            summary={rangeData.summary}
                            timeline={rangeData.battle_timeline}
                        />
                        <BattleTimelineChartV2
                            data={rangeData.battle_timeline}
                            summary={rangeData.summary}
                            height={400}
                        />
                    </div>

                    {analysisData && analysisData.imposter_trades.length > 0 && (
                        <DetailedImposterTrades
                            trades={analysisData.imposter_trades}
                            onBrokerClick={onSelectBroker}
                        />
                    )}
                </>
            )}
        </div>
    );
}
