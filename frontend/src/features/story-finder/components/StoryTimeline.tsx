'use client';

import React from 'react';
import { Loader2, Search } from 'lucide-react';
import { StoryCard } from './StoryCard';
import type { StoryItem } from '../types';

type StoryTimelineProps = {
    loading: boolean;
    sortedDates: string[];
    groupedStories: Record<string, StoryItem[]>;
};

export function StoryTimeline({ loading, sortedDates, groupedStories }: StoryTimelineProps) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="ml-3 text-zinc-500 text-sm">Searching stories...</span>
            </div>
        );
    }

    if (sortedDates.length === 0) {
        return (
            <div className="text-center py-20 text-zinc-600">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>No stories found matching your keywords.</p>
                <p className="text-sm mt-2">Try selecting different keywords or adjusting the date range.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {sortedDates.map((date) => (
                <div key={date}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wide">
                            {new Date(date).toLocaleDateString('id-ID', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                            })}
                        </h2>
                        <span className="text-[10px] text-zinc-600 font-mono">
                            {groupedStories[date].length} stories
                        </span>
                        <div className="flex-1 h-px bg-zinc-800" />
                    </div>

                    <div className="space-y-3 ml-6 border-l-2 border-zinc-800 pl-6">
                        {groupedStories[date].map((story) => (
                            <StoryCard key={story.id} story={story} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
