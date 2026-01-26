import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    Cell
} from 'recharts';

interface BrokerDivergingBarsProps {
    data: Array<{
        broker: string;
        net_value: number;
        total_value: number;
        buy_value?: number;
        sell_value?: number;
        name?: string;
    }>;
    height?: number;
    onBrokerClick?: (broker: string) => void;
}

type BrokerDivergingBarItem = BrokerDivergingBarsProps['data'][number];

type BrokerDivergingTooltipProps = {
    active?: boolean;
    payload?: Array<{ payload: BrokerDivergingBarItem }>;
    label?: string;
};

const formatRupiah = (value: number): string => {
    const absValue = Math.abs(value);
    if (absValue >= 1e12) return `Rp ${(value / 1e12).toFixed(2)}T`;
    if (absValue >= 1e9) return `Rp ${(value / 1e9).toFixed(2)}B`;
    if (absValue >= 1e6) return `Rp ${(value / 1e6).toFixed(1)}M`;
    if (absValue >= 1e3) return `Rp ${(value / 1e3).toFixed(0)}K`;
    return `Rp ${value.toFixed(0)}`;
};

const CustomTooltip = ({ active, payload }: BrokerDivergingTooltipProps) => {
    if (active && payload && payload.length) {
        const data = payload[0]?.payload;
        if (!data) return null;
        return (
            <div className="bg-slate-900 border border-slate-700 p-3 rounded shadow-xl text-xs z-50">
                <p className="font-bold text-white mb-1">{data.broker} - {data.name}</p>
                <div className="space-y-1">
                    <p className="text-green-400">Buy: {formatRupiah(data.buy_value || 0)}</p>
                    <p className="text-red-400">Sell: {formatRupiah(data.sell_value || 0)}</p>
                    <div className="border-t border-slate-700 my-1 pt-1">
                        <p className={`font-bold ${data.net_value >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                            Net: {formatRupiah(data.net_value)}
                        </p>
                    </div>
                    <p className="text-slate-500">Total: {formatRupiah(data.total_value)}</p>
                </div>
            </div>
        );
    }
    return null;
};

export const BrokerDivergingBars: React.FC<BrokerDivergingBarsProps> = ({
    data,
    height = 400,
    onBrokerClick
}) => {
    // Sort by absolute net value to show biggest movers (accumulators or distributors)
    const sortedData = [...data].sort((a, b) => Math.abs(b.net_value) - Math.abs(a.net_value)).slice(0, 15);

    return (
        <div style={{ width: '100%', height: height }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    layout="vertical"
                    data={sortedData}
                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    stackOffset="sign"
                >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.3} />
                    <XAxis
                        type="number"
                        hide
                    />
                    <YAxis
                        dataKey="broker"
                        type="category"
                        width={40}
                        tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}
                        interval={0}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff10' }} />
                    <ReferenceLine x={0} stroke="#475569" strokeWidth={2} />
                    <Bar
                        dataKey="net_value"
                        radius={[2, 2, 2, 2]}
                        cursor="pointer"
                        className="transition-opacity hover:opacity-80"
                        onClick={((data: BrokerDivergingBarItem) => onBrokerClick && data?.broker && onBrokerClick(data.broker)) as never}
                    >
                        {sortedData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.net_value >= 0 ? '#14b8a6' : '#ef4444'}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
