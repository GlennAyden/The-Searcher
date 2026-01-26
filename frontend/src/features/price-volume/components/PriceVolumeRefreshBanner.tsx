'use client';

import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { RefreshAllResponse } from '@/services/api/priceVolume';

type PriceVolumeRefreshBannerProps = {
    refreshResult: RefreshAllResponse | null;
    show: boolean;
    onDismiss: () => void;
};

export function PriceVolumeRefreshBanner({ refreshResult, show, onDismiss }: PriceVolumeRefreshBannerProps) {
    if (!show || !refreshResult) return null;

    return (
        <div className={`flex items-center justify-between p-3 rounded-xl border ${refreshResult.errors.length > 0
            ? 'bg-amber-500/10 border-amber-500/20'
            : 'bg-emerald-500/10 border-emerald-500/20'
            }`}>
            <div className="flex items-center gap-3">
                {refreshResult.errors.length > 0 ? (
                    <AlertCircle className="w-5 h-5 text-amber-400" />
                ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                )}
                <div>
                    <p className="text-sm font-medium text-zinc-100">
                        Refresh Complete
                    </p>
                    <p className="text-xs text-zinc-400">
                        {refreshResult.tickers_updated} of {refreshResult.tickers_processed} tickers updated â€¢
                        {refreshResult.total_records_added} records added
                        {refreshResult.errors.length > 0 && (
                            <span className="text-amber-400 ml-1">
                                â€¢ {refreshResult.errors.length} errors
                            </span>
                        )}
                    </p>
                </div>
            </div>
            <button
                onClick={onDismiss}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
            >
                Dismiss
            </button>
        </div>
    );
}
