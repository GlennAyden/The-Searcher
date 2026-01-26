import { useCallback, useEffect, useMemo, useState } from 'react';
import { storyFinderService } from '../services/story-finder-service';
import { DEFAULT_SELECTED_KEYWORDS } from '../constants';
import type { StoryFinderResponse, StoryItem } from '../types';

type UseStoryFinderProps = {
    startDate: string;
    endDate: string;
};

export const useStoryFinder = ({ startDate, endDate }: UseStoryFinderProps) => {
    const [selectedKeywords, setSelectedKeywords] = useState<string[]>(DEFAULT_SELECTED_KEYWORDS);
    const [data, setData] = useState<StoryFinderResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [customKeyword, setCustomKeyword] = useState('');

    const fetchStories = useCallback(async () => {
        if (selectedKeywords.length === 0) {
            setData({ stories: [], keyword_stats: {}, total: 0 });
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const result = await storyFinderService.getStories({
                keywords: selectedKeywords,
                startDate,
                endDate
            });
            setData(result);
        } catch (error) {
            console.error('Story Finder fetch error:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedKeywords, startDate, endDate]);

    useEffect(() => {
        fetchStories();
    }, [fetchStories]);

    const toggleKeyword = (keyword: string) => {
        setSelectedKeywords((prev) =>
            prev.includes(keyword)
                ? prev.filter((k) => k !== keyword)
                : [...prev, keyword]
        );
    };

    const addCustomKeyword = () => {
        const kw = customKeyword.trim().toLowerCase();
        if (kw && !selectedKeywords.includes(kw)) {
            setSelectedKeywords((prev) => [...prev, kw]);
            setCustomKeyword('');
        }
    };

    const groupedStories = useMemo<Record<string, StoryItem[]>>(() => {
        if (!data?.stories) return {};

        const groups: Record<string, StoryItem[]> = {};
        data.stories.forEach((story) => {
            const date = story.date;
            if (!groups[date]) groups[date] = [];
            groups[date].push(story);
        });
        return groups;
    }, [data?.stories]);

    const sortedDates = useMemo(() => {
        return Object.keys(groupedStories).sort((a, b) => b.localeCompare(a));
    }, [groupedStories]);

    return {
        data,
        loading,
        selectedKeywords,
        toggleKeyword,
        customKeyword,
        setCustomKeyword,
        addCustomKeyword,
        groupedStories,
        sortedDates
    };
};
