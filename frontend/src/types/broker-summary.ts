export type BrokerSummaryRow = {
    broker: string;
    nval: number;
    nlot?: number;
    avg_price?: number;
    [key: string]: string | number | null | undefined;
};
