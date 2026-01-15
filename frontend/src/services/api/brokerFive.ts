/**
 * Broker 5% API client
 */
import { API_BASE_URL, handleResponse } from './base';

export interface BrokerFiveItem {
    id: number;
    ticker: string;
    broker_code: string;
    label?: string | null;
    created_at?: string;
    updated_at?: string;
}

export const brokerFiveApi = {
    getBrokerFiveList: async (ticker: string): Promise<{ items: BrokerFiveItem[] }> => {
        const response = await fetch(`${API_BASE_URL}/api/broker-five?ticker=${encodeURIComponent(ticker)}`);
        return await handleResponse(response, { items: [] });
    },

    createBrokerFive: async (payload: { ticker: string; broker_code: string; label?: string | null }): Promise<{ item: BrokerFiveItem }> => {
        const response = await fetch(`${API_BASE_URL}/api/broker-five`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || errorData.error || 'Failed to create broker code');
        }
        return await response.json();
    },

    updateBrokerFive: async (id: number, payload: { ticker: string; broker_code: string; label?: string | null }): Promise<{ item: BrokerFiveItem }> => {
        const response = await fetch(`${API_BASE_URL}/api/broker-five/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || errorData.error || 'Failed to update broker code');
        }
        return await response.json();
    },

    deleteBrokerFive: async (id: number, ticker: string): Promise<{ deleted: boolean }> => {
        const response = await fetch(`${API_BASE_URL}/api/broker-five/${id}?ticker=${encodeURIComponent(ticker)}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || errorData.error || 'Failed to delete broker code');
        }
        return await response.json();
    }
};
