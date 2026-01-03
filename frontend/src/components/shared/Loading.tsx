/**
 * Loading State Component
 * 
 * Consistent loading spinner/skeleton UI
 */

import { Loader2 } from 'lucide-react';

interface LoadingProps {
    text?: string;
    fullPage?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
};

export function Loading({ text = 'Loading...', fullPage = false, size = 'md' }: LoadingProps) {
    const content = (
        <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-500`} />
            <p className="text-sm text-gray-500">{text}</p>
        </div>
    );

    if (fullPage) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                {content}
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center py-12">
            {content}
        </div>
    );
}

/**
 * Skeleton loader for content placeholders
 */
export function Skeleton({ className = '' }: { className?: string }) {
    return (
        <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
    );
}

/**
 * Card skeleton for loading state
 */
export function CardSkeleton() {
    return (
        <div className="p-6 border rounded-lg space-y-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
        </div>
    );
}

/**
 * Table skeleton for loading state
 */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex gap-4">
                    {Array.from({ length: cols }).map((_, j) => (
                        <Skeleton key={j} className="h-10 flex-1" />
                    ))}
                </div>
            ))}
        </div>
    );
}
