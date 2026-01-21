'use client';

import React from 'react';
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';
import { Card } from "@/components/ui/card";

// Types from your API definition or local definition
interface BrokerData {
    broker: string;
    total_value: number;
    net_value: number; // + for buy, - for sell
    strong_count: number;
    possible_count: number;
}

interface ImposterTreeMapProps {
    data: BrokerData[];
    onBrokerClick?: (broker: string) => void;
}

// Custom Content for TreeMap Node
const CustomizeContent = (props: any) => {
    const { root, depth, x, y, width, height, index, payload, colors, rank, name, value, net_value } = props;

    // Determine color based on net_value
    let fillColor = '#334155'; // Default slate
    if (net_value !== undefined) {
        if (net_value >= 0) fillColor = '#0d9488'; // Teal-600 for Buy
        else fillColor = '#dc2626'; // Red-600 for Sell
    }

    // Override with payload fill if provided (for categories)
    if (payload && payload.fill) fillColor = payload.fill;

    // Adjust opacity or shade based on value could be added here, 
    // but for now keeping it simple: Categories have dark fill, Leaves have specific fill.

    // Check if it's a leaf node (broker)
    const isLeaf = !props.children;

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: fillColor,
                    stroke: '#0f172a', // Darker border
                    strokeWidth: 2,
                    opacity: isLeaf ? 0.9 : 1
                }}
            />
            {/* Show Text only if enough space */}
            {width > 30 && height > 20 && (
                <text
                    x={x + width / 2}
                    y={y + height / 2}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={Math.min(width / 4, height / 2, 14)}
                    fontWeight="bold"
                    dy={-4}
                    style={{ pointerEvents: 'none' }}
                >
                    {name}
                </text>
            )}
            {width > 50 && height > 40 && value && (
                <text
                    x={x + width / 2}
                    y={y + height / 2}
                    textAnchor="middle"
                    fill="#e2e8f0"
                    fontSize={Math.min(width / 6, height / 3, 10)}
                    dy={12}
                    style={{ pointerEvents: 'none' }}
                >
                    {formatRupiah(value)}
                </text>
            )}
        </g>
    );
};

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        // Skip tooltip for category nodes if they don't have detailed stats
        if (!data.broker) return null;

        return (
            <div className="bg-slate-900 border border-slate-700 p-3 rounded shadow-xl text-sm z-50">
                <div className="font-bold text-lg mb-1">{data.name}</div>
                <div className="text-slate-300">Total Value: <span className="text-teal-400 font-bold">{formatRupiah(data.value)}</span></div>
                {data.net_value !== undefined && (
                    <div className="text-slate-300">
                        Net Value: <span className={data.net_value >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                            {formatRupiah(data.net_value)}
                        </span>
                    </div>
                )}
                <div className="flex gap-2 mt-2 border-t border-slate-700 pt-1">
                    <span className="text-red-500 font-bold">{data.strong_count || 0} Strong</span>
                    <span className="text-orange-400 font-bold">{data.possible_count || 0} Possible</span>
                </div>
            </div>
        );
    }
    return null;
};

// Helper format function
const formatRupiah = (value: number): string => {
    if (value >= 1e12) return `Rp ${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `Rp ${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `Rp ${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `Rp ${(value / 1e3).toFixed(0)}K`;
    return `Rp ${value.toFixed(0)}`;
};

export function ImposterTreeMap({ data, onBrokerClick }: ImposterTreeMapProps) {
    if (!data || data.length === 0) return <div className="text-center text-slate-500 py-10">No broker data available</div>;

    // 1. Separate Buyers and Sellers based on net_value
    const buyers = data.filter(d => d.net_value >= 0);
    const sellers = data.filter(d => d.net_value < 0);

    // 2. Construct Tree Data
    // We treat 'size' as absolute total value for visualization
    const treeData = [
        {
            name: 'Accumulators (Buy)',
            children: buyers.map(b => ({
                name: b.broker,
                broker: b.broker, // Keep ref
                size: b.total_value,
                value: b.total_value,
                net_value: b.net_value,
                strong_count: b.strong_count,
                possible_count: b.possible_count,
                fill: '#0d9488'
            })),
            fill: '#115e59'
        },
        {
            name: 'Distributors (Sell)',
            children: sellers.map(b => ({
                name: b.broker,
                broker: b.broker, // Keep ref
                size: b.total_value,
                value: b.total_value,
                net_value: b.net_value,
                strong_count: b.strong_count,
                possible_count: b.possible_count,
                fill: '#dc2626'
            })),
            fill: '#991b1b'
        }
    ];

    return (
        <Card className="bg-slate-900/50 border-slate-700 w-full">
            <div className="p-2 text-xs text-slate-400 flex gap-4 border-b border-slate-800">
                <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-teal-600 rounded-sm"></span> Accumulators (Net Buy)
                </div>
                <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-red-600 rounded-sm"></span> Distributors (Net Sell)
                </div>
            </div>
            <div className="h-[400px] w-full p-2">
                <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                        data={treeData}
                        dataKey="size"
                        aspectRatio={4 / 3}
                        stroke="#fff"
                        content={<CustomizeContent />}
                    >
                        <Tooltip content={<CustomTooltip />} />
                    </Treemap>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}
