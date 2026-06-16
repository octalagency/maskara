'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';

function ToggleSwitch({
  enabled,
  onChange,
  label,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label || 'Toggle'}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        enabled ? 'bg-brand-600' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  saved,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  saved?: boolean;
}) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        {label} {saved && <span className="text-emerald-600">(saved)</span>}
      </label>
      <div className="relative mt-1">
        <input
          type={show ? 'text' : 'password'}
          className="input pr-10"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          onClick={() => setShow(!show)}
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export interface PaymentMethodCardProps {
  logo: React.ReactNode;
  title: string;
  subtitle: string;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  defaultOpen?: boolean;
  configured?: boolean;
  showToggle?: boolean;
  children: React.ReactNode;
}

export function PaymentMethodCard({
  logo,
  title,
  subtitle,
  enabled,
  onEnabledChange,
  defaultOpen = true,
  configured,
  showToggle = true,
  children,
}: PaymentMethodCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => setOpen(!open)}
        >
          {logo}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-slate-900">{title}</p>
              {configured !== undefined && (
                <span className={`text-xs ${configured ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {configured ? '✓' : '—'}
                </span>
              )}
            </div>
            <p className="truncate text-xs text-slate-500">{subtitle}</p>
          </div>
          {open ? (
            <ChevronUp className="h-5 w-5 shrink-0 text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />
          )}
        </button>
        {showToggle && (
          <ToggleSwitch enabled={enabled} onChange={onEnabledChange} label={`${title} enabled`} />
        )}
      </div>

      {open && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4">
          {children}
        </div>
      )}
    </div>
  );
}

export function PaymentTextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        className="input mt-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export { PasswordField, ToggleSwitch };
