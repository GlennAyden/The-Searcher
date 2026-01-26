export type SortConfig = {
    key: 'trade_time' | 'seller_code' | 'buyer_code' | 'qty' | 'price' | 'value';
    direction: 'asc' | 'desc';
} | null;

export type ColumnFilters = {
    time: string;
    seller: string;
    buyer: string;
    lot: string;
    price: string;
    value: string;
};

export type DivergingBarRow = {
    broker: string;
    name: string;
    total_value: number;
    buy_value: number;
    sell_value: number;
    net_value: number;
};
