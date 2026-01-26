'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Database, Plus, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { brokerFiveApi, type BrokerFiveItem } from '@/services/api/brokerFive';

type BrokerFiveSectionProps = {
    ticker: string;
    tickerError: string | null;
};

const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error && err.message) return err.message;
    if (typeof err === 'string' && err.trim()) return err;
    return fallback;
};

const sortBrokerFiveItems = (items: BrokerFiveItem[]) => {
    return [...items].sort((a, b) => a.broker_code.localeCompare(b.broker_code));
};

export function BrokerFiveSection({ ticker, tickerError }: BrokerFiveSectionProps) {
    const activeTicker = ticker.trim().toUpperCase();
    const canUseBrokerFive = activeTicker.length >= 4 && !tickerError;

    const [items, setItems] = useState<BrokerFiveItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [newCode, setNewCode] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingCode, setEditingCode] = useState('');

    const loadBrokerFive = useCallback(async (targetTicker?: string) => {
        const loadTicker = (targetTicker || activeTicker).trim().toUpperCase();
        if (loadTicker.length < 4 || tickerError) {
            setItems([]);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await brokerFiveApi.getBrokerFiveList(loadTicker);
            setItems(sortBrokerFiveItems(data.items || []));
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load Broker 5% list'));
        } finally {
            setLoading(false);
        }
    }, [activeTicker, tickerError]);

    const handleAdd = async () => {
        const code = newCode.trim().toUpperCase();
        if (!canUseBrokerFive) {
            setError('Masukkan ticker yang valid terlebih dahulu.');
            return;
        }
        if (!code) return;
        setSaving(true);
        setError(null);
        try {
            const data = await brokerFiveApi.createBrokerFive({ ticker: activeTicker, broker_code: code });
            setItems((prev) => sortBrokerFiveItems([...prev, data.item]));
            setNewCode('');
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to add broker code'));
        } finally {
            setSaving(false);
        }
    };

    const handleStartEdit = (item: BrokerFiveItem) => {
        setEditingId(item.id);
        setEditingCode(item.broker_code);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditingCode('');
    };

    const handleSave = async () => {
        if (!editingId) return;
        if (!canUseBrokerFive) {
            setError('Masukkan ticker yang valid terlebih dahulu.');
            return;
        }
        const code = editingCode.trim().toUpperCase();
        if (!code) return;
        setSaving(true);
        setError(null);
        try {
            const data = await brokerFiveApi.updateBrokerFive(editingId, { ticker: activeTicker, broker_code: code });
            setItems((prev) =>
                sortBrokerFiveItems(prev.map((item) => (item.id === editingId ? data.item : item)))
            );
            handleCancelEdit();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to update broker code'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!canUseBrokerFive) {
            setError('Masukkan ticker yang valid terlebih dahulu.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await brokerFiveApi.deleteBrokerFive(id, activeTicker);
            setItems((prev) => prev.filter((item) => item.id !== id));
            if (editingId === id) {
                handleCancelEdit();
            }
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to delete broker code'));
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        if (!canUseBrokerFive) {
            setItems([]);
            setEditingId(null);
            setEditingCode('');
            setError(null);
            return;
        }
        loadBrokerFive(activeTicker);
    }, [activeTicker, canUseBrokerFive, loadBrokerFive]);

    return (
        <section className="bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between gap-4 border-b border-zinc-800/60 pb-3 mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <Database className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold tracking-tight">Broker 5%</h3>
                        <p className="text-[10px] text-zinc-500 font-medium">Kelola kode broker untuk fokus 5%</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 font-bold">
                        {canUseBrokerFive ? activeTicker : 'Pilih ticker'}
                    </span>
                    <span className="text-[10px] text-zinc-600 font-bold">{items.length} codes</span>
                    <button
                        onClick={() => loadBrokerFive(activeTicker)}
                        disabled={loading || !canUseBrokerFive}
                        className={cn(
                            'p-2 rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white transition-colors',
                            (loading || !canUseBrokerFive) && 'opacity-60 cursor-not-allowed'
                        )}
                    >
                        <RefreshCcw className={cn('w-4 h-4', loading && 'animate-spin')} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
                <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Tambah kode broker</label>
                    <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 focus-within:border-blue-500/50 transition-colors">
                        <input
                            type="text"
                            value={newCode}
                            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                            placeholder="YP, PD, AK..."
                            className="bg-transparent border-none outline-none text-sm font-bold w-full uppercase placeholder:text-zinc-700 font-mono"
                            disabled={saving || !canUseBrokerFive}
                        />
                        <button
                            onClick={handleAdd}
                            disabled={saving || !newCode.trim() || !canUseBrokerFive}
                            className={cn(
                                'p-2 rounded-lg border transition-colors',
                                saving || !newCode.trim() || !canUseBrokerFive
                                    ? 'border-zinc-800 text-zinc-600 cursor-not-allowed'
                                    : 'border-blue-500/30 text-blue-400 hover:text-blue-300 hover:border-blue-500/60'
                            )}
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    {error && (
                        <div className="text-[10px] text-red-400 font-bold px-1">{error}</div>
                    )}
                </div>

                <div className="space-y-2">
                    {!canUseBrokerFive ? (
                        <div className="text-[10px] text-zinc-600 italic">Masukkan ticker valid untuk melihat daftar broker 5%.</div>
                    ) : loading && items.length === 0 ? (
                        <div className="text-[10px] text-zinc-600 italic">Loading broker list...</div>
                    ) : items.length === 0 ? (
                        <div className="text-[10px] text-zinc-600 italic">Belum ada kode broker.</div>
                    ) : (
                        items.map((item) => (
                            <div
                                key={item.id}
                                className="flex items-center justify-between gap-2 bg-zinc-900/40 border border-zinc-800/50 rounded-xl px-3 py-2"
                            >
                                {editingId === item.id ? (
                                    <input
                                        type="text"
                                        value={editingCode}
                                        onChange={(e) => setEditingCode(e.target.value.toUpperCase())}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSave();
                                            if (e.key === 'Escape') handleCancelEdit();
                                        }}
                                        className="bg-transparent border-none outline-none text-sm font-bold uppercase placeholder:text-zinc-700 font-mono flex-1"
                                        autoFocus
                                    />
                                ) : (
                                    <span className="text-sm font-black font-mono text-zinc-200">{item.broker_code}</span>
                                )}

                                <div className="flex items-center gap-2">
                                    {editingId === item.id ? (
                                        <>
                                            <button
                                                onClick={handleSave}
                                                disabled={saving || !editingCode.trim()}
                                                className={cn(
                                                    'px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors',
                                                    saving || !editingCode.trim()
                                                        ? 'border-zinc-800 text-zinc-600 cursor-not-allowed'
                                                        : 'border-emerald-500/30 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/60'
                                                )}
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={handleCancelEdit}
                                                className="px-2 py-1 rounded-lg text-[10px] font-bold border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleStartEdit(item)}
                                                disabled={saving}
                                                className={cn(
                                                    'px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors',
                                                    saving
                                                        ? 'border-zinc-800 text-zinc-600 cursor-not-allowed'
                                                        : 'border-blue-500/30 text-blue-400 hover:text-blue-300 hover:border-blue-500/60'
                                                )}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                disabled={saving}
                                                className={cn(
                                                    'px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors',
                                                    saving
                                                        ? 'border-zinc-800 text-zinc-600 cursor-not-allowed'
                                                        : 'border-red-500/30 text-red-400 hover:text-red-300 hover:border-red-500/60'
                                                )}
                                            >
                                                Delete
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </section>
    );
}
