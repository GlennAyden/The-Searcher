/**
 * Utility functions for string manipulation
 */

/**
 * Cleans a stock ticker symbol by removing "Add to Watchlist" or "Remove from Watchlist" patterns
 * and any surrounding pipe characters.
 * 
 * @param symbol The raw symbol string from the API
 * @returns A cleaned ticker symbol (e.g., "BBRI")
 */
export const cleanTickerSymbol = (symbol: string): string => {
    if (!symbol) return '';

    // Remove "Add XXX to Watchlist" or "Remove from Watchlist"
    let clean = symbol.replace(/\|?Add\s+.*?to\s+Watchlist/gi, '');
    clean = clean.replace(/\|?Remove\s+from\s+Watchlist/gi, '');

    // Remove leading/trailing pipes and whitespace
    clean = clean.replace(/^\|+|\|+$/g, '').trim();

    return clean;
};
