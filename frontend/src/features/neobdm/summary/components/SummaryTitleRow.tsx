'use client';

import React from 'react';

type SummaryTitleRowProps = {
    title: string;
    period: string;
    recordCount: number;
};

export function SummaryTitleRow({ title, period, recordCount }: SummaryTitleRowProps) {
    return (
        <div className="bg-[#181a1f] border-b border-zinc-800 px-4 py-1 flex items-center justify-between">
            <h2 className="text-zinc-100 text-[14px] font-bold tracking-tight">
                {title} <span className="text-zinc-500 font-normal">|</span>{' '}
                <span className="text-blue-400">{period === 'c' ? 'Cumulative' : 'Daily'}</span>
            </h2>
            <div className="text-[10px] text-zinc-600 italic">
                {recordCount} records found
            </div>
        </div>
    );
}
