import React from 'react';
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    ReferenceLine,
    LabelList,
    ZAxis
} from 'recharts';

interface SpeedScatterPlotProps {
    data: Array<{
        broker: string;
        name: string;
        trades: number; // x: Frequency
        value: number;  // y: Value
        net_value: number; // for color
        tps: number;
    }>;
    height?: number;
    onBrokerClick?: (broker: string) => void;
}

const formatRupiah = (value: number): string => {
    const absValue = Math.abs(value);
    if (absValue >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
    if (absValue >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (absValue >= 1e6) return `${(value / 1e6).toFixed(0)}M`;
    if (absValue >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return `${value.toFixed(0)}`;
};

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-slate-900 border border-slate-700 p-3 rounded shadow-xl text-xs z-50">
                <p className="font-bold text-white text-sm mb-1">{data.broker}</p>
                <p className="text-slate-400 mb-2">{data.name}</p>
                <div className="space-y-1">
                    <div className="flex justify-between gap-4">
                        <span className="text-slate-500">TPS:</span>
                        <span className="font-bold text-yellow-400">{data.tps} /sec</span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span className="text-slate-500">Trades:</span>
                        <span className="font-bold text-white">{data.trades.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span className="text-slate-500">Total Val:</span>
                        <span className="font-bold text-teal-400">{formatRupiah(data.value)}</span>
                    </div>
                    <div className="border-t border-slate-700 pt-1 mt-1 flex justify-between gap-4">
                        <span className="text-slate-500">Net Flow:</span>
                        <span className={`font-bold ${data.net_value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatRupiah(data.net_value)}
                        </span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

export const SpeedScatterPlot: React.FC<SpeedScatterPlotProps> = ({
    data,
    height = 400,
    onBrokerClick
}) => {
    // Calculate domains and averages for quadrants
    const maxTrades = Math.max(...data.map(d => d.trades));
    const maxValue = Math.max(...data.map(d => d.value));

    // Simple median-ish calculation for quadrant lines
    const avgTrades = data.reduce((sum, d) => sum + d.trades, 0) / data.length;
    const avgValue = data.reduce((sum, d) => sum + d.value, 0) / data.length;

    return (
        <div style={{ width: '100%', height: height }} className="relative">
            {/* Quadrant Labels */}
            <div className="absolute top-2 right-2 text-[10px] text-purple-400 font-bold bg-slate-900/80 px-1 rounded border border-purple-500/30">
                POWER BROKERS
            </div>
            <div className="absolute bottom-12 right-2 text-[10px] text-yellow-400 font-bold bg-slate-900/80 px-1 rounded border border-yellow-500/30">
                HIGH FREQ / BOTS
            </div>

            <ResponsiveContainer width="100%" height="100%">
                <ScatterChart
                    margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                    <XAxis
                        type="number"
                        dataKey="trades"
                        name="Trades"
                        allowDecimals={false}
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        label={{ value: 'Trade Frequency (Count)', position: 'bottom', offset: 0, fill: '#64748b', fontSize: 10 }}
                    />
                    <YAxis
                        type="number"
                        dataKey="value"
                        name="Value"
                        tickFormatter={formatRupiah}
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        label={{ value: 'Total Value (Rp)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
                    />
                    <ZAxis type="number" dataKey="value" range={[64, 500]} name="Value" />
                    <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />

                    {/* Quadrant Lines */}
                    <ReferenceLine x={avgTrades} stroke="#475569" strokeDasharray="3 3" />
                    <ReferenceLine y={avgValue} stroke="#475569" strokeDasharray="3 3" />

                    <Scatter
                        name="Brokers"
                        data={data}
                        onClick={(node) => onBrokerClick && onBrokerClick(node.broker)}
                        cursor="pointer"
                    >
                        {data.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.net_value >= 0 ? '#4ade80' : '#f87171'} // Green-400 : Red-400
                                stroke={entry.net_value >= 0 ? '#15803d' : '#b91c1c'}
                                fillOpacity={0.7}
                            />
                        ))}
                        <LabelList dataKey="broker" position="top" style={{ fill: '#94a3b8', fontSize: '10px' }} />
                    </Scatter>
                </ScatterChart>
            </ResponsiveContainer>
        </div>
    );
};
