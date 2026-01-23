"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart, Bar, CartesianGrid, Legend } from 'recharts';

interface PullbackHealthPanelProps {
    ticker: string;
}

interface TrackingLog {
    date: string;
    price: number;
    volume: number;
    price_chg: number;
    vol_chg: number;
    status: string;
}

interface HealthData {
    ticker: string;
    health_score: number;
    verdict: string;
    days_tracked: number;
    log: TrackingLog[];
}

export default function PullbackHealthPanel({ ticker }: PullbackHealthPanelProps) {
    const [data, setData] = useState<HealthData | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (ticker) fetchData();
    }, [ticker]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`http://localhost:8000/api/alpha-hunter/health/${ticker}`);
            const json = await res.json();
            if (!json.error) setData(json);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <div className="p-10 text-center animate-pulse text-slate-500">Analyzing Pullback Health...</div>;
    if (!data) return <div className="p-10 text-center text-slate-500">No tracking data available.</div>;

    const getScoreColor = (score: number) => {
        if (score >= 80) return "text-emerald-400 bg-emerald-950/20 border-emerald-500/50";
        if (score >= 50) return "text-amber-400 bg-amber-950/20 border-amber-500/50";
        return "text-red-400 bg-red-950/20 border-red-500/50";
    };

    return (
        <div className="grid grid-cols-3 gap-6">
            {/* Left Col: Verdict Card */}
            <Card className="col-span-1 bg-slate-900 border-slate-800 h-full">
                <CardContent className="pt-6 flex flex-col items-center justify-center h-full text-center">
                    <div className="text-sm text-slate-400 uppercase tracking-wider mb-2">Health Score</div>
                    <div className={`text-6xl font-black mb-2 px-6 py-2 rounded-xl border-2 ${getScoreColor(data.health_score)}`}>
                        {data.health_score}
                    </div>
                    <div className="text-xl font-bold text-slate-100">{data.verdict}</div>
                    <p className="text-sm text-slate-500 mt-2 px-4">
                        Based on {data.days_tracked} days tracking since spike.
                    </p>

                    <div className="w-full mt-6 px-4">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>Danger</span>
                            <span>Healthy</span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-1000 ${data.health_score >= 80 ? 'bg-emerald-500' :
                                        data.health_score >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                    }`}
                                style={{ width: `${data.health_score}%` }}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Center/Right Col: Chart & Table */}
            <div className="col-span-2 space-y-6">

                {/* 1. Correlation Chart */}
                <Card className="bg-slate-900 border-slate-800 p-4 h-[300px]">
                    <h4 className="text-slate-400 text-xs uppercase mb-4 font-bold tracking-wider">Price vs Volume Correlation</h4>
                    <ResponsiveContainer width="100%" height="90%">
                        <ComposedChart data={data.log}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickFormatter={(v) => v.substring(5)} />
                            <YAxis yAxisId="left" stroke="#94a3b8" fontSize={10} domain={['auto', 'auto']} />
                            <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={10} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                            />
                            <Legend />
                            <Bar yAxisId="right" dataKey="volume" fill="#334155" opacity={0.5} name="Volume" />
                            <Line yAxisId="left" type="monotone" dataKey="price" stroke="#818cf8" strokeWidth={2} dot={true} name="Price" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </Card>

                {/* 2. Log Table */}
                <Card className="bg-slate-900 border-slate-800">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-slate-800 hover:bg-slate-900">
                                <TableHead className="text-slate-400 h-8 text-xs">Date</TableHead>
                                <TableHead className="text-slate-400 h-8 text-xs">Price</TableHead>
                                <TableHead className="text-slate-400 h-8 text-xs">Vol Chg</TableHead>
                                <TableHead className="text-slate-400 h-8 text-xs">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {[...data.log].reverse().slice(0, 5).map((row, i) => (
                                <TableRow key={i} className="border-slate-800 hover:bg-slate-900/50">
                                    <TableCell className="text-xs text-slate-300 py-2">{row.date}</TableCell>
                                    <TableCell className="text-xs py-2">
                                        <span className={row.price_chg >= 0 ? "text-emerald-400" : "text-red-400"}>
                                            {row.price} ({row.price_chg > 0 ? '+' : ''}{row.price_chg}%)
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-400 py-2">{row.vol_chg}%</TableCell>
                                    <TableCell className="py-2">
                                        <Badge variant="outline" className={`text-[10px] h-5 ${row.status === 'HEALTHY' || row.status === 'STRONG' ? 'border-emerald-500/50 text-emerald-400' :
                                                row.status === 'DANGER' ? 'border-red-500/50 text-red-400' :
                                                    'border-slate-600 text-slate-400'
                                            }`}>
                                            {row.status}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            </div>
        </div>
    );
}
