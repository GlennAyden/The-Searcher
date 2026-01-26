'use client';

import React from 'react';
import { Search, TrendingUp } from 'lucide-react';

export function StoryFinderHeader() {
    return (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <span className="p-2 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg shadow-lg shadow-orange-900/20">
                    <Search className="w-5 h-5" />
                </span>
                STORY FINDER
            </h1>

            <div className="flex items-center gap-2 text-sm text-zinc-500">
                <TrendingUp className="w-4 h-4" />
                <span>Track Corporate Actions</span>
            </div>
        </div>
    );
}
