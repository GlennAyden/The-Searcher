/**
 * Done Detail API Service
 * 
 * API methods for Done Detail feature - paste-based trade data analysis
 */
import { API_BASE_URL } from './base';

export interface DoneDetailRecord {
    id: number;
    ticker: string;
    trade_date: string;
    trade_time: string;
    board: string;
    price: number;
    qty: number;
    buyer_type: string;
    buyer_code: string;
    seller_code: string;
    seller_type: string;
}

export interface SavedHistory {
    ticker: string;
    trade_date: string;
    record_count: number;
    created_at: string;
}

export interface SankeyNode {
    name: string;
    type: 'seller' | 'buyer';
}

export interface SankeyLink {
    source: number;
    target: number;
    value: number;
    lot: number;
    val: number;
}

export interface SankeyData {
    nodes: SankeyNode[];
    links: SankeyLink[];
}

export interface InventoryData {
    brokers: string[];
    timeSeries: Array<{ time: string;[broker: string]: string | number }>;
    priceData: Array<{ time: string; price: number }>;
}

export const doneDetailApi = {
    /**
     * Check if data exists for ticker and date
     */
    checkExists: async (ticker: string, tradeDate: string): Promise<{ exists: boolean }> => {
        const response = await fetch(`${API_BASE_URL}/api/done-detail/exists/${ticker}/${tradeDate}`);
        return await response.json();
    },

    /**
     * Save pasted trade data
     */
    saveData: async (ticker: string, tradeDate: string, data: string): Promise<{ success: boolean; records_saved: number }> => {
        const response = await fetch(`${API_BASE_URL}/api/done-detail/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ticker,
                trade_date: tradeDate,
                data
            })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to save data');
        }
        return await response.json();
    },

    /**
     * Get trade records for ticker and date
     */
    getData: async (ticker: string, tradeDate: string): Promise<{ records: DoneDetailRecord[]; count: number }> => {
        const response = await fetch(`${API_BASE_URL}/api/done-detail/data/${ticker}/${tradeDate}`);
        return await response.json();
    },

    /**
     * Get all saved history
     */
    getHistory: async (): Promise<{ history: SavedHistory[] }> => {
        const response = await fetch(`${API_BASE_URL}/api/done-detail/history`);
        return await response.json();
    },

    /**
     * Delete records for ticker and date
     */
    deleteData: async (ticker: string, tradeDate: string): Promise<{ success: boolean }> => {
        const response = await fetch(`${API_BASE_URL}/api/done-detail/${ticker}/${tradeDate}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to delete data');
        }
        return await response.json();
    },

    /**
     * Get Sankey diagram data
     */
    getSankeyData: async (ticker: string, tradeDate: string): Promise<SankeyData> => {
        const response = await fetch(`${API_BASE_URL}/api/done-detail/sankey/${ticker}/${tradeDate}`);
        return await response.json();
    },

    /**
     * Get Daily Inventory chart data
     */
    getInventoryData: async (ticker: string, tradeDate: string, interval: number = 1): Promise<InventoryData> => {
        const response = await fetch(`${API_BASE_URL}/api/done-detail/inventory/${ticker}/${tradeDate}?interval=${interval}`);
        return await response.json();
    }
};
