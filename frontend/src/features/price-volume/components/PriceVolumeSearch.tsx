'use client';

import React from 'react';
import { Loader2, Search } from 'lucide-react';

type PriceVolumeSearchProps = {
    searchInput: string;
    isLoading: boolean;
    suggestions: string[];
    showSuggestions: boolean;
    onInputChange: (value: string) => void;
    onSubmit: (event: React.FormEvent) => void;
    onSuggestionClick: (suggestion: string) => void;
    onShowSuggestionsChange: (show: boolean) => void;
};

export function PriceVolumeSearch({
    searchInput,
    isLoading,
    suggestions,
    showSuggestions,
    onInputChange,
    onSubmit,
    onSuggestionClick,
    onShowSuggestionsChange
}: PriceVolumeSearchProps) {
    return (
        <div className="relative flex-shrink-0">
            <form onSubmit={onSubmit} className="relative">
                <div className="relative flex items-center">
                    <Search className="absolute left-4 w-5 h-5 text-zinc-500" />
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => onInputChange(e.target.value)}
                        onFocus={() => suggestions.length > 0 && onShowSuggestionsChange(true)}
                        onBlur={() => setTimeout(() => onShowSuggestionsChange(false), 200)}
                        placeholder="Enter ticker symbol (e.g., BBCA, ANTM, TLKM)"
                        className="w-full pl-12 pr-32 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !searchInput.trim()}
                        className="absolute right-2 px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-blue-600 text-white text-sm font-medium rounded-lg hover:from-emerald-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Loading...
                            </>
                        ) : (
                            'Analyze'
                        )}
                    </button>
                </div>
            </form>

            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden">
                    {suggestions.map((suggestion) => (
                        <button
                            key={suggestion}
                            onClick={() => onSuggestionClick(suggestion)}
                            className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
