'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Clipboard, Save, Trash2, Loader2, Check, X,
    RefreshCw, ChevronDown, Info, TrendingUp, RotateCcw, Settings2
} from "lucide-react";
import {
    ResponsiveContainer, ComposedChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, ReferenceLine
} from 'recharts';
import { doneDetailApi, SavedHistory, SankeyData, InventoryData } from '@/services/api/doneDetail';

// Consistent color palette for all charts
const BROKER_COLORS: Record<string, string> = {
    'CC': '#60a5fa', 'XL': '#4ade80', 'MG': '#f472b6', 'YP': '#fbbf24',
    'AK': '#f87171', 'XC': '#a78bfa', 'ZP': '#2dd4bf', 'CP': '#fb923c',
    'KK': '#e879f9', 'PD': '#34d399', 'BQ': '#38bdf8', 'HP': '#a3e635',
    'NI': '#f43f5e', 'SQ': '#8b5cf6', 'AI': '#14b8a6', 'DR': '#eab308',
    'YB': '#06b6d4', 'JB': '#ec4899', 'GI': '#84cc16', 'SS': '#0ea5e9',
    'FZ': '#22c55e', 'EP': '#f59e0b', 'PO': '#ef4444', 'XA': '#10b981',
    'RF': '#6366f1', 'AT': '#d946ef', 'OD': '#facc15', 'BS': '#7c3aed',
    'IH': '#fb7185', 'IN': '#2563eb', 'AO': '#16a34a', 'BK': '#dc2626',
    'GR': '#9333ea', 'IF': '#ca8a04', 'AG': '#0d9488', 'SISA': '#475569',
    'OTHERS': '#64748b'
};

const DEFAULT_COLORS = [
    '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#eab308',
    '#14b8a6', '#a855f7', '#84cc16', '#f43f5e', '#0ea5e9'
];

// Global color index tracker for consistency
const colorIndexMap: Record<string, number> = {};
let globalColorIndex = 0;

const getBrokerColor = (broker: string): string => {
    if (BROKER_COLORS[broker]) return BROKER_COLORS[broker];
    if (colorIndexMap[broker] === undefined) {
        colorIndexMap[broker] = globalColorIndex++;
    }
    return DEFAULT_COLORS[colorIndexMap[broker] % DEFAULT_COLORS.length];
};

