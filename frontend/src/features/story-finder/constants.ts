import type { KeywordInfo } from './types';

export const DEFAULT_KEYWORDS: KeywordInfo[] = [
    { keyword: 'right issue', category: 'Equity Raise', icon: '🔄' },
    { keyword: 'akuisisi', category: 'M&A', icon: '🏢' },
    { keyword: 'merger', category: 'M&A', icon: '🔗' },
    { keyword: 'dividen', category: 'Dividend', icon: '💰' },
    { keyword: 'buyback', category: 'Buyback', icon: '💵' },
    { keyword: 'stock split', category: 'Split', icon: '📊' },
    { keyword: 'tender offer', category: 'Tender', icon: '📋' },
    { keyword: 'ipo', category: 'IPO', icon: '🚀' },
];

export const DEFAULT_SELECTED_KEYWORDS = ['right issue', 'akuisisi', 'dividen'];
