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
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-muted">{title}</p>
          <p className="mt-1.5 font-latin text-[28px] font-bold leading-none tracking-tight text-slate-900">
            {value}
          </p>
          {change && (
            <p
              className={cn(
                'mt-2 text-[12px] font-medium',
                trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-rose-600' : 'text-slate-500',
              )}
            >
              {change}
            </p>
          )}
          {hint && <p className="mt-1.5 text-[12px] text-slate-400">{hint}</p>}
        </div>
        <div className={cn('rounded-xl p-2.5', colorMap[color])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
