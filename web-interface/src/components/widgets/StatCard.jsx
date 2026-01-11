import React from 'react';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';

export function StatCard({ 
    label, 
    value, 
    unit, 
    subLabel, 
    className, 
    valueColor, // 'text-white', 'text-accent-warn' etc
    onClose 
}) {
    return (
        <div className={cn(
            "bg-bg-panel border border-border-color rounded-lg p-4 relative flex flex-col items-center justify-center min-w-[140px]",
            className
        )}>
            {onClose && (
                <button 
                    onClick={onClose}
                    className="absolute top-2 right-2 text-text-muted hover:text-white transition-colors"
                >
                    <X size={16} />
                </button>
            )}
            
            <span className="text-text-muted text-sm font-semibold uppercase tracking-wider mb-1">
                {label}
            </span>
            
            <div className="flex items-baseline gap-1">
                <span className={cn("text-3xl font-bold font-mono", valueColor || "text-white")}>
                    {value}
                </span>
                {unit && <span className="text-text-muted text-sm font-mono">{unit}</span>}
            </div>

            {subLabel && (
                <span className="text-text-muted text-xs mt-1">
                    {subLabel}
                </span>
            )}
        </div>
    );
}
