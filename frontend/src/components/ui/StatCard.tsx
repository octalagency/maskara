import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

export function StatCard({ title, value, icon: Icon, change, trend, color = 'brand' }: StatCardProps) {
  const colorMap: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          {change && (
            <p className={cn(
              'mt-1 text-xs font-medium',
              trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-slate-500',
            )}>
              {change}
            </p>
          )}
        </div>
        <div className={cn('rounded-lg p-3', colorMap[color])}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
