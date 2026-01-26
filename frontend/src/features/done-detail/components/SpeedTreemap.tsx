import React from 'react';
import {
    Treemap,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

interface SpeedTreemapProps {
    data: Array<{
        name: string; // Broker
        size: number; // Trade Frequency (Area)
        tps: number;  // Heatmap Color
        value: number; // Total Value
        broker_name: string;
    }>;
    height?: number;
    onBrokerClick?: (broker: string) => void;
}

type SpeedTreemapItem = SpeedTreemapProps['data'][number];

type SpeedTreemapTooltipPayload = {
    payload: SpeedTreemapItem;
};

type SpeedTreemapTooltipProps = {
    active?: boolean;
    payload?: SpeedTreemapTooltipPayload[];
};

type SpeedTreemapContentProps = {
    depth?: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    name?: string;
    tps?: number;
};

type TreemapClickNode = {
    name?: string;
};

const formatRupiah = (value: number): string => {
    const absValue = Math.abs(value);
    if (absValue >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
    if (absValue >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (absValue >= 1e6) return `${(value / 1e6).toFixed(0)}M`;
    if (absValue >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return `${value.toFixed(0)}`;
};

const CustomTooltip = ({ active, payload }: SpeedTreemapTooltipProps) => {
    if (active && payload && payload.length) {
        const data = payload[0]?.payload;
        if (!data) return null;
        return (
            <div className="bg-slate-900 border border-slate-700 p-3 rounded shadow-xl text-xs z-50">
                <p className="font-bold text-white text-sm mb-1">{data.name}</p>
                <p className="text-slate-400 mb-2">{data.broker_name}</p>
                <div className="space-y-1">
                    <div className="flex justify-between gap-4">
                        <span className="text-slate-500">Speed (TPS):</span>
                        <span className={`font-bold ${data.tps >= 15 ? 'text-red-500' : 'text-yellow-400'}`}>
                            {data.tps} /sec
                        </span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span className="text-slate-500">Freq Count:</span>
                        <span className="font-bold text-white">{data.size.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span className="text-slate-500">Total Val:</span>
                        <span className="font-bold text-teal-400">{formatRupiah(data.value)}</span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

const CustomizeContent = (props: SpeedTreemapContentProps) => {
    const { x = 0, y = 0, width = 0, height = 0, name, tps = 0 } = props;

    // Determine color based on TPS
    let fillColor = '#334155'; // Default Slate (Low Speed)
    const textColor = '#fff';

    if (tps >= 15) {
        fillColor = '#dc2626'; // Red-600 (High Speed)
    } else if (tps >= 5) {
        fillColor = '#ca8a04'; // Yellow-600 (Med Speed)
    } else {
        fillColor = '#0f172a'; // Slate-900 (Low Speed)
    }

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: fillColor,
                    stroke: '#1e293b',
                    strokeWidth: 2,
                    strokeOpacity: 1,
                }}
            />
            {width > 30 && height > 20 && (
                <text
                    x={x + width / 2}
                    y={y + height / 2}
                    textAnchor="middle"
                    fill={textColor}
                    fontSize={Math.min(width / 3, height / 2, 14)}
                    fontWeight="bold"
                >
                    {name}
                </text>
            )}
            {width > 50 && height > 40 && (
                <text
                    x={x + width / 2}
                    y={y + height / 2 + 14}
                    textAnchor="middle"
                    fill={textColor}
                    fillOpacity={0.7}
                    fontSize={10}
                >
                    {tps} tps
                </text>
            )}
        </g>
    );
};

export const SpeedTreemap: React.FC<SpeedTreemapProps> = ({
    data,
    height = 400,
    onBrokerClick
}) => {
    return (
        <div style={{ width: '100%', height: height }} className="relative font-sans">
            <div className="absolute top-2 right-2 flex gap-2 text-[10px] z-10 bg-slate-900/80 p-1 rounded">
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-slate-900 border border-slate-700"></div> Slow</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-[#ca8a04]"></div> Med</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-red-600"></div> Fast</div>
            </div>

            <ResponsiveContainer width="100%" height="100%">
                <Treemap
                    data={data}
                    dataKey="size"
                    aspectRatio={4 / 3}
                    stroke="#fff"
                    fill="#8884d8"
                    content={<CustomizeContent />}
                    onClick={(node: TreemapClickNode) => onBrokerClick && node?.name && onBrokerClick(node.name)}
                    animationDuration={800}
                >
                    <Tooltip content={<CustomTooltip />} />
                </Treemap>
            </ResponsiveContainer>
        </div>
    );
};
