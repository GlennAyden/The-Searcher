'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clipboard, Loader2, Save, X } from 'lucide-react';

type DoneDetailPasteModalProps = {
    open: boolean;
    saving: boolean;
    pasteTickerInput: string;
    pasteDateInput: string;
    pasteData: string;
    onClose: () => void;
    onPasteTickerChange: (value: string) => void;
    onPasteDateChange: (value: string) => void;
    onPasteDataChange: (value: string) => void;
    onPasteFromClipboard: () => void;
    onSave: () => void;
};

export function DoneDetailPasteModal({
    open,
    saving,
    pasteTickerInput,
    pasteDateInput,
    pasteData,
    onClose,
    onPasteTickerChange,
    onPasteDateChange,
    onPasteDataChange,
    onPasteFromClipboard,
    onSave
}: DoneDetailPasteModalProps) {
    if (!open) return null;

    const disableSave = saving || !pasteData || !pasteTickerInput || !pasteDateInput;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-xl bg-slate-800 border-slate-600">
                <CardHeader className="py-3">
                    <CardTitle className="flex items-center justify-between text-base">
                        <span>Paste Done Detail Data</span>
                        <Button variant="ghost" size="sm" onClick={onClose}>
                            <X className="w-4 h-4" />
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Ticker</label>
                            <Input
                                value={pasteTickerInput}
                                onChange={(e) => onPasteTickerChange(e.target.value.toUpperCase())}
                                placeholder="ANTM"
                                className="bg-slate-700 border-slate-600 uppercase"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Trade Date</label>
                            <Input
                                type="date"
                                value={pasteDateInput}
                                onChange={(e) => onPasteDateChange(e.target.value)}
                                className="bg-slate-700 border-slate-600"
                            />
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs text-slate-400">Trade Data (TSV from NeoBDM)</label>
                            <Button variant="outline" size="sm" onClick={onPasteFromClipboard} className="h-6 text-xs">
                                <Clipboard className="w-3 h-3 mr-1" />
                                Paste
                            </Button>
                        </div>
                        <textarea
                            value={pasteData}
                            onChange={(e) => onPasteDataChange(e.target.value)}
                            placeholder="Paste TSV data from NeoBDM..."
                            className="w-full h-36 bg-slate-700 border border-slate-600 rounded p-2 text-xs font-mono resize-none text-white"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                            {pasteData ? `${pasteData.split('\n').length} lines` : 'Expected format: Time, Stock, Brd, Price, Qty, BT, BC, SC, ST'}
                        </p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={onSave}
                            disabled={disableSave}
                            className="bg-teal-600 hover:bg-teal-700"
                        >
                            {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                            Save Data
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
