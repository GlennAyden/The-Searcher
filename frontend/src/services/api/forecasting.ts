import { API_BASE_URL, buildParams } from './base';

export const forecastingApi = {
    /**
     * Get detailed forecast and trade plan for a symbol
     */
    getForecast: async (symbol: string) => {
        try {
            // Encode symbol to handle special characters if any
            const encodedSymbol = encodeURIComponent(symbol);
            const response = await fetch(`${API_BASE_URL}/api/forecast/${encodedSymbol}`);

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || `Failed to fetch forecast: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching forecast:', error);
            throw error;
        }
    }
};
