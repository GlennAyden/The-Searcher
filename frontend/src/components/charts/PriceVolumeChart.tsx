'use client';

import React, { useEffect, useRef } from 'react';
import {
    createChart,
    IChartApi,
    ColorType,
    CrosshairMode,
    Time,
    CandlestickSeries,
    HistogramSeries,
    LineSeries,
    SeriesMarker,
    createSeriesMarkers
} from 'lightweight-charts';
import { OHLCVRecord, MARecord, SpikeMarker } from '@/services/api/priceVolume';

interface PriceVolumeChartProps {
    data: OHLCVRecord[];
    ma5: MARecord[];
    ma10: MARecord[];
    ma20: MARecord[];
    volumeMa20: MARecord[];
    ticker: string;
    spikeMarkers?: SpikeMarker[];
}

export const PriceVolumeChart: React.FC<PriceVolumeChartProps> = ({
    data,
    ma5,
    ma10,
    ma20,
    volumeMa20,
    ticker,
    spikeMarkers = []
}) => {
    const priceChartRef = useRef<HTMLDivElement>(null);
    const volumeChartRef = useRef<HTMLDivElement>(null);
    const priceChartApiRef = useRef<IChartApi | null>(null);
    const volumeChartApiRef = useRef<IChartApi | null>(null);

    useEffect(() => {
        if (!priceChartRef.current || !volumeChartRef.current || !data.length) return;

        // Cleanup previous charts
        if (priceChartApiRef.current) {
            priceChartApiRef.current.remove();
            priceChartApiRef.current = null;
        }
        if (volumeChartApiRef.current) {
            volumeChartApiRef.current.remove();
            volumeChartApiRef.current = null;
        }

        const priceContainer = priceChartRef.current;
        const volumeContainer = volumeChartRef.current;
        const { width } = priceContainer.getBoundingClientRect();

        // Common chart options
        const commonOptions = {
            layout: {
                background: { type: ColorType.Solid, color: '#09090b' },
                textColor: '#a1a1aa',
            },
            grid: {
                vertLines: { color: '#27272a', style: 1 },
                horzLines: { color: '#27272a', style: 1 },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: {
                    color: '#52525b',
                    labelBackgroundColor: '#3f3f46',
                },
                horzLine: {
                    color: '#52525b',
                    labelBackgroundColor: '#3f3f46',
                },
            },
            rightPriceScale: {
                borderColor: '#27272a',
            },
            timeScale: {
                borderColor: '#27272a',
                timeVisible: true,
                secondsVisible: false,
            },
            handleScale: {
                axisPressedMouseMove: { time: true, price: true },
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: true,
            },
        };

        // ===== PRICE CHART =====
        const priceChart = createChart(priceContainer, {
            ...commonOptions,
            width,
            height: 350,
        });
        priceChartApiRef.current = priceChart;

        // Candlestick series
        const candlestickSeries = priceChart.addSeries(CandlestickSeries, {
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderUpColor: '#22c55e',
            borderDownColor: '#ef4444',
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
        });
        candlestickSeries.setData(data.map(d => ({
            time: d.time as Time,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
        })));

        // Set spike markers on candlestick series if available
        if (spikeMarkers.length > 0) {
            const markers: SeriesMarker<Time>[] = spikeMarkers.map(marker => ({
                time: marker.time as Time,
                position: marker.position as 'aboveBar' | 'belowBar',
                shape: marker.shape as 'arrowUp' | 'arrowDown',
                color: marker.color,
                text: marker.text,
            }));
            createSeriesMarkers(candlestickSeries, markers);
        }

        // MA lines on price chart
        if (ma5.length > 0) {
            const ma5Series = priceChart.addSeries(LineSeries, {
                color: '#3b82f6',
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: false,
            });
            ma5Series.setData(ma5.map(d => ({ time: d.time as Time, value: d.value })));
        }

        if (ma10.length > 0) {
            const ma10Series = priceChart.addSeries(LineSeries, {
                color: '#f59e0b',
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: false,
            });
            ma10Series.setData(ma10.map(d => ({ time: d.time as Time, value: d.value })));
        }

        if (ma20.length > 0) {
            const ma20Series = priceChart.addSeries(LineSeries, {
                color: '#8b5cf6',
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: false,
            });
            ma20Series.setData(ma20.map(d => ({ time: d.time as Time, value: d.value })));
        }

        // ===== VOLUME CHART =====
        const volumeChart = createChart(volumeContainer, {
            ...commonOptions,
            width,
            height: 150,
            timeScale: {
                ...commonOptions.timeScale,
                visible: true,
            },
        });
        volumeChartApiRef.current = volumeChart;

        // Volume histogram - starts from 0
        const volumeSeries = volumeChart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            base: 0,
        });

        // Color volume bars based on price direction
        const volumeData = data.map((d, i) => {
            const prevClose = i > 0 ? data[i - 1].close : d.open;
            const isUp = d.close >= prevClose;
            return {
                time: d.time as Time,
                value: d.volume,
                color: isUp ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)',
            };
        });
        volumeSeries.setData(volumeData);

        // Volume MA20 line
        if (volumeMa20.length > 0) {
            const volumeMa20Series = volumeChart.addSeries(LineSeries, {
                color: '#f59e0b',
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: false,
            });
            volumeMa20Series.setData(volumeMa20.map(d => ({ time: d.time as Time, value: d.value })));
        }

        // Sync time scales between charts
        priceChart.timeScale().fitContent();
        volumeChart.timeScale().fitContent();

        // Sync scrolling and scaling between charts
        const syncTimeScales = (source: IChartApi, target: IChartApi) => {
            source.timeScale().subscribeVisibleLogicalRangeChange((range) => {
                if (range) {
                    target.timeScale().setVisibleLogicalRange(range);
                }
            });
        };

        syncTimeScales(priceChart, volumeChart);
        syncTimeScales(volumeChart, priceChart);

        // Sync crosshair between charts using series references
        priceChart.subscribeCrosshairMove((param) => {
            if (param.time) {
                volumeChart.setCrosshairPosition(NaN, param.time, volumeSeries);
            } else {
                volumeChart.clearCrosshairPosition();
            }
        });

        volumeChart.subscribeCrosshairMove((param) => {
            if (param.time) {
                priceChart.setCrosshairPosition(NaN, param.time, candlestickSeries);
            } else {
                priceChart.clearCrosshairPosition();
            }
        });

        // Handle resize
        const handleResize = () => {
            if (priceChartRef.current && volumeChartRef.current) {
                const newWidth = priceChartRef.current.getBoundingClientRect().width;
                priceChart.applyOptions({ width: newWidth });
                volumeChart.applyOptions({ width: newWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (priceChartApiRef.current) {
                priceChartApiRef.current.remove();
                priceChartApiRef.current = null;
            }
            if (volumeChartApiRef.current) {
                volumeChartApiRef.current.remove();
                volumeChartApiRef.current = null;
            }
        };
    }, [data, ma5, ma10, ma20, volumeMa20, spikeMarkers]);

    return (
        <div className="w-full h-full flex flex-col">
            {/* Legend */}
            <div className="flex items-center gap-6 px-4 py-2 bg-zinc-900/50 border-b border-zinc-800 text-xs">
                <span className="font-bold text-zinc-100">{ticker}</span>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-0.5 bg-blue-500"></div>
                        <span className="text-zinc-400">MA5</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-0.5 bg-amber-500"></div>
                        <span className="text-zinc-400">MA10</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-0.5 bg-violet-500"></div>
                        <span className="text-zinc-400">MA20</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-0.5 bg-amber-500"></div>
                        <span className="text-zinc-400">Vol MA20</span>
                    </div>
                    {spikeMarkers.length > 0 && (
                        <div className="flex items-center gap-1.5 border-l border-zinc-700 pl-4">
                            <span className="text-zinc-400">Spikes:</span>
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-zinc-500">2-3x</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                                <span className="text-zinc-500">3-5x</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                <span className="text-zinc-500">&gt;5x</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Price Chart */}
            <div
                ref={priceChartRef}
                className="w-full"
                style={{ height: '350px' }}
            />

            {/* Divider */}
            <div className="h-px bg-zinc-800" />

            {/* Volume Chart */}
            <div
                ref={volumeChartRef}
                className="w-full"
                style={{ height: '150px' }}
            />
        </div>
    );
};
