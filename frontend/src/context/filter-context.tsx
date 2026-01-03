'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

type DateRange = {
    start: string;
    end: string;
};

interface FilterContextType {
    ticker: string;
    setTicker: (ticker: string) => void;
    dateRange: DateRange;
    setDateRange: (range: DateRange) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider = ({ children }: { children: ReactNode }) => {
    // Default: 'All' triggers no filter or ^JKSE depending on page logic
    const [ticker, setTicker] = useState('All');

    // Default: Last 30 days, ending EXACTLY today in local time
    const [dateRange, setDateRange] = useState<DateRange>(() => {
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);

        // helper to get YYYY-MM-DD in local time
        const toLocalDateString = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        return {
            start: toLocalDateString(thirtyDaysAgo),
            end: toLocalDateString(today)
        };
    });

    return (
        <FilterContext.Provider value={{ ticker, setTicker, dateRange, setDateRange }}>
            {children}
        </FilterContext.Provider>
    );
};

export const useFilter = () => {
    const context = useContext(FilterContext);
    if (!context) {
        throw new Error('useFilter must be used within a FilterProvider');
    }
    return context;
};
