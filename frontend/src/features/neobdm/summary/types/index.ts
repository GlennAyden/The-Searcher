export type SummaryRow = Record<string, string | number | null>;

export type SortConfig = {
    key: string;
    direction: 'asc' | 'desc';
} | null;

export type SummaryFilters = Record<string, string>;
