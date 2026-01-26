"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
    AlphaHunterContextValue,
    InvestigationState,
    InvestigationsMap,
    Stage1Data,
    Stage2Data,
    Stage3Data,
    Stage4Data,
    StageStatus,
    PriceLadder,
    ScrapingQueueItem,
    createInitialInvestigation,
} from '../types';

const STORAGE_KEY = 'alpha_hunter_investigations';

// Create context with undefined default
const AlphaHunterContext = createContext<AlphaHunterContextValue | undefined>(undefined);

// Provider props
interface AlphaHunterProviderProps {
    children: ReactNode;
}

// Provider component
export function AlphaHunterProvider({ children }: AlphaHunterProviderProps) {
    const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
    const [investigations, setInvestigations] = useState<InvestigationsMap>(() => {
        if (typeof window === 'undefined') return {};
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                return JSON.parse(saved) as InvestigationsMap;
            }
        } catch (err) {
            console.error('Failed to load investigations from localStorage:', err);
        }
        return {};
    });
    // Save to localStorage on change
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(investigations));
        } catch (err) {
            console.error('Failed to save investigations to localStorage:', err);
        }
    }, [investigations]);

    // Navigation
    const selectTicker = useCallback((ticker: string | null) => {
        setSelectedTicker(ticker);
    }, []);

    const goToScanner = useCallback(() => {
        setSelectedTicker(null);
    }, []);

    // Investigation management
    const addInvestigation = useCallback((ticker: string, stage1Data: Stage1Data) => {
        setInvestigations(prev => ({
            ...prev,
            [ticker]: createInitialInvestigation(ticker, stage1Data),
        }));
        setSelectedTicker(ticker);
    }, []);

    const removeInvestigation = useCallback((ticker: string) => {
        setInvestigations(prev => {
            const next = { ...prev };
            delete next[ticker];
            return next;
        });
        if (selectedTicker === ticker) {
            setSelectedTicker(null);
        }
    }, [selectedTicker]);

    // Stage updates
    const updateStageStatus = useCallback((
        ticker: string,
        stage: 2 | 3 | 4,
        status: StageStatus,
        error?: string
    ) => {
        setInvestigations(prev => {
            const inv = prev[ticker];
            if (!inv) return prev;

            const stageKey = `stage${stage}` as 'stage2' | 'stage3' | 'stage4';
            return {
                ...prev,
                [ticker]: {
                    ...inv,
                    [stageKey]: {
                        ...inv[stageKey],
                        status,
                        error: error || null,
                        lastUpdated: new Date().toISOString(),
                    },
                },
            };
        });
    }, []);

    const updateStage2Data = useCallback((ticker: string, data: Stage2Data) => {
        setInvestigations(prev => {
            const inv = prev[ticker];
            if (!inv) return prev;

            return {
                ...prev,
                [ticker]: {
                    ...inv,
                    stage2: {
                        ...inv.stage2,
                        status: 'ready' as StageStatus,
                        data,
                        error: null,
                        lastUpdated: new Date().toISOString(),
                    },
                    stage3: {
                        ...inv.stage3,
                        status: 'idle' as StageStatus, // Unlock Stage 3
                    },
                    currentStage: 2,
                },
            };
        });
    }, []);

    const updateStage3Data = useCallback((ticker: string, data: Stage3Data) => {
        setInvestigations(prev => {
            const inv = prev[ticker];
            if (!inv) return prev;

            return {
                ...prev,
                [ticker]: {
                    ...inv,
                    stage3: {
                        ...inv.stage3,
                        status: 'ready' as StageStatus,
                        data,
                        error: null,
                        lastUpdated: new Date().toISOString(),
                    },
                    stage4: {
                        ...inv.stage4,
                        status: 'idle' as StageStatus, // Unlock Stage 4
                    },
                    currentStage: 3,
                },
            };
        });
    }, []);

    const updateStage4Data = useCallback((ticker: string, data: Stage4Data) => {
        setInvestigations(prev => {
            const inv = prev[ticker];
            if (!inv) return prev;

            return {
                ...prev,
                [ticker]: {
                    ...inv,
                    stage4: {
                        ...inv.stage4,
                        status: 'ready' as StageStatus,
                        data,
                        error: null,
                        lastUpdated: new Date().toISOString(),
                    },
                    currentStage: 4,
                },
            };
        });
    }, []);

    // Stage 3 scraping
    const setRecommendedLadders = useCallback((ticker: string, ladders: PriceLadder[]) => {
        setInvestigations(prev => {
            const inv = prev[ticker];
            if (!inv) return prev;

            // Pre-select critical and recommended ladders
            const selectedIds = ladders
                .filter(l => l.importance === 'critical' || l.importance === 'recommended')
                .map(l => l.id);

            return {
                ...prev,
                [ticker]: {
                    ...inv,
                    stage3: {
                        ...inv.stage3,
                        recommendedLadders: ladders,
                        selectedLadders: selectedIds,
                    },
                },
            };
        });
    }, []);

    const toggleLadderSelection = useCallback((ticker: string, ladderId: string) => {
        setInvestigations(prev => {
            const inv = prev[ticker];
            if (!inv) return prev;

            const currentSelection = inv.stage3.selectedLadders;
            const newSelection = currentSelection.includes(ladderId)
                ? currentSelection.filter(id => id !== ladderId)
                : [...currentSelection, ladderId];

            return {
                ...prev,
                [ticker]: {
                    ...inv,
                    stage3: {
                        ...inv.stage3,
                        selectedLadders: newSelection,
                    },
                },
            };
        });
    }, []);

    const updateScrapingQueue = useCallback((ticker: string, queue: ScrapingQueueItem[]) => {
        setInvestigations(prev => {
            const inv = prev[ticker];
            if (!inv) return prev;

            return {
                ...prev,
                [ticker]: {
                    ...inv,
                    stage3: {
                        ...inv.stage3,
                        scrapingQueue: queue,
                    },
                },
            };
        });
    }, []);

    // Stage 4 manual input
    const setManualDataInput = useCallback((ticker: string, data: string) => {
        setInvestigations(prev => {
            const inv = prev[ticker];
            if (!inv) return prev;

            return {
                ...prev,
                [ticker]: {
                    ...inv,
                    stage4: {
                        ...inv.stage4,
                        manualDataInput: data,
                    },
                },
            };
        });
    }, []);

    const skipStage4 = useCallback((ticker: string) => {
        setInvestigations(prev => {
            const inv = prev[ticker];
            if (!inv) return prev;

            return {
                ...prev,
                [ticker]: {
                    ...inv,
                    stage4: {
                        ...inv.stage4,
                        isSkipped: true,
                        status: 'ready' as StageStatus,
                    },
                },
            };
        });
    }, []);

    // Completion
    const markComplete = useCallback((
        ticker: string,
        recommendation: InvestigationState['finalRecommendation']
    ) => {
        setInvestigations(prev => {
            const inv = prev[ticker];
            if (!inv) return prev;

            return {
                ...prev,
                [ticker]: {
                    ...inv,
                    isComplete: true,
                    completedAt: new Date().toISOString(),
                    finalRecommendation: recommendation,
                },
            };
        });
    }, []);

    // Utility functions
    const getCurrentStageStatus = useCallback((ticker: string, stage: 2 | 3 | 4): StageStatus => {
        const inv = investigations[ticker];
        if (!inv) return 'locked';

        const stageKey = `stage${stage}` as 'stage2' | 'stage3' | 'stage4';
        return inv[stageKey].status;
    }, [investigations]);

    const canProceedToStage = useCallback((ticker: string, stage: 3 | 4): boolean => {
        const inv = investigations[ticker];
        if (!inv) return false;

        if (stage === 3) {
            return inv.stage2.status === 'ready';
        }
        if (stage === 4) {
            return inv.stage3.status === 'ready';
        }
        return false;
    }, [investigations]);

    const isAtScanner = selectedTicker === null;

    const value: AlphaHunterContextValue = {
        selectedTicker,
        investigations,
        isAtScanner,
        selectTicker,
        goToScanner,
        addInvestigation,
        removeInvestigation,
        updateStageStatus,
        updateStage2Data,
        updateStage3Data,
        updateStage4Data,
        setRecommendedLadders,
        toggleLadderSelection,
        updateScrapingQueue,
        setManualDataInput,
        skipStage4,
        markComplete,
        getCurrentStageStatus,
        canProceedToStage,
    };

    return (
        <AlphaHunterContext.Provider value={value}>
            {children}
        </AlphaHunterContext.Provider>
    );
}

// Hook to use the context
export function useAlphaHunter(): AlphaHunterContextValue {
    const context = useContext(AlphaHunterContext);
    if (context === undefined) {
        throw new Error('useAlphaHunter must be used within an AlphaHunterProvider');
    }
    return context;
}

// Export context for testing
export { AlphaHunterContext };
