"use client";

import React, { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Lock,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Pause,
    ChevronDown,
    ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StageStatus } from "../../types";

interface StageCardProps {
    stageNumber: 1 | 2 | 3 | 4;
    title: string;
    description?: string;
    status: StageStatus;
    isCollapsible?: boolean;
    defaultCollapsed?: boolean;
    children: ReactNode;
    onCollapsedChange?: (collapsed: boolean) => void;
}

export default function StageCard({
    stageNumber,
    title,
    description,
    status,
    isCollapsible = false,
    defaultCollapsed = false,
    children,
    onCollapsedChange
}: StageCardProps) {
    const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

    const handleToggle = () => {
        if (isCollapsible) {
            const next = !isCollapsed;
            setIsCollapsed(next);
            onCollapsedChange?.(next);
        }
    };

    // Status configuration
    const statusConfig = {
        locked: {
            icon: Lock,
            label: "Locked",
            color: "text-slate-500",
            bgColor: "bg-slate-800/50",
            borderColor: "border-slate-700",
            badgeClass: "bg-slate-800 text-slate-500 border-slate-600"
        },
        idle: {
            icon: Pause,
            label: "Ready",
            color: "text-slate-400",
            bgColor: "bg-slate-900/50",
            borderColor: "border-slate-800",
            badgeClass: "bg-slate-800 text-slate-400 border-slate-600"
        },
        loading: {
            icon: Loader2,
            label: "Processing",
            color: "text-amber-400",
            bgColor: "bg-slate-900/50",
            borderColor: "border-amber-500/30",
            badgeClass: "bg-amber-500/20 text-amber-400 border-amber-500/50"
        },
        ready: {
            icon: CheckCircle2,
            label: "Complete",
            color: "text-emerald-400",
            bgColor: "bg-slate-900/50",
            borderColor: "border-emerald-500/30",
            badgeClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
        },
        error: {
            icon: AlertCircle,
            label: "Error",
            color: "text-red-400",
            bgColor: "bg-slate-900/50",
            borderColor: "border-red-500/30",
            badgeClass: "bg-red-500/20 text-red-400 border-red-500/50"
        }
    };

    const config = statusConfig[status];
    const StatusIcon = config.icon;

    // Locked state renders differently
    if (status === 'locked') {
        return (
            <Card className={cn(
                "border transition-all opacity-60",
                config.bgColor,
                config.borderColor
            )}>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                                <Lock className="w-4 h-4 text-slate-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-500">
                                    Stage {stageNumber}: {title}
                                </h3>
                                <p className="text-sm text-slate-600">
                                    Complete Stage {stageNumber - 1} first
                                </p>
                            </div>
                        </div>
                        <Badge variant="outline" className={config.badgeClass}>
                            <Lock className="w-3 h-3 mr-1" />
                            Locked
                        </Badge>
                    </div>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card className={cn(
            "border transition-all",
            config.bgColor,
            config.borderColor
        )}>
            <CardHeader
                className={cn(
                    "pb-2",
                    isCollapsible && "cursor-pointer hover:bg-slate-800/30 transition-colors"
                )}
                onClick={handleToggle}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Stage number with status indicator */}
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                            status === 'ready' && "bg-emerald-500/20",
                            status === 'loading' && "bg-amber-500/20",
                            status === 'idle' && "bg-slate-800",
                            status === 'error' && "bg-red-500/20"
                        )}>
                            <StatusIcon className={cn(
                                "w-4 h-4",
                                config.color,
                                status === 'loading' && "animate-spin"
                            )} />
                        </div>

                        <div>
                            <h3 className={cn(
                                "text-lg font-semibold",
                                status === 'ready' ? "text-emerald-400" : "text-slate-200"
                            )}>
                                Stage {stageNumber}: {title}
                            </h3>
                            {description && (
                                <p className="text-sm text-slate-500">
                                    {description}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className={config.badgeClass}>
                            <StatusIcon className={cn(
                                "w-3 h-3 mr-1",
                                status === 'loading' && "animate-spin"
                            )} />
                            {config.label}
                        </Badge>

                        {isCollapsible && (
                            <div className="text-slate-500">
                                {isCollapsed ? (
                                    <ChevronRight className="w-4 h-4" />
                                ) : (
                                    <ChevronDown className="w-4 h-4" />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </CardHeader>

            {/* Content - collapsible */}
            {(!isCollapsible || !isCollapsed) && (
                <CardContent className="pt-4">
                    {children}
                </CardContent>
            )}
        </Card>
    );
}
