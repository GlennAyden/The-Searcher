'use client';

import { useFilter } from '@/context/filter-context';
import { DEFAULT_KEYWORDS } from '@/features/story-finder/constants';
import { StoryFinderHeader } from '@/features/story-finder/components/StoryFinderHeader';
import { StoryKeywordFilters } from '@/features/story-finder/components/StoryKeywordFilters';
import { StoryTimeline } from '@/features/story-finder/components/StoryTimeline';
import { useStoryFinder } from '@/features/story-finder/hooks/useStoryFinder';

export default function StoryFinderPage() {
    const { dateRange } = useFilter();
    const {
        data,
        loading,
        selectedKeywords,
        toggleKeyword,
        customKeyword,
        setCustomKeyword,
        addCustomKeyword,
        groupedStories,
        sortedDates
    } = useStoryFinder({
        startDate: dateRange.start,
        endDate: dateRange.end
    });

    return (
        <div className="flex flex-col gap-6 p-6 min-h-screen bg-zinc-950 text-zinc-100">
            <StoryFinderHeader />

            <StoryKeywordFilters
                keywords={DEFAULT_KEYWORDS}
                selectedKeywords={selectedKeywords}
                keywordStats={data?.keyword_stats || {}}
                customKeyword={customKeyword}
                onToggleKeyword={toggleKeyword}
                onCustomKeywordChange={setCustomKeyword}
                onAddCustomKeyword={addCustomKeyword}
            />

            {data && (
                <div className="flex items-center gap-4 text-sm">
                    <span className="text-zinc-400">
                        Found <span className="font-bold text-white">{data.total}</span> stories
                    </span>
                    <span className="text-zinc-600">|</span>
                    <span className="text-zinc-500">
                        {selectedKeywords.length} keywords active
                    </span>
                </div>
            )}

            <StoryTimeline
                loading={loading}
                sortedDates={sortedDates}
                groupedStories={groupedStories}
            />
        </div>
    );
}
