/**
 * Card Component
 * 
 * Reusable card wrapper for consistent styling
 */

import { ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    className?: string;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    hover?: boolean;
}

const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
};

export function Card({ children, className = '', padding = 'md', hover = false }: CardProps) {
    const hoverClass = hover ? 'hover:shadow-lg transition-shadow cursor-pointer' : '';

    return (
        <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${paddingClasses[padding]} ${hoverClass} ${className}`}>
            {children}
        </div>
    );
}

/**
 * Card with header and content sections
 */
interface CardWithHeaderProps {
    title: string;
    subtitle?: string;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
}

export function CardWithHeader({ title, subtitle, action, children, className = '' }: CardWithHeaderProps) {
    return (
        <Card className={className} padding="none">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                    {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
                </div>
                {action && <div>{action}</div>}
            </div>
            <div className="p-6">
                {children}
            </div>
        </Card>
    );
}

/**
 * Stat card for displaying metrics
 */
interface StatCardProps {
    label: string;
    value: string | number;
    change?: {
        value: number;
        isPositive: boolean;
    };
    icon?: ReactNode;
    loading?: boolean;
}

export function StatCard({ label, value, change, icon, loading }: StatCardProps) {
    if (loading) {
        return (
            <Card>
                <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                    <div className="h-8 bg-gray-200 rounded w-1/2" />
                </div>
            </Card>
        );
    }

    return (
        <Card>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-gray-600 mb-1">{label}</p>
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                    {change && (
                        <p className={`text-sm mt-1 ${change.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            {change.isPositive ? '+' : ''}{change.value}%
                        </p>
                    )}
                </div>
                {icon && (
                    <div className="p-2 bg-blue-50 rounded-lg">
                        {icon}
                    </div>
                )}
            </div>
        </Card>
    );
}
