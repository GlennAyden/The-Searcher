type NumericLike = number | undefined | null;

export const formatRupiah = (value: NumericLike): string => {
    if (value === undefined || value === null) return 'Rp 0';
    if (value >= 1e12) return `Rp ${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `Rp ${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `Rp ${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `Rp ${(value / 1e3).toFixed(0)}K`;
    return `Rp ${value.toFixed(0)}`;
};

export const formatLot = (value: NumericLike): string => {
    if (value === undefined || value === null) return '0';
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return `${value.toLocaleString()}`;
};

export const parseFilterExpr = (expr: string): ((value: number) => boolean) | null => {
    if (!expr.trim()) return null;
    const trimmed = expr.trim();

    const rangeMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
    if (rangeMatch) {
        const min = parseFloat(rangeMatch[1]);
        const max = parseFloat(rangeMatch[2]);
        return (v) => v >= min && v <= max;
    }

    const opMatch = trimmed.match(/^(>=|<=|>|<|=)\s*(\d+(?:\.\d+)?[KMBkmb]?)$/);
    if (opMatch) {
        const op = opMatch[1];
        let numStr = opMatch[2].toUpperCase();
        let multiplier = 1;
        if (numStr.endsWith('K')) { multiplier = 1e3; numStr = numStr.slice(0, -1); }
        else if (numStr.endsWith('M')) { multiplier = 1e6; numStr = numStr.slice(0, -1); }
        else if (numStr.endsWith('B')) { multiplier = 1e9; numStr = numStr.slice(0, -1); }
        const num = parseFloat(numStr) * multiplier;

        switch (op) {
            case '>=': return (v) => v >= num;
            case '<=': return (v) => v <= num;
            case '>': return (v) => v > num;
            case '<': return (v) => v < num;
            case '=': return (v) => v === num;
            default: return null;
        }
    }

    const plainNum = parseFloat(trimmed);
    if (!isNaN(plainNum)) {
        return (v) => v === plainNum;
    }

    return null;
};

export const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string' && error.trim()) return error;
    return fallback;
};
