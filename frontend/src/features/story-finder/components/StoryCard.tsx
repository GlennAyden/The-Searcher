'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HighlightedText } from './HighlightedText';
import type { StoryItem } from '../types';

type StoryCardProps = {
    story: StoryItem;
};

export function StoryCard({ story }: StoryCardProps) {
    const getSentimentStyle = (label: string) => {
        switch (label) {
            case 'Bullish':
                return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            case 'Bearish':
                return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
            default:
                return 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50';
        }
    };

    const getSourceStyle = (source: string) => {
        switch (source) {
            case 'CNBC':
                return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case 'EmitenNews':
                return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
            case 'IDX':
                return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
            case 'Bisnis.com':
                return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            case 'Investor.id':
                return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
            default:
                return 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50';
        }
    };

    return (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-all group">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            {story.primary_icon} {story.primary_category.toUpperCase()}
                        </span>
                        <span className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-bold border',
                            getSentimentStyle(story.sentiment_label)
                        )}>
                            {story.sentiment_label}
                        </span>
                        <span className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-bold border',
                            getSourceStyle(story.source)
                        )}>
                            {story.source}
                        </span>
                    </div>

                    <h3 className="text-sm text-zinc-200 font-medium leading-relaxed mb-2">
                        <HighlightedText text={story.title} positions={story.highlight_positions} />
                    </h3>

                    <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                        <span className="font-bold text-blue-400">{story.ticker}</span>
                        <span>|</span>
                        <span>{story.date_display}</span>
                    </div>
                </div>

                <a
                    href={story.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-zinc-800 text-zinc-500 hover:text-blue-400 hover:bg-zinc-700 transition-all shrink-0"
                >
                    <ExternalLink className="w-4 h-4" />
                </a>
            </div>
        </div>
    );
}
