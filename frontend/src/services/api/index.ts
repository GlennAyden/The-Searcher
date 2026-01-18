/**
 * Modular API Clients Export
 * 
 * Centralized export for all domain-specific API clients
 */

export * from './base';
export * from './dashboard';
export * from './news';
export * from './disclosures';
export * from './neobdm';
export * from './brokerFive';
export * from './doneDetail';

export * from './forecasting';

// Re-export for convenience
import { dashboardApi } from './dashboard';
import { newsApi } from './news';
import { disclosuresApi } from './disclosures';
import { neobdmApi } from './neobdm';
import { scrapersApi } from './scrapers';
import { forecastingApi } from './forecasting';
import { brokerFiveApi } from './brokerFive';
import { doneDetailApi } from './doneDetail';

const api = {
    ...dashboardApi,
    ...newsApi,
    ...disclosuresApi,
    ...neobdmApi,
    ...scrapersApi,
    ...forecastingApi,
    ...brokerFiveApi,
    ...doneDetailApi
};

export {
    dashboardApi,
    newsApi,
    disclosuresApi,
    neobdmApi,
    scrapersApi,
    forecastingApi,
    brokerFiveApi,
    doneDetailApi,
    api
};
