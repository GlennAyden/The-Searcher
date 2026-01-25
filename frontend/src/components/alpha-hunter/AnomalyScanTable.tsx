"use client";

import React, { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, TrendingUp, Zap, Target, Flame, AlertTriangle, ArrowRightCircle, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";

interface Pattern {
    name: string;
    display: string;
    score: number;
    icon: string;
}

interface FlowSignal {
    symbol: string;
    signal_score: number;
    signal_strength: string;
    conviction: string;
    entry_zone: string;
    flow: number;
    change: number;
    price: number;
    patterns: Pattern[];
    pattern_names: string[];
    has_positive_pattern: boolean;
    alignment_status: string;
    momentum_status: string;
    warning_status: string;
    pinky?: string;
    crossing?: string;
    unusual?: string;
}

interface ScanStats {
    by_conviction: { VERY_HIGH: number; HIGH: number; MEDIUM: number; LOW: number };
    by_strength: { VERY_STRONG: number; STRONG: number; MODERATE: number; WEAK: number };
    with_positive_pattern: number;
    in_sweet_spot: number;
}

interface ScanResponse {
    total_signals: number;
    filtered_count: number;
    signals: FlowSignal[];
    stats: ScanStats;
    message?: string;
}

interface AnomalyScanTableProps {
    onAddToWatchlist: () => void;
    onAddToInvestigation?: (signal: FlowSignal) => void;
}

export default function AnomalyScanTable({ onAddToWatchlist, onAddToInvestigation }: AnomalyScanTableProps) {
    const [results, setResults] = useState<FlowSignal[]>([]);
    const [stats, setStats] = useState<ScanStats | null>(null);
    const [totalSignals, setTotalSignals] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter states
    const [minScore, setMinScore] = useState("45");
    const [strengthFilter, setStrengthFilter] = useState("all");
    const [showLegend, setShowLegend] = useState(false);

    // Price filter states
    const [priceValue, setPriceValue] = useState("");
    const [priceOperator, setPriceOperator] = useState("lt");
    const [totalMatches, setTotalMatches] = useState(0);

    // Auto scan on mount
    useEffect(() => {
        runScan();
    }, []);

    const runScan = async () => {
        setIsLoading(true);
        setError(null);
        try {
            let url = `http://localhost:8000/api/alpha-hunter/stage1/scan?min_score=${minScore}&min_flow=0&max_price_change=20&max_results=20`;

            if (strengthFilter !== "all") {
                url += `&strength_filter=${strengthFilter}`;
            }

            // Add price filter if value is set
            if (priceValue && priceValue.trim() !== "") {
                url += `&price_value=${priceValue}&price_operator=${priceOperator}`;
            }

            const res = await fetch(url);
            const data: ScanResponse = await res.json();

            if (data.message) {
                setError(data.message);
                setResults([]);
            } else {
                setResults(data.signals || []);
                setStats(data.stats || null);
                setTotalSignals(data.total_signals || 0);
                setTotalMatches((data as any).total_matches || data.filtered_count || 0);
            }
        } catch (err) {
            console.error(err);
            setError("Failed to fetch signals. Check if server is running.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleInvestigate = async (item: FlowSignal) => {
        try {
            await fetch("http://localhost:8000/api/alpha-hunter/watchlist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "add",
                    ticker: item.symbol,
                    scan_data: {
                        ticker: item.symbol,
                        total_score: item.signal_score,
                        signal_level: item.signal_strength,
                        breakdown: {
                            flow: item.flow,
                            change: item.change,
                            patterns: item.pattern_names,
                            conviction: item.conviction,
                            entry_zone: item.entry_zone
                        }
                    }
                })
            });

            // Call the new investigation callback if provided
            if (onAddToInvestigation) {
                onAddToInvestigation(item);
            } else {
                onAddToWatchlist();
            }
        } catch (err) {
            console.error("Failed to add to watchlist", err);
        }
    };

    const getConvictionBadge = (conviction: string) => {
        switch (conviction) {
            case 'VERY_HIGH':
                return <Badge className="bg-red-600 text-white border-0">🔥 VERY HIGH</Badge>;
            case 'HIGH':
                return <Badge className="bg-orange-600 text-white border-0">🔥 HIGH</Badge>;
            case 'MEDIUM':
                return <Badge className="bg-amber-600 text-white border-0">⚡ MEDIUM</Badge>;
            default:
                return <Badge variant="outline" className="border-slate-600 text-slate-400">LOW</Badge>;
        }
    };

    const getEntryZoneBadge = (zone: string) => {
        switch (zone) {
            case 'SWEET_SPOT':
                return <Badge className="bg-emerald-600 text-white border-0">🎯 SWEET SPOT</Badge>;
            case 'ACCEPTABLE':
                return <Badge variant="outline" className="border-emerald-500/50 text-emerald-400">✓ Acceptable</Badge>;
            default:
                return <Badge variant="outline" className="border-red-500/50 text-red-400">⚠ Risky</Badge>;
        }
    };

    const getSignalStrengthIcon = (strength: string) => {
        switch (strength) {
            case 'VERY_STRONG':
                return <span className="text-lg">🔥🔥🔥</span>;
            case 'STRONG':
                return <span className="text-lg">🔥🔥</span>;
            case 'MODERATE':
                return <span className="text-lg">🔥</span>;
            default:
                return <span className="text-slate-500">-</span>;
        }
    };

    const getMomentumBadge = (momentum: string) => {
        if (momentum === 'ACCELERATING') {
            return <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 text-xs">🚀 Accelerating</Badge>;
        } else if (momentum === 'STABLE') {
            return <Badge variant="outline" className="border-blue-500/50 text-blue-400 text-xs">→ Stable</Badge>;
        } else if (momentum === 'DECELERATING') {
            return <Badge variant="outline" className="border-amber-500/50 text-amber-400 text-xs">↓ Decelerating</Badge>;
        }
        return null;
    };

    return (
        <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="border-b border-slate-800 pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <Flame className="h-5 w-5 text-orange-500" />
                            Flow-Based Signal Scanner
                        </CardTitle>
                        <p className="text-sm text-slate-400 mt-1">
                            Detecting smart money accumulation patterns from NeoBDM flow data.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Min Score Filter */}
                        <Select value={minScore} onValueChange={setMinScore}>
                            <SelectTrigger className="w-[140px] bg-slate-800 border-slate-700">
                                <SelectValue placeholder="Min Score" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                                <SelectItem value="0">All Scores</SelectItem>
                                <SelectItem value="45">Score ≥ 45</SelectItem>
                                <SelectItem value="60">Score ≥ 60</SelectItem>
                                <SelectItem value="90">Score ≥ 90</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Strength Filter */}
                        <Select value={strengthFilter} onValueChange={setStrengthFilter}>
                            <SelectTrigger className="w-[160px] bg-slate-800 border-slate-700">
                                <SelectValue placeholder="Strength" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                                <SelectItem value="all">All Strengths</SelectItem>
                                <SelectItem value="VERY_STRONG">Very Strong</SelectItem>
                                <SelectItem value="STRONG">Strong</SelectItem>
                                <SelectItem value="MODERATE">Moderate</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Price Filter */}
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-500">Price</span>
                            <Select value={priceOperator} onValueChange={setPriceOperator}>
                                <SelectTrigger className="w-[70px] bg-slate-800 border-slate-700">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-700">
                                    <SelectItem value="lt">&lt;</SelectItem>
                                    <SelectItem value="lte">≤</SelectItem>
                                    <SelectItem value="gt">&gt;</SelectItem>
                                    <SelectItem value="gte">≥</SelectItem>
                                    <SelectItem value="eq">=</SelectItem>
                                </SelectContent>
                            </Select>
                            <input
                                type="number"
                                value={priceValue}
                                onChange={(e) => setPriceValue(e.target.value)}
                                placeholder="e.g. 500"
                                className="w-[80px] bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-600"
                            />
                        </div>

                        <Button onClick={runScan} disabled={isLoading} variant="outline" className="border-slate-700">
                            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            {isLoading ? 'Scanning...' : 'Scan'}
                        </Button>
                    </div>
                </div>

                {/* Stats Bar */}
                {stats && (
                    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-800">
                        <div className="text-sm text-slate-400">
                            <span className="font-medium text-white">{results.length}</span>/{totalSignals} signals
                        </div>
                        <div className="h-4 w-px bg-slate-700" />
                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-red-400">🔥 VERY_HIGH: {stats.by_conviction.VERY_HIGH}</span>
                            <span className="text-orange-400">HIGH: {stats.by_conviction.HIGH}</span>
                            <span className="text-amber-400">MEDIUM: {stats.by_conviction.MEDIUM}</span>
                        </div>
                        <div className="h-4 w-px bg-slate-700" />
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Target className="h-3 w-3 text-emerald-400" />
                            <span>Sweet Spot: {stats.in_sweet_spot}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            <TrendingUp className="h-3 w-3 text-purple-400" />
                            <span>With Pattern: {stats.with_positive_pattern}</span>
                        </div>
                    </div>
                )}

                {/* Legend Toggle Button */}
                <div className="mt-4 pt-4 border-t border-slate-800">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowLegend(!showLegend)}
                        className="text-slate-400 hover:text-slate-200 px-2"
                    >
                        <HelpCircle className="h-4 w-4 mr-2" />
                        Keterangan Kolom
                        {showLegend ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
                    </Button>

                    {/* Collapsible Legend Content */}
                    {showLegend && (
                        <div className="mt-4 p-4 bg-slate-950/50 rounded-lg border border-slate-800 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
                            {/* Signal Strength */}
                            <div>
                                <h4 className="font-bold text-slate-300 mb-2 flex items-center gap-2">
                                    <Flame className="h-4 w-4 text-orange-400" /> Signal (Kekuatan Sinyal)
                                </h4>
                                <ul className="space-y-1 text-slate-400">
                                    <li><span className="text-lg">🔥🔥🔥</span> <span className="text-red-400 font-medium">Very Strong</span> — Score ≥ 80</li>
                                    <li><span className="text-lg">🔥🔥</span> <span className="text-orange-400 font-medium">Strong</span> — Score 60-79</li>
                                    <li><span className="text-lg">🔥</span> <span className="text-amber-400 font-medium">Moderate</span> — Score 45-59</li>
                                </ul>
                            </div>

                            {/* Conviction */}
                            <div>
                                <h4 className="font-bold text-slate-300 mb-2 flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-yellow-400" /> Conviction (Keyakinan)
                                </h4>
                                <ul className="space-y-1 text-slate-400">
                                    <li><Badge className="bg-red-600 text-white text-xs">🔥 VERY HIGH</Badge> — Score tinggi + pola akumulasi kuat</li>
                                    <li><Badge className="bg-orange-600 text-white text-xs">🔥 HIGH</Badge> — Score bagus + ada pola positif</li>
                                    <li><Badge className="bg-amber-600 text-white text-xs">⚡ MEDIUM</Badge> — Score cukup, tanpa distribusi</li>
                                    <li><Badge variant="outline" className="border-slate-600 text-slate-400 text-xs">LOW</Badge> — Score rendah atau ada distribusi</li>
                                </ul>
                            </div>

                            {/* Entry Zone */}
                            <div>
                                <h4 className="font-bold text-slate-300 mb-2 flex items-center gap-2">
                                    <Target className="h-4 w-4 text-emerald-400" /> Entry Zone (Zona Masuk)
                                </h4>
                                <ul className="space-y-1 text-slate-400">
                                    <li><Badge className="bg-emerald-600 text-white text-xs">🎯 SWEET SPOT</Badge> — Harga stabil (-1% s/d 3%) + Flow &gt; 50M (ideal!)</li>
                                    <li><Badge variant="outline" className="border-emerald-500/50 text-emerald-400 text-xs">✓ Acceptable</Badge> — Harga wajar (-3% s/d 5%)</li>
                                    <li><Badge variant="outline" className="border-red-500/50 text-red-400 text-xs">⚠ Risky</Badge> — Harga sudah terbang atau jatuh terlalu dalam</li>
                                </ul>
                            </div>

                            {/* Patterns */}
                            <div>
                                <h4 className="font-bold text-slate-300 mb-2 flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-purple-400" /> Patterns (Pola Flow)
                                </h4>
                                <ul className="space-y-1 text-slate-400">
                                    <li><span className="text-emerald-400">✅ Consistent Acc.</span> — Flow positif setiap hari (akumulasi konsisten)</li>
                                    <li><span className="text-emerald-400">🚀 Accelerating</span> — Pembelian makin kencang tiap hari</li>
                                    <li><span className="text-emerald-400">🔄 Trend Reversal</span> — Minggu lalu negatif, sekarang positif</li>
                                    <li><span className="text-amber-400">📊 Sideways Acc.</span> — Akumulasi perlahan tapi konsisten</li>
                                    <li><span className="text-red-400">⚡ Sudden Spike</span> — Lonjakan mendadak (hati-hati!)</li>
                                    <li><span className="text-red-400">❌ Distribution</span> — Bandar sedang jualan (hindari!)</li>
                                </ul>
                            </div>

                            {/* Momentum */}
                            <div>
                                <h4 className="font-bold text-slate-300 mb-2 flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-blue-400" /> Momentum (Kecepatan)
                                </h4>
                                <ul className="space-y-1 text-slate-400">
                                    <li><Badge variant="outline" className="border-emerald-500/50 text-emerald-400 text-xs">🚀 Accelerating</Badge> — Tenaga beli makin kencang</li>
                                    <li><Badge variant="outline" className="border-blue-500/50 text-blue-400 text-xs">→ Stable</Badge> — Tenaga beli konstan</li>
                                    <li><Badge variant="outline" className="border-amber-500/50 text-amber-400 text-xs">↓ Decelerating</Badge> — Tenaga beli melambat</li>
                                </ul>
                            </div>

                            {/* Flow */}
                            <div>
                                <h4 className="font-bold text-slate-300 mb-2 flex items-center gap-2">
                                    💰 Flow (Arus Uang)
                                </h4>
                                <ul className="space-y-1 text-slate-400">
                                    <li><span className="text-emerald-400 font-semibold">&gt; 50M</span> — Arus deras (warna hijau)</li>
                                    <li><span className="text-slate-300">0 - 50M</span> — Arus normal</li>
                                    <li className="text-xs text-slate-500 mt-2">Flow = Net fund flow dari data NeoBDM (Bandar + Asing)</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </CardHeader>

            <CardContent className="p-0">
                {error && (
                    <div className="p-4 bg-amber-950/20 border-b border-amber-900/30 flex items-center gap-2 text-amber-400 text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        {error}
                    </div>
                )}

                <div className="rounded-md border-0 overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-950/50">
                            <TableRow className="border-slate-800 hover:bg-slate-900">
                                <TableHead className="w-[60px] text-slate-400">#</TableHead>
                                <TableHead className="text-slate-400">Ticker</TableHead>
                                <TableHead className="text-slate-400">Price</TableHead>
                                <TableHead className="text-slate-400">Score</TableHead>
                                <TableHead className="text-slate-400">Signal</TableHead>
                                <TableHead className="text-slate-400">Conviction</TableHead>
                                <TableHead className="text-slate-400">Flow</TableHead>
                                <TableHead className="text-slate-400">Change</TableHead>
                                <TableHead className="text-slate-400">Entry Zone</TableHead>
                                <TableHead className="text-slate-400">Patterns</TableHead>
                                <TableHead className="text-slate-400">Momentum</TableHead>
                                <TableHead className="text-right text-slate-400">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {results.length === 0 && !isLoading && !error && (
                                <TableRow>
                                    <TableCell colSpan={12} className="h-32 text-center text-slate-500">
                                        No signals found with current filters. Try lowering min_score.
                                    </TableCell>
                                </TableRow>
                            )}

                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={12} className="h-32 text-center text-slate-500">
                                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                                        Scanning market for flow signals...
                                    </TableCell>
                                </TableRow>
                            )}

                            {results.map((item, index) => (
                                <TableRow key={item.symbol} className="border-slate-800 hover:bg-slate-900/50 group">
                                    <TableCell className="font-mono text-slate-500">#{index + 1}</TableCell>
                                    <TableCell className="font-bold text-lg text-indigo-400">
                                        {item.symbol}
                                        <div className="flex gap-1 mt-0.5">
                                            {item.unusual && <span title="Unusual Activity">🔥</span>}
                                            {item.pinky && <span title="Pinky Signal">🩷</span>}
                                            {item.crossing && <span title="MA Crossing">🤏</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-slate-200 font-medium">
                                            {item.price ? `Rp ${item.price.toLocaleString()}` : '-'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className={`
                                            text-xl font-bold
                                            ${item.signal_score >= 150 ? 'text-red-400' :
                                                item.signal_score >= 90 ? 'text-orange-400' :
                                                    item.signal_score >= 45 ? 'text-amber-400' : 'text-slate-400'}
                                        `}>
                                            {item.signal_score}
                                        </div>
                                    </TableCell>
                                    <TableCell>{getSignalStrengthIcon(item.signal_strength)}</TableCell>
                                    <TableCell>{getConvictionBadge(item.conviction)}</TableCell>
                                    <TableCell>
                                        <span className={item.flow > 50 ? "text-emerald-400 font-semibold" : "text-slate-300"}>
                                            {item.flow.toFixed(1)}M
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className={
                                            item.change > 3 ? 'text-red-400' :
                                                item.change > 0 ? 'text-emerald-400' :
                                                    item.change < -3 ? 'text-red-400' : 'text-slate-400'
                                        }>
                                            {item.change > 0 ? '+' : ''}{item.change.toFixed(2)}%
                                        </span>
                                    </TableCell>
                                    <TableCell>{getEntryZoneBadge(item.entry_zone)}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                                            {item.patterns && item.patterns.length > 0 ? (
                                                item.patterns.slice(0, 2).map((p, i) => (
                                                    <Badge
                                                        key={i}
                                                        variant="outline"
                                                        className={`text-xs ${p.score > 0 ? 'border-emerald-500/50 text-emerald-400' :
                                                            'border-red-500/50 text-red-400'
                                                            }`}
                                                    >
                                                        {p.icon} {p.name.replace('_', ' ').toLowerCase()}
                                                    </Badge>
                                                ))
                                            ) : (
                                                <span className="text-slate-600 text-xs">No patterns</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>{getMomentumBadge(item.momentum_status)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            size="sm"
                                            className="bg-indigo-600 hover:bg-indigo-500 text-white"
                                            onClick={() => handleInvestigate(item)}
                                        >
                                            <ArrowRightCircle className="h-4 w-4 mr-1" />
                                            Investigate
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
