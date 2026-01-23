"use client";

import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, AreaData, Time, AreaSeries, IChartApi } from 'lightweight-charts';
import { MarketCapHistory } from '@/services/api/priceVolume';

interface MarketCapChartProps {
    data: MarketCapHistory[];
    ticker: string;
}

export function MarketCapChart({ data, ticker }: MarketCapChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    useEffect(() => {
        if (!chartContainerRef.current || data.length === 0) return;

        // Cleanup previous chart
        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
        }

        // Create chart
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#9ca3af',
            },
            grid: {
                vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
                horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 200,
            rightPriceScale: {
                borderVisible: false,
            },
            timeScale: {
                borderVisible: false,
                timeVisible: true,
            },
            crosshair: {
                horzLine: {
                    visible: true,
                    labelVisible: true,
                },
                vertLine: {
                    visible: true,
                    labelVisible: true,
                },
            },
        });

        chartRef.current = chart;

        // Create area series using new API
        const areaSeries = chart.addSeries(AreaSeries, {
            lineColor: '#06b6d4',
            topColor: 'rgba(6, 182, 212, 0.4)',
            bottomColor: 'rgba(6, 182, 212, 0.0)',
            lineWidth: 2,
            priceFormat: {
                type: 'custom',
                formatter: (price: number) => {
                    if (price >= 1e12) return `${(price / 1e12).toFixed(1)}T`;
                    if (price >= 1e9) return `${(price / 1e9).toFixed(1)}B`;
                    if (price >= 1e6) return `${(price / 1e6).toFixed(1)}M`;
                    return price.toFixed(0);
                },
            },
        });

        // Format data for chart
        const chartData: AreaData<Time>[] = data.map(item => ({
            time: item.date as Time,
            value: item.market_cap,
        }));

        areaSeries.setData(chartData);

        // Fit content
        chart.timeScale().fitContent();

        // Handle resize
        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
            }
        };
    }, [data, ticker]);

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[200px] text-zinc-500 text-sm">
                No market cap history available
            </div>
        );
    }

    return <div ref={chartContainerRef} className="w-full" />;
}

export default MarketCapChart;
