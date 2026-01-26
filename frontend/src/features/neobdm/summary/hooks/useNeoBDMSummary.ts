import { useCallback, useEffect, useMemo, useState } from 'react';
import { neobdmSummaryService } from '../services/neobdm-summary-service';
import type { SummaryFilters, SummaryRow, SortConfig } from '../types';

const evaluateFilter = (cellValue: unknown, filterExpr: string): boolean => {
    if (!filterExpr) return true;

    const cellStr = String(cellValue || '').trim();
    const filterStr = filterExpr.trim();

    if (filterStr.includes('&')) {
        const conditions = filterStr.split('&').map(s => s.trim());
        return conditions.every(cond => evaluateFilter(cellValue, cond));
    }

    const match = filterStr.match(/^(>=|<=|>|<|=)(.+)$/);

    if (match) {
        const operator = match[1];
        const targetVal = match[2].trim();

        const cellNum = parseFloat(cellStr.replace(/,/g, ''));
        const targetNum = parseFloat(targetVal.replace(/,/g, ''));

        if (!isNaN(cellNum) && !isNaN(targetNum)) {
            switch (operator) {
                case '>': return cellNum > targetNum;
                case '<': return cellNum < targetNum;
                case '>=': return cellNum >= targetNum;
                case '<=': return cellNum <= targetNum;
                case '=': return cellNum === targetNum;
            }
        }

        if (operator === '=') {
            return cellStr.toLowerCase() === targetVal.toLowerCase();
        }
    }

    return cellStr.toLowerCase().includes(filterStr.toLowerCase());
};

const getAnalysisTitle = (method: string) => {
    const labels: Record<string, string> = {
        m: 'Market Maker Analysis',
        nr: 'Non-Retail Flow',
        f: 'Foreign Flow Analysis'
    };
    return labels[method] || 'Market Analysis';
};

export const useNeoBDMSummary = () => {
    const [method, setMethod] = useState('m');
    const [period, setPeriod] = useState('d');
    const [loading, setLoading] = useState(false);
    const [scrapedAt, setScrapedAt] = useState<string | null>(null);
    const [data, setData] = useState<SummaryRow[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<SummaryFilters>({});
    const [isBatchLoading, setIsBatchLoading] = useState(false);
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);
    const [currentPage, setCurrentPage] = useState(1);

    const pageSize = 50;

    useEffect(() => {
        const fetchDates = async () => {
            try {
                const json = await neobdmSummaryService.getDates();
                if (json.dates && json.dates.length > 0) {
                    setAvailableDates(json.dates);
                }
            } catch (e) {
                console.error('Failed to fetch dates', e);
            }
        };
        fetchDates();
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await neobdmSummaryService.getSummary(method, period, selectedDate || undefined);
            setData(result.data as SummaryRow[]);
            setScrapedAt(result.scraped_at);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to load NeoBDM summary';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [method, period, selectedDate]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleBatchSync = useCallback(async () => {
        setIsBatchLoading(true);
        setError(null);
        try {
            const result = await neobdmSummaryService.runBatchSync();
            if (result.status === 'success') {
                const dateJson = await neobdmSummaryService.getDates();
                if (dateJson.dates) setAvailableDates(dateJson.dates);
                loadData();
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Batch sync failed';
            setError(message);
        } finally {
            setIsBatchLoading(false);
        }
    }, [loadData]);

    const handleFilterChange = (col: string, val: string) => {
        setFilters(prev => ({ ...prev, [col]: val }));
    };

    const handleSort = (key: string) => {
        if (sortConfig?.key === key) {
            if (sortConfig.direction === 'asc') {
                setSortConfig({ key, direction: 'desc' });
            } else {
                setSortConfig(null);
            }
        } else {
            setSortConfig({ key, direction: 'asc' });
        }
    };

    const allColumns = useMemo(() => {
        if (data.length === 0) return [];
        const availableKeys = Object.keys(data[0]);

        const dailyOrder = [
            'symbol', 'pinky', 'crossing', 'unusual', 'likuid',
            'w-4', 'w-3', 'w-2', 'w-1',
            'd-4', 'd-3', 'd-2', 'd-0',
            '%1d', 'price', '>ma5', '>ma10', '>ma20', '>ma50', '>ma100'
        ];

        const cumulativeOrder = [
            'symbol', 'pinky', 'crossing', 'unusual', 'likuid',
            'c-20', 'c-10', 'c-5', 'c-3',
            '%3d', '%5d', '%10d', '%20d',
            'price', '>ma5', '>ma10', '>ma20', '>ma50', '>ma100'
        ];

        const targetOrder = period === 'd' ? dailyOrder : cumulativeOrder;

        return targetOrder.filter(targetCol =>
            availableKeys.some(key => key.toLowerCase() === targetCol.toLowerCase())
        ).map(targetCol => {
            const actualKey = availableKeys.find(key => key.toLowerCase() === targetCol.toLowerCase());
            return actualKey || targetCol;
        });
    }, [data, period]);

    const processedData = useMemo(() => {
        const result = data.filter(row => {
            return Object.entries(filters).every(([col, val]) => {
                if (!val) return true;
                return evaluateFilter(row[col], val);
            });
        });

        if (sortConfig) {
            result.sort((a, b) => {
                const valA = a[sortConfig.key];
                const valB = b[sortConfig.key];

                const numA = parseFloat(String(valA).replace(/,/g, ''));
                const numB = parseFloat(String(valB).replace(/,/g, ''));

                if (!isNaN(numA) && !isNaN(numB)) {
                    return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
                }

                const strA = String(valA || '').toLowerCase();
                const strB = String(valB || '').toLowerCase();
                if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            const flowKey = period === 'd' ? 'd-0' : 'c-3';
            result.sort((a, b) => {
                const flowA = parseFloat(String(a[flowKey] || '0').replace(/,/g, ''));
                const flowB = parseFloat(String(b[flowKey] || '0').replace(/,/g, ''));
                return flowB - flowA;
            });
        }
        return result;
    }, [data, filters, sortConfig, period]);

    const totalPages = Math.ceil(processedData.length / pageSize);

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return processedData.slice(start, start + pageSize);
    }, [processedData, currentPage, pageSize]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filters, method, period, selectedDate]);

    return {
        method,
        setMethod,
        period,
        setPeriod,
        loading,
        scrapedAt,
        data,
        error,
        filters,
        handleFilterChange,
        isBatchLoading,
        availableDates,
        selectedDate,
        setSelectedDate,
        sortConfig,
        handleSort,
        currentPage,
        setCurrentPage,
        totalPages,
        pageSize,
        allColumns,
        paginatedData,
        processedData,
        analysisTitle: getAnalysisTitle(method),
        handleBatchSync
    };
};
