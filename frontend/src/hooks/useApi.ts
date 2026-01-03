/**
 * Generic API hook with loading and error states
 * 
 * Provides consistent loading/error handling for any async API call
 */

import { useState, useCallback, useEffect, DependencyList } from 'react';

export interface UseApiState<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
}

export interface UseApiReturn<T, Args extends any[]> {
    data: T | null;
    loading: boolean;
    error: string | null;
    execute: (...args: Args) => Promise<void>;
    reset: () => void;
}

/**
 * Generic hook for API calls with loading/error state management
 * 
 * @param apiFunction - The API function to call
 * @param options - Configuration options
 * 
 * @example
 * ```tsx
 * const { data, loading, error, execute } = useApi(dashboardApi.getDashboardStats);
 * 
 * useEffect(() => {
 *   execute(ticker, startDate, endDate);
 * }, [ticker]);
 * ```
 */
export function useApi<T, Args extends any[]>(
    apiFunction: (...args: Args) => Promise<T>,
    options?: {
        initialData?: T;
        onSuccess?: (data: T) => void;
        onError?: (error: Error) => void;
    }
): UseApiReturn<T, Args> {
    const [state, setState] = useState<UseApiState<T>>({
        data: options?.initialData ?? null,
        loading: false,
        error: null,
    });

    const execute = useCallback(async (...args: Args) => {
        setState(prev => ({ ...prev, loading: true, error: null }));

        try {
            const result = await apiFunction(...args);
            setState({ data: result, loading: false, error: null });
            options?.onSuccess?.(result);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An error occurred';
            setState({ data: null, loading: false, error: errorMessage });
            options?.onError?.(err instanceof Error ? err : new Error(errorMessage));
        }
    }, [apiFunction, options]);

    const reset = useCallback(() => {
        setState({
            data: options?.initialData ?? null,
            loading: false,
            error: null,
        });
    }, [options?.initialData]);

    return {
        ...state,
        execute,
        reset,
    };
}

/**
 * Hook for API calls that auto-execute on mount or dependency change
 * 
 * @example
 * ```tsx
 * const { data, loading, error, refetch } = useApiQuery(
 *   () => dashboardApi.getDashboardStats(ticker),
 *   [ticker]
 * );
 * ```
 */
export function useApiQuery<T>(
    apiFunction: () => Promise<T>,
    deps: DependencyList,
    options?: {
        enabled?: boolean;
        onSuccess?: (data: T) => void;
        onError?: (error: Error) => void;
    }
): UseApiReturn<T, []> & { refetch: () => void } {
    const { data, loading, error, execute, reset } = useApi(apiFunction, options);

    // Auto-execute on mount or when dependencies change
    const refetch = useCallback(() => {
        if (options?.enabled !== false) {
            execute();
        }
    }, [execute, options?.enabled]);

    // Execute on mount and dependency changes
    useEffect(() => {
        refetch();
    }, [refetch, ...deps]);

    return {
        data,
        loading,
        error,
        execute,
        reset,
        refetch,
    };
}
