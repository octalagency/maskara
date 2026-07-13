'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
  hint?: string;
}

export function StatCard({ title, value, icon: Icon, change, trend, color = 'brand', hint }: StatCardProps) {
  const colorMap: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-rose-50 text-rose-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-sky-50 text-sky-600',
  };

  return (
    <div className="card relative overflow-hidden p-5">
      <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-slate-50/80" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
          <p className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">{value}</p>
          {change && (
            <p
              className={cn(
                'mt-1 text-xs font-medium',
                trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-rose-600' : 'text-slate-500',
              )}
            >
              {change}
            </p>
          )}
          {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
        <div className={cn('rounded-2xl p-3', colorMap[color])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
