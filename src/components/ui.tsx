import type { ReactNode } from 'react';

// Stat Card
interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: string;
  icon?: ReactNode;
}

export function StatCard({ label, value, subtext, trend }: StatCardProps) {
  const trendColor = trend?.includes('-') ? 'text-red-500' : trend?.includes('+') ? 'text-emerald-500' : 'text-slate-500';
  
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200 flex-1 min-w-0">
      <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-slate-900 tracking-tight">{value}</div>
      {subtext && <div className="text-xs text-slate-400 mt-1">{subtext}</div>}
      {trend && <div className={`mt-2 text-xs font-medium ${trendColor}`}>{trend}</div>}
    </div>
  );
}

// Health Badge
interface HealthBadgeProps {
  status: 'on-track' | 'at-risk' | 'over-budget';
}

export function HealthBadge({ status }: HealthBadgeProps) {
  const config = {
    'on-track': { bg: 'bg-emerald-50', color: 'text-emerald-600', dot: 'bg-emerald-500', label: 'On Track' },
    'at-risk': { bg: 'bg-amber-50', color: 'text-amber-600', dot: 'bg-amber-500', label: 'At Risk' },
    'over-budget': { bg: 'bg-red-50', color: 'text-red-600', dot: 'bg-red-500', label: 'Over Budget' }
  }[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${config.bg} rounded-full text-xs font-medium ${config.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

// Status Badge
interface StatusBadgeProps {
  status: 'draft' | 'active' | 'completed';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    'active': { bg: 'bg-blue-100', color: 'text-blue-600' },
    'completed': { bg: 'bg-emerald-100', color: 'text-emerald-600' },
    'draft': { bg: 'bg-slate-100', color: 'text-slate-500' }
  }[status];

  return (
    <span className={`px-2 py-0.5 ${config.bg} ${config.color} rounded text-xs font-semibold uppercase tracking-wide`}>
      {status}
    </span>
  );
}

// Button
interface ButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}

export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  onClick, 
  disabled,
  type = 'button',
  className = ''
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
    success: 'bg-emerald-500 text-white hover:bg-emerald-600',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    ghost: 'text-slate-600 hover:bg-slate-100',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

// Input
interface InputProps {
  label?: string;
  type?: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function Input({ 
  label, 
  type = 'text', 
  value, 
  onChange, 
  placeholder,
  disabled,
  className = ''
}: InputProps) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500"
      />
    </div>
  );
}

// Textarea
interface TextareaProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
}

export function Textarea({ 
  label, 
  value, 
  onChange, 
  placeholder,
  rows = 3,
  disabled,
  className = ''
}: TextareaProps) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 disabled:bg-slate-50 resize-none"
      />
    </div>
  );
}

// Select
interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
}

export function Select({ label, value, onChange, options, disabled, className = '' }: SelectProps) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white disabled:bg-slate-50"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

// Card
interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className = '', padding = true }: CardProps) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 ${padding ? 'p-5' : ''} ${className}`}>
      {children}
    </div>
  );
}

// Card Header
interface CardHeaderProps {
  title: string;
  action?: ReactNode;
}

export function CardHeader({ title, action }: CardHeaderProps) {
  return (
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {action}
    </div>
  );
}

// Empty State
interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <div className="text-slate-400 text-4xl mb-4">📭</div>
      <h3 className="text-sm font-medium text-slate-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 mb-4">{description}</p>}
      {action}
    </div>
  );
}

// Loading Spinner
export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}

// Variance display helper
interface VarianceProps {
  value: number;
  showPlus?: boolean;
  suffix?: string;
}

export function Variance({ value, showPlus = true, suffix = '%' }: VarianceProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const color = isPositive ? 'text-red-500' : isNegative ? 'text-emerald-500' : 'text-slate-500';
  const prefix = showPlus && isPositive ? '+' : '';
  
  return (
    <span className={`font-semibold ${color}`}>
      {prefix}{value.toFixed(0)}{suffix}
    </span>
  );
}

// Margin display
interface MarginDisplayProps {
  estimated: number;
  actual: number;
}

export function MarginDisplay({ estimated, actual }: MarginDisplayProps) {
  const actualColor = actual >= estimated ? 'text-emerald-500' : 'text-red-500';
  
  return (
    <span className="text-sm">
      <span className="text-slate-500">{estimated.toFixed(0)}%</span>
      <span className="text-slate-300 mx-1">→</span>
      <span className={`font-semibold ${actualColor}`}>{actual.toFixed(0)}%</span>
    </span>
  );
}

// Checkbox
interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Checkbox({ label, checked, onChange, disabled }: CheckboxProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </label>
  );
}
