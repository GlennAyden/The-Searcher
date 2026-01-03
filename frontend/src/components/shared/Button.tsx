/**
 * Button Component
 * 
 * Reusable button with consistent styling and variants
 */

import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    icon?: ReactNode;
    children: ReactNode;
}

const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 border-gray-600',
    outline: 'bg-transparent text-gray-700 hover:bg-gray-50 border-gray-300',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-50 border-transparent',
    danger: 'bg-red-600 text-white hover:bg-red-700 border-red-600'
};

const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
};

export function Button({
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    children,
    disabled,
    className = '',
    ...props
}: ButtonProps) {
    const isDisabled = disabled || loading;

    return (
        <button
            className={`
                inline-flex items-center justify-center gap-2
                font-medium rounded-lg border
                transition-colors duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
                ${variantClasses[variant]}
                ${sizeClasses[size]}
                ${className}
            `}
            disabled={isDisabled}
            {...props}
        >
            {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : icon}
            {children}
        </button>
    );
}

/**
 * Icon button variant
 */
export function IconButton({
    icon,
    variant = 'ghost',
    size = 'md',
    ...props
}: Omit<ButtonProps, 'children'> & { icon: ReactNode }) {
    return (
        <Button variant={variant} size={size} className="!p-2" {...props}>
            {icon}
        </Button>
    );
}