// Format value in Rupiah
const formatRupiah = (value: number): string => {
    if (value >= 1e9) return `Rp ${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `Rp ${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `Rp ${(value / 1e3).toFixed(2)}K`;
    return `Rp ${value.toFixed(0)}`;
};

const formatLot = (value: number): string => {
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M lot`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K lot`;
    return `${value} lot`;
};

interface DoneDetailSectionProps {
    ticker: string;
    onTickerChange?: (ticker: string) => void;
}

interface BrokerNode {
    name: string;
    value: number;
    totalValue: number;
    color: string;
    y: number;
    height: number;
    percentage: number;
}

interface FlowLink {
    source: string;
    target: string;
    lot: number;
    value: number;
    avgPrice: number;
    percentage: number;
}

interface FlowBreakdown {
    broker: string;
    lot: number;
    value: number;
    color: string;
}

export function DoneDetailSection({ ticker, onTickerChange }: DoneDetailSectionProps) {
    const [selectedTicker, setSelectedTicker] = useState(ticker || '');
    const [selectedDate, setSelectedDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showPasteModal, setShowPasteModal] = useState(false);
    const [pasteData, setPasteData] = useState('');
    const [history, setHistory] = useState<SavedHistory[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [dataExists, setDataExists] = useState(false);
    const [sankeyData, setSankeyData] = useState<SankeyData | null>(null);
    const [inventoryData, setInventoryData] = useState<InventoryData | null>(null);
    const [selectedBrokers, setSelectedBrokers] = useState<string[]>([]);
    const [timeInterval, setTimeInterval] = useState(1);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Control states
    const [density, setDensity] = useState(50);
    const [showRemainder, setShowRemainder] = useState(true);
    const [displayMode, setDisplayMode] = useState<'lot' | 'value'>('value');
    const [hoveredNode, setHoveredNode] = useState<{ side: 'left' | 'right'; name: string } | null>(null);
    const [showSettings, setShowSettings] = useState(false);

    // Constants for visual improvements
    const MIN_BAR_HEIGHT = 3; // Minimum 3% height for readability
    const LABEL_THRESHOLD = 4; // Hide labels if bar < 4%
    const MAX_FLOWS = 30; // Render only top 30 flows
    const SMALL_BROKER_THRESHOLD = 1; // Group brokers < 1% as "Others"

    useEffect(() => { fetchHistory(); }, []);
    useEffect(() => { if (selectedTicker && selectedDate) checkDataExists(); }, [selectedTicker, selectedDate]);
    useEffect(() => { if (dataExists && selectedTicker && selectedDate) loadData(); }, [timeInterval]);

    const fetchHistory = async () => {
        try {
            const result = await doneDetailApi.getHistory();
            setHistory(result.history || []);
        } catch (error) { console.error('Error fetching history:', error); }
    };

    const checkDataExists = async () => {
        try {
            const result = await doneDetailApi.checkExists(selectedTicker, selectedDate);
            setDataExists(result.exists);
            if (result.exists) loadData();
            else { setSankeyData(null); setInventoryData(null); }
        } catch (error) { console.error('Error checking data:', error); }
    };

    const loadData = async () => {
        if (!selectedTicker || !selectedDate) return;
        setLoading(true);
        try {
            const [sankey, inventory] = await Promise.all([
                doneDetailApi.getSankeyData(selectedTicker, selectedDate),
                doneDetailApi.getInventoryData(selectedTicker, selectedDate, timeInterval)
            ]);
            setSankeyData(sankey);
            setInventoryData(inventory);
            if (inventory.brokers.length > 0 && selectedBrokers.length === 0) {
                setSelectedBrokers(inventory.brokers.slice(0, 8));
            }
        } catch (error) {
            console.error('Error loading data:', error);
            setMessage({ type: 'error', text: 'Failed to load data' });
        } finally { setLoading(false); }
    };

    const handleSave = async () => {
        if (!selectedTicker || !selectedDate || !pasteData) {
            setMessage({ type: 'error', text: 'Please fill ticker, date, and paste data' });
            return;
        }
        setSaving(true);
        try {
            const result = await doneDetailApi.saveData(selectedTicker, selectedDate, pasteData);
            if (result.success) {
                setMessage({ type: 'success', text: `Saved ${result.records_saved} records` });
                setShowPasteModal(false);
                setPasteData('');
                setDataExists(true);
                fetchHistory();
                loadData();
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to save data' });
        } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!selectedTicker || !selectedDate) return;
        if (!confirm(`Delete data for ${selectedTicker} on ${selectedDate}?`)) return;
        try {
            await doneDetailApi.deleteData(selectedTicker, selectedDate);
            setMessage({ type: 'success', text: 'Data deleted' });
            setDataExists(false);
            setSankeyData(null);
            setInventoryData(null);
            fetchHistory();
        } catch (error) { setMessage({ type: 'error', text: 'Failed to delete data' }); }
    };

    const handlePasteFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setPasteData(text);
        } catch (error) { setMessage({ type: 'error', text: 'Please allow clipboard access' }); }
    };

    const toggleBroker = (broker: string) => {
        setSelectedBrokers(prev =>
            prev.includes(broker) ? prev.filter(b => b !== broker) : [...prev, broker]
        );
    };

    // Sync broker selection from Sankey to Inventory chart
    const syncBrokerSelection = (brokerName: string) => {
        if (brokerName === 'SISA' || brokerName === 'OTHERS') return;
        if (!selectedBrokers.includes(brokerName)) {
            setSelectedBrokers(prev => [...prev, brokerName]);
        }
    };

    // Process Sankey data with optimized calculations
    const processedSankeyData = useMemo(() => {
        if (!sankeyData?.nodes?.length || !sankeyData?.links?.length) {
            return { sellers: [] as BrokerNode[], buyers: [] as BrokerNode[], flows: [] as FlowLink[], flowBreakdowns: new Map<string, FlowBreakdown[]>() };
        }

        // Step 1: Calculate broker totals from links
        const sellerTotals = new Map<string, { lot: number; value: number }>();
        const buyerTotals = new Map<string, { lot: number; value: number }>();
        let totalVolume = 0;

        sankeyData.links.forEach(link => {
            const sourceNode = sankeyData.nodes[link.source];
            const targetNode = sankeyData.nodes[link.target];
            if (!sourceNode || !targetNode) return;

            // Use pre-calculated value from backend (val = qty * price, matching NeoBDM)
            const value = (link as any).val || link.value * ((link as any).avgPrice || 0);
            totalVolume += link.value;

            if (sourceNode.type === 'seller') {
                const existing = sellerTotals.get(sourceNode.name) || { lot: 0, value: 0 };
                sellerTotals.set(sourceNode.name, { lot: existing.lot + link.value, value: existing.value + value });
            }
            if (targetNode.type === 'buyer') {
                const existing = buyerTotals.get(targetNode.name) || { lot: 0, value: 0 };
                buyerTotals.set(targetNode.name, { lot: existing.lot + link.value, value: existing.value + value });
            }
        });

        // Step 2: Sort by volume and apply density-based filtering
        // Density = percentage of VOLUME to show (not count of brokers)
        const sortedSellers = [...sellerTotals.entries()].sort((a, b) => b[1].lot - a[1].lot);
        const sortedBuyers = [...buyerTotals.entries()].sort((a, b) => b[1].lot - a[1].lot);

        // Calculate cumulative volume to determine cutoff
        const targetVolume = (density / 100) * totalVolume;

        const selectTopBrokers = (sorted: [string, { lot: number; value: number }][]): { visible: typeof sorted; remainder: typeof sorted } => {
            let cumVolume = 0;
            const visible: typeof sorted = [];
            const remainder: typeof sorted = [];

            for (const entry of sorted) {
                if (cumVolume < targetVolume || visible.length === 0) {
                    visible.push(entry);
                    cumVolume += entry[1].lot;
                } else {
                    remainder.push(entry);
                }
            }
            return { visible, remainder };
        };

        const { visible: visibleSellers, remainder: remainderSellers } = selectTopBrokers(sortedSellers);
        const { visible: visibleBuyers, remainder: remainderBuyers } = selectTopBrokers(sortedBuyers);

        // Step 3: Build final broker lists with SISA
        const buildBrokerNodes = (
            visible: [string, { lot: number; value: number }][],
            remainder: [string, { lot: number; value: number }][]
        ): BrokerNode[] => {
            const nodes: BrokerNode[] = [];
            let totalLot = visible.reduce((s, [_, d]) => s + d.lot, 0);

            if (showRemainder && remainder.length > 0) {
                const sisaLot = remainder.reduce((s, [_, d]) => s + d.lot, 0);
                const sisaValue = remainder.reduce((s, [_, d]) => s + d.value, 0);
                visible = [...visible, ['SISA', { lot: sisaLot, value: sisaValue }]];
                totalLot += sisaLot;
            }

            // Calculate heights with proper normalization (no MIN_BAR_HEIGHT overflow)
            let yPos = 0;
            visible.forEach(([name, data]) => {
                const rawPct = (data.lot / totalLot) * 100;
                // Apply minimum height only for display, don't add to total
                const displayHeight = Math.max(rawPct, MIN_BAR_HEIGHT);

                nodes.push({
                    name,
                    value: data.lot,
                    totalValue: data.value,
                    color: getBrokerColor(name),
                    y: 0, // Will be set after normalization
                    height: displayHeight,
                    percentage: rawPct
                });
            });

            // Normalize to exactly 100%
            const totalHeight = nodes.reduce((s, n) => s + n.height, 0);
            const scale = 100 / totalHeight;

            nodes.forEach(n => {
                n.y = yPos;
                n.height = n.height * scale;
                yPos += n.height;
            });

            return nodes;
        };

        const sellers = buildBrokerNodes(visibleSellers, remainderSellers);
        const buyers = buildBrokerNodes(visibleBuyers, remainderBuyers);

        // Step 4: Build flows with proper visibility mapping
        const visibleSellerSet = new Set(sellers.map(s => s.name));
        const visibleBuyerSet = new Set(buyers.map(b => b.name));
        const flows: FlowLink[] = [];
        const flowBreakdowns = new Map<string, FlowBreakdown[]>();

        sankeyData.links.forEach(link => {
            const sourceNode = sankeyData.nodes[link.source];
            const targetNode = sankeyData.nodes[link.target];
            if (!sourceNode || !targetNode) return;

            const sourceName = visibleSellerSet.has(sourceNode.name) ? sourceNode.name : (showRemainder ? 'SISA' : null);
            const targetName = visibleBuyerSet.has(targetNode.name) ? targetNode.name : (showRemainder ? 'SISA' : null);
            if (!sourceName || !targetName) return;

            // Use pre-calculated value from backend (val = qty * price, matching NeoBDM)
            const value = (link as any).val || link.value * ((link as any).avgPrice || 0);

            // Build breakdowns for hover (use visible names)
            const addToBreakdown = (key: string, broker: string, lot: number, val: number) => {
                if (!flowBreakdowns.has(key)) flowBreakdowns.set(key, []);
                const arr = flowBreakdowns.get(key)!;
                const existing = arr.find(b => b.broker === broker);
                if (existing) {
                    existing.lot += lot;
                    existing.value += val;
                } else {
                    arr.push({ broker, lot, value: val, color: getBrokerColor(broker) });
                }
            };

            addToBreakdown(`seller-${sourceName}`, targetName, link.value, value);
            addToBreakdown(`buyer-${targetName}`, sourceName, link.value, value);

            // Aggregate flows
            const existing = flows.find(f => f.source === sourceName && f.target === targetName);
            if (existing) {
                existing.lot += link.value;
                existing.value += value;
            } else {
                flows.push({ source: sourceName, target: targetName, lot: link.value, value, avgPrice: (link as any).avgPrice || 0, percentage: 0 });
            }
        });

        // Step 5: Calculate flow opacity based on relative volume
        const maxFlowLot = Math.max(...flows.map(f => f.lot), 1);
        flows.forEach(f => { f.percentage = (f.lot / maxFlowLot) * 100; });
        flows.sort((a, b) => b.lot - a.lot);

        // Sort breakdowns
        flowBreakdowns.forEach(arr => arr.sort((a, b) => b.value - a.value));

        return { sellers, buyers, flows: flows.slice(0, MAX_FLOWS), flowBreakdowns };
    }, [sankeyData, density, showRemainder]);

    const tickerHistory = useMemo(() => history.filter(h => h.ticker === selectedTicker.toUpperCase()), [history, selectedTicker]);

    useEffect(() => { if (message) { const t = setTimeout(() => setMessage(null), 3000); return () => clearTimeout(t); } }, [message]);

    // Custom Sankey with performance optimizations
    const CustomSankey = useCallback(() => {
        const { sellers, buyers, flows, flowBreakdowns } = processedSankeyData;
        if (sellers.length === 0) return null;

        const nodeWidth = 14;
        const sellerMap = new Map(sellers.map(s => [s.name, s]));
        const buyerMap = new Map(buyers.map(b => [b.name, b]));

        // Get breakdown for hovered node
        const hoveredBreakdown = hoveredNode
            ? flowBreakdowns.get(`${hoveredNode.side === 'left' ? 'seller' : 'buyer'}-${hoveredNode.name}`) || []
            : [];
        const hoveredTotal = hoveredBreakdown.reduce((s, b) => s + (displayMode === 'lot' ? b.lot : b.value), 0);

        // Pre-calculate flow paths once
        const flowPaths = flows.map((flow, i) => {
            const sourceNode = sellerMap.get(flow.source);
            const targetNode = buyerMap.get(flow.target);
            if (!sourceNode || !targetNode) return null;

            const sy = sourceNode.y + sourceNode.height / 2;
            const ty = targetNode.y + targetNode.height / 2;
            const sx = nodeWidth + 1, tx = 100 - nodeWidth - 1;
            const cx1 = sx + (tx - sx) * 0.35, cx2 = sx + (tx - sx) * 0.65;

            const isHighlighted = hoveredNode && (
                (hoveredNode.side === 'left' && flow.source === hoveredNode.name) ||
                (hoveredNode.side === 'right' && flow.target === hoveredNode.name)
            );
            const isOther = hoveredNode && !isHighlighted;
            const baseOpacity = Math.max(0.15, Math.min(0.7, flow.percentage / 100));

            return {
                key: `flow-${i}`,
                d: `M ${sx} ${sy} C ${cx1} ${sy}, ${cx2} ${ty}, ${tx} ${ty}`,
                stroke: isHighlighted ? sourceNode.color : (isOther ? '#0f172a' : sourceNode.color),
                strokeWidth: isHighlighted ? 1.5 : Math.max(0.3, (flow.percentage / 100) * 2),
                opacity: isHighlighted ? 0.9 : (isOther ? 0.05 : baseOpacity)
            };
        }).filter(Boolean);

        return (
            <div className="relative w-full h-full">
                <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
                    {/* Flow paths - no transitions for performance */}
                    {flowPaths.map(fp => (
                        <path key={fp!.key} d={fp!.d} fill="none" stroke={fp!.stroke} strokeWidth={fp!.strokeWidth} strokeOpacity={fp!.opacity} />
                    ))}

                    {/* Seller nodes */}
                    {sellers.map((node, i) => (
                        <rect
                            key={`seller-${i}`}
                            x={0} y={node.y} width={nodeWidth} height={node.height}
                            fill={node.color}
                            opacity={hoveredNode && hoveredNode.side === 'left' && hoveredNode.name !== node.name ? 0.3 : 0.95}
                            className="cursor-pointer"
                            onMouseEnter={() => setHoveredNode({ side: 'left', name: node.name })}
                            onMouseLeave={() => setHoveredNode(null)}
                            onClick={() => syncBrokerSelection(node.name)}
                        />
                    ))}

                    {/* Buyer nodes */}
                    {buyers.map((node, i) => (
                        <rect
                            key={`buyer-${i}`}
                            x={100 - nodeWidth} y={node.y} width={nodeWidth} height={node.height}
                            fill={node.color}
                            opacity={hoveredNode && hoveredNode.side === 'right' && hoveredNode.name !== node.name ? 0.3 : 0.95}
                            className="cursor-pointer"
                            onMouseEnter={() => setHoveredNode({ side: 'right', name: node.name })}
                            onMouseLeave={() => setHoveredNode(null)}
                            onClick={() => syncBrokerSelection(node.name)}
                        />
                    ))}
                </svg>

                {/* Labels - only show if bar is large enough */}
                <div className="absolute inset-0 pointer-events-none">
                    {sellers.filter(n => n.height >= LABEL_THRESHOLD).map((node, i) => (
                        <div
                            key={`seller-label-${i}`}
                            className="absolute text-xs font-bold text-white"
                            style={{
                                left: '1%', top: `${node.y + node.height / 2}%`, transform: 'translateY(-50%)',
                                opacity: hoveredNode && hoveredNode.side === 'left' && hoveredNode.name !== node.name ? 0.3 : 1,
                                fontSize: node.height > 8 ? '0.65rem' : '0.5rem'
                            }}
                        >
                            {node.name}.
                        </div>
                    ))}
                    {buyers.filter(n => n.height >= LABEL_THRESHOLD).map((node, i) => (
                        <div
                            key={`buyer-label-${i}`}
                            className="absolute text-xs font-bold text-white"
                            style={{
                                right: '1%', top: `${node.y + node.height / 2}%`, transform: 'translateY(-50%)',
                                opacity: hoveredNode && hoveredNode.side === 'right' && hoveredNode.name !== node.name ? 0.3 : 1,
                                fontSize: node.height > 8 ? '0.65rem' : '0.5rem'
                            }}
                        >
                            .{node.name}
                        </div>
                    ))}
                </div>

                {/* Hover tooltip */}
                {hoveredNode && hoveredBreakdown.length > 0 && (
                    <div
                        className="absolute bg-slate-900/95 border border-slate-600 rounded-lg shadow-xl z-50 p-2 min-w-[140px] max-w-[180px]"
                        style={{
                            left: hoveredNode.side === 'left' ? '16%' : 'auto',
                            right: hoveredNode.side === 'right' ? '16%' : 'auto',
                            top: `${Math.min(70, (hoveredNode.side === 'left' ? sellerMap : buyerMap).get(hoveredNode.name)?.y || 0)}%`,
                        }}
                    >
                        <div className="font-bold text-xs mb-1 pb-1 border-b border-slate-700" style={{ color: getBrokerColor(hoveredNode.name) }}>
                            {hoveredNode.side === 'left' ? `${hoveredNode.name}. →` : `→ .${hoveredNode.name}`}
                            <span className="text-white ml-1">{displayMode === 'value' ? formatRupiah(hoveredTotal) : formatLot(hoveredTotal)}</span>
                        </div>
                        <div className="space-y-0.5 max-h-32 overflow-y-auto">
                            {hoveredBreakdown.slice(0, 8).map((b, i) => (
                                <div key={i} className="flex justify-between text-[10px]">
                                    <span style={{ color: b.color }}>{hoveredNode.side === 'left' ? `.${b.broker}` : `${b.broker}.`}</span>
                                    <span className="text-slate-300">{displayMode === 'value' ? formatRupiah(b.value) : formatLot(b.lot)}</span>
                                </div>
                            ))}
                            {hoveredBreakdown.length > 8 && (
                                <div className="text-[9px] text-slate-500 text-center">+{hoveredBreakdown.length - 8} more</div>
                            )}
                        </div>
                    </div>
                )}

                <div className="absolute bottom-0 right-1 text-[9px] text-slate-600">NeoBDM Technology</div>
            </div>
        );
    }, [processedSankeyData, hoveredNode, displayMode]);

    return (
        <div className="space-y-3">
            {/* Header with controls inline (improvement #4) */}
            <Card className="bg-slate-900/50 border-slate-700">
                <CardContent className="py-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                            <Input value={selectedTicker} onChange={(e) => setSelectedTicker(e.target.value.toUpperCase())}
                                placeholder="Ticker" className="w-24 bg-slate-800 border-slate-600 uppercase font-bold" />
                            {tickerHistory.length > 0 && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                    <span className="text-[10px] text-white font-bold">{tickerHistory.length}</span>
                                </div>
                            )}
                        </div>
                        <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-36 bg-slate-800 border-slate-600" />

                        {dataExists && <span className="flex items-center gap-1 text-green-400 text-xs"><Check className="w-3 h-3" />Data exists</span>}

                        {/* Inline controls (improvement #4) */}
                        <div className="flex items-center gap-2 px-2 py-1 bg-slate-800/50 rounded-lg">
                            <span className="text-xs text-slate-500">Density</span>
                            <Slider value={[density]} onValueChange={(v) => setDensity(v[0])} min={10} max={100} step={5} className="w-20" />
                            <span className="text-xs text-slate-400 w-8">{density}%</span>
                        </div>

                        <div className="flex items-center gap-2 px-2 py-1 bg-slate-800/50 rounded-lg">
                            <Checkbox id="sisa" checked={showRemainder} onCheckedChange={(c) => setShowRemainder(c === true)} />
                            <label htmlFor="sisa" className="text-xs text-slate-400 cursor-pointer">Sisa</label>
                        </div>

                        <div className="flex items-center gap-1 px-2 py-1 bg-slate-800/50 rounded-lg">
                            <span className={`text-xs ${displayMode === 'lot' ? 'text-white' : 'text-slate-500'}`}>Lot</span>
                            <Switch checked={displayMode === 'value'} onCheckedChange={(c) => setDisplayMode(c ? 'value' : 'lot')} />
                            <span className={`text-xs ${displayMode === 'value' ? 'text-teal-400' : 'text-slate-500'}`}>Rp</span>
                        </div>

                        <div className="flex items-center gap-1 ml-auto">
                            <Button variant="outline" size="sm" onClick={() => setShowPasteModal(true)} className="border-teal-500 text-teal-400 hover:bg-teal-500/20 h-7 text-xs">
                                <Clipboard className="w-3 h-3 mr-1" />Paste
                            </Button>
                            {dataExists && (
                                <>
                                    <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="border-slate-600 h-7">
                                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={handleDelete} className="border-red-500 text-red-400 h-7">
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </>
                            )}
                            <div className="relative">
                                <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)} className="text-slate-400 h-7">
                                    <Info className="w-3 h-3 mr-1" />({history.length})<ChevronDown className="w-3 h-3 ml-1" />
                                </Button>
                                {showHistory && (
                                    <div className="absolute right-0 top-full mt-1 w-56 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 max-h-48 overflow-auto">
                                        {history.length === 0 ? <div className="p-2 text-slate-400 text-xs">No saved data</div> : history.map((h, i) => (
                                            <button key={i} className="w-full p-2 text-left hover:bg-slate-700 flex justify-between items-center text-xs"
                                                onClick={() => { setSelectedTicker(h.ticker); setSelectedDate(h.trade_date); setShowHistory(false); }}>
                                                <span className="font-medium text-white">{h.ticker}</span>
                                                <span className="text-slate-400">{h.trade_date}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    {message && <div className={`mt-2 p-1.5 rounded text-xs ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{message.text}</div>}
                </CardContent>
            </Card>

            {/* Charts */}
            {loading ? (
                <div className="flex items-center justify-center h-80"><Loader2 className="w-6 h-6 animate-spin text-teal-400" /></div>
            ) : dataExists && sankeyData && inventoryData ? (
                <div className="space-y-3">
                    {/* Sankey Flow - Full Width */}
                    <Card className="bg-slate-900/80 border-teal-500/30">
                        <CardHeader className="py-2 px-3 border-b border-slate-700">
                            <CardTitle className="text-xs flex items-center justify-between text-teal-400">
                                <span>{selectedTicker} Flow</span>
                                <RotateCcw className="w-3 h-3 text-slate-500 cursor-pointer hover:text-white" onClick={loadData} />
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-2"><div className="h-[400px]"><CustomSankey /></div></CardContent>
                    </Card>

                    {/* Daily Inventory - Full Width */}
                    <Card className="bg-slate-900/80 border-teal-500/30">
                        <CardHeader className="py-2 px-3 border-b border-slate-700">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xs text-teal-400">Daily Inventory</CardTitle>
                                <div className="flex items-center gap-1">
                                    {[1, 2, 3, 5].map(interval => (
                                        <Button key={interval} variant={timeInterval === interval ? 'default' : 'outline'} size="sm"
                                            className={`h-5 px-1.5 text-[10px] ${timeInterval === interval ? 'bg-teal-600' : 'border-slate-600'}`}
                                            onClick={() => setTimeInterval(interval)}>{interval}m</Button>
                                    ))}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-2">
                            {inventoryData.timeSeries.length > 0 ? (
                                <>
                                    <div className="h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={inventoryData.timeSeries}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                                <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={(v) => v?.slice(0, 5)} />
                                                <YAxis tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={(v) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                                                <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} ifOverflow="extendDomain" />
                                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', fontSize: '10px' }} />
                                                {selectedBrokers.map((broker) => (
                                                    <Line key={broker} type="stepAfter" dataKey={broker} stroke={getBrokerColor(broker)} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
                                                ))}
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="mt-2 p-1.5 bg-slate-800/50 rounded flex flex-wrap gap-1 justify-center max-h-20 overflow-y-auto">
                                        {inventoryData.brokers.map((broker) => {
                                            const isSelected = selectedBrokers.includes(broker);
                                            const color = getBrokerColor(broker);
                                            return (
                                                <button key={broker} onClick={() => toggleBroker(broker)}
                                                    className={`px-1.5 py-0.5 text-[10px] rounded border font-bold transition-all ${isSelected ? 'text-white' : 'border-slate-600 text-slate-500'}`}
                                                    style={{ backgroundColor: isSelected ? color : 'transparent', borderColor: isSelected ? color : undefined }}>
                                                    {broker}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No inventory data</div>}
                        </CardContent>
                    </Card>
                </div>
            ) : !dataExists && selectedTicker && selectedDate ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                    <Clipboard className="w-10 h-10 mb-2 text-slate-600" />
                    <p className="text-sm">No data for {selectedTicker} on {selectedDate}</p>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                    <Info className="w-10 h-10 mb-2 text-slate-600" /><p className="text-sm">Select a ticker and date</p>
                </div>
            )}

            {/* Paste Modal */}
            {showPasteModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-xl bg-slate-800 border-slate-600">
                        <CardHeader className="py-3">
                            <CardTitle className="flex items-center justify-between text-base">
                                <span>Paste Trade Data</span>
                                <Button variant="ghost" size="sm" onClick={() => setShowPasteModal(false)}><X className="w-4 h-4" /></Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Ticker</label>
                                    <Input value={selectedTicker} onChange={(e) => setSelectedTicker(e.target.value.toUpperCase())} placeholder="SUPA" className="bg-slate-700 border-slate-600 uppercase" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Trade Date</label>
                                    <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-slate-700 border-slate-600" />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs text-slate-400">Trade Data (TSV)</label>
                                    <Button variant="outline" size="sm" onClick={handlePasteFromClipboard} className="h-6 text-xs">
                                        <Clipboard className="w-3 h-3 mr-1" />Paste
                                    </Button>
                                </div>
                                <textarea value={pasteData} onChange={(e) => setPasteData(e.target.value)}
                                    placeholder="Paste TSV data..." className="w-full h-36 bg-slate-700 border border-slate-600 rounded p-2 text-xs font-mono resize-none" />
                                <p className="text-[10px] text-slate-500 mt-1">{pasteData ? `${pasteData.split('\n').length} lines` : 'Paste from NeoBDM'}</p>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setShowPasteModal(false)}>Cancel</Button>
                                <Button size="sm" onClick={handleSave} disabled={saving || !pasteData} className="bg-teal-600 hover:bg-teal-700">
                                    {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}Save
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
