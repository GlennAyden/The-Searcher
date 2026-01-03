/**
 * Empty State Component
 * 
 * Display when no data is available
 */

import { FileQuestion, Search, Database } from 'lucide-react';
import { ReactNode } from 'react';

type IconType = 'search' | 'file' | 'database';

interface EmptyStateProps {
    icon?: IconType | ReactNode;
    title?: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

const iconMap: Record<IconType, React.ComponentType<any>> = {
    search: Search,
    file: FileQuestion,
    database: Database
};

export function EmptyState({
    icon = 'search',
    title = 'No data found',
    description = 'Try adjusting your filters or search criteria.',
    action
}: EmptyStateProps) {
    const IconComponent = typeof icon === 'string' && icon in iconMap ? iconMap[icon as IconType] : null;

    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="p-4 bg-gray-100 rounded-full mb-4">
                {IconComponent ? (
                    <IconComponent className="w-12 h-12 text-gray-400" />
                ) : (
                    icon
                )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
            <p className="text-sm text-gray-600 max-w-sm mb-6">{description}</p>
            {action && (
                <button
                    onClick={action.onClick}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}

/**
 * No results variant
 */
export function NoResults({ searchTerm }: { searchTerm?: string }) {
    return (
        <EmptyState
            icon="search"
            title="No results found"
            description={
                searchTerm
                    ? `No results for "${searchTerm}". Try different keywords.`
                    : 'No results match your current filters.'
            }
        />
    );
}

/**
 * No data variant
 */
export function NoData({ message }: { message?: string }) {
    return (
        <EmptyState
            icon="database"
            title="No data available"
            description={message || 'There is no data to display at the moment.'}
        />
    );
}
