/**
 * Error State Component
 * 
 * Consistent error display UI
 */

import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorDisplayProps {
    message?: string;
    title?: string;
    onRetry?: () => void;
    fullPage?: boolean;
}

export function ErrorDisplay({
    message = 'Something went wrong. Please try again.',
    title = 'Error',
    onRetry,
    fullPage = false
}: ErrorDisplayProps) {
    const content = (
        <div className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="p-3 bg-red-100 rounded-full">
                <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
                <p className="text-sm text-gray-600 max-w-md">{message}</p>
            </div>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                </button>
            )}
        </div>
    );

    if (fullPage) {
        return (
            <div className="flex items-center justify-center min-h-screen p-4">
                {content}
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center py-12 p-4">
            {content}
        </div>
    );
}

/**
 * Inline error message (for form fields, etc.)
 */
export function ErrorMessage({ message }: { message: string }) {
    return (
        <div className="flex items-center gap-2 text-sm text-red-600 mt-1">
            <AlertCircle className="w-4 h-4" />
            <span>{message}</span>
        </div>
    );
}

/**
 * Error banner (for page-level errors)
 */
export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
    return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                    <p className="text-sm text-red-800">{message}</p>
                </div>
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="text-red-600 hover:text-red-800"
                        aria-label="Dismiss"
                    >
                        ×
                    </button>
                )}
            </div>
        </div>
    );
}
