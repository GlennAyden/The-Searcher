import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    ReferenceLine
} from 'recharts';

interface SpeedDynamicsChartProps {
    data: Array<{
        time: string;
        trades: number;
        has_burst?: boolean;
    }>;
    height?: number;
    avgTps?: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow-xl text-xs z-50">
                <p className="font-mono text-slate-400 mb-1">{data.time}</p>
                <p className="font-bold text-teal-400 text-sm">
                    {data.trades} Trades/sec
                </p>
                {data.has_burst && (
                    <p className="text-red-500 font-bold mt-1 text-[10px]">🔥 BURST DETECTED</p>
                )}
            </div>
        );
    }
    return null;
};

export const SpeedDynamicsChart: React.FC<SpeedDynamicsChartProps> = ({
    data,
    height = 300,
    avgTps
}) => {
    // Determine color based on intensity
    const getBarColor = (trades: number, isBurst?: boolean) => {
        if (isBurst) return '#ef4444'; // Red-500
        if (trades >= 10) return '#f97316'; // Orange-500
        if (trades >= 5) return '#eab308'; // Yellow-500
        return '#334155'; // Slate-700
    };

    return (
        <div style={{ width: '100%', height: height }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={data}
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    barGap={0}
                    barCategoryGap="10%" // Adjust gap for density
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                    <XAxis
                        dataKey="time"
                        tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                        interval="preserveStartEnd"
                        minTickGap={30}
                    />
                    <YAxis
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={30}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff05' }} />
                    {avgTps && (
                        <ReferenceLine
                            y={avgTps}
                            stroke="#14b8a6"
                            strokeDasharray="3 3"
                            strokeOpacity={0.5}
                            label={{ value: 'AVG', position: 'right', fill: '#14b8a6', fontSize: 10 }}
                        />
                    )}
                    <Bar dataKey="trades" radius={[2, 2, 0, 0]}>
                        {data.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={getBarColor(entry.trades, entry.has_burst)}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
