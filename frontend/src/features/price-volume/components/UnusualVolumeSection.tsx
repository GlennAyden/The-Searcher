'use client';

import React from 'react';
import type { UnusualVolumeEvent } from '@/services/api/priceVolume';
import { UnusualVolumeList } from './UnusualVolumeList';

type UnusualVolumeSectionProps = {
    data: UnusualVolumeEvent[];
    isLoading: boolean;
    onTickerClick: (ticker: string) => void;
};

export function UnusualVolumeSection({ data, isLoading, onTickerClick }: UnusualVolumeSectionProps) {
    return (
        <div className="flex-shrink-0">
            <UnusualVolumeList
                data={data}
                isLoading={isLoading}
                onTickerClick={onTickerClick}
            />
        </div>
    );
}
