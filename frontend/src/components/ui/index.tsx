import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import { Loader2, AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';

// ─────────────────────────────────────────────
// Button
// ─────────────────────────────────────────────

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const variantClasses = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-800',
  secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-100 border border-slate-600',
  danger: 'bg-red-600 hover:bg-red-700 text-white disabled:bg-red-800',
  ghost: 'bg-transparent hover:bg-slate-800 text-slate-300 border border-slate-700',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  warning: 'bg-amber-500 hover:bg-amber-600 text-white',
};

const sizeClasses = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-6 py-3.5 text-base gap-2.5',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────
// Input
// ─────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className = '', id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-300 mb-1.5">
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...props}
        className={[
          'w-full bg-slate-800 border rounded-xl px-4 py-3 text-slate-100 text-sm',
          'placeholder-slate-500 transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error ? 'border-red-500' : 'border-slate-700 hover:border-slate-600',
          className,
        ].join(' ')}
      />
      {error && <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
      {hint && !error && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────
// Select
// ─────────────────────────────────────────────

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

export function Select({ label, error, hint, options, placeholder, className = '', id, ...props }: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-slate-300 mb-1.5">
          {label}
        </label>
      )}
      <select
        id={selectId}
        {...props}
        className={[
          'w-full bg-slate-800 border rounded-xl px-4 py-3 text-slate-100 text-sm',
          'transition-colors duration-150 appearance-none cursor-pointer',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error ? 'border-red-500' : 'border-slate-700 hover:border-slate-600',
          className,
        ].join(' ')}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
      {hint && !error && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────
// Textarea
// ─────────────────────────────────────────────

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = '', id, ...props }: TextareaProps) {
  const areaId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={areaId} className="block text-sm font-medium text-slate-300 mb-1.5">
          {label}
        </label>
      )}
      <textarea
        id={areaId}
        {...props}
        className={[
          'w-full bg-slate-800 border rounded-xl px-4 py-3 text-slate-100 text-sm resize-none',
          'placeholder-slate-500 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          error ? 'border-red-500' : 'border-slate-700 hover:border-slate-600',
          className,
        ].join(' ')}
      />
      {error && <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-slate-800 border border-slate-700 rounded-2xl p-4 ${className}`}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────
// Alert
// ─────────────────────────────────────────────

const alertVariants = {
  error: { bg: 'bg-red-900/30 border-red-800', icon: XCircle, iconColor: 'text-red-400', textColor: 'text-red-300' },
  success: { bg: 'bg-emerald-900/30 border-emerald-800', icon: CheckCircle, iconColor: 'text-emerald-400', textColor: 'text-emerald-300' },
  warning: { bg: 'bg-amber-900/30 border-amber-800', icon: AlertCircle, iconColor: 'text-amber-400', textColor: 'text-amber-300' },
  info: { bg: 'bg-blue-900/30 border-blue-800', icon: Info, iconColor: 'text-blue-400', textColor: 'text-blue-300' },
};

export function Alert({ type = 'info', message }: { type?: keyof typeof alertVariants; message: string }) {
  const v = alertVariants[type];
  const Icon = v.icon;
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border ${v.bg}`}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${v.iconColor}`} />
      <p className={`text-sm ${v.textColor}`}>{message}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Badge
// ─────────────────────────────────────────────

const badgeVariants = {
  transit: 'bg-blue-900/50 text-blue-300 border-blue-700',
  stop: 'bg-amber-900/50 text-amber-300 border-amber-700',
  incident: 'bg-red-900/50 text-red-300 border-red-700',
  finished: 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
  cancelled: 'bg-slate-700 text-slate-400 border-slate-600',
  default: 'bg-slate-700 text-slate-300 border-slate-600',
};

const statusLabels: Record<string, string> = {
  IN_TRANSIT: 'En tránsito',
  IN_STOP: 'En parada',
  IN_INCIDENT: 'Incidencia',
  FINISHED: 'Finalizado',
  CANCELLED: 'Cancelado',
};

export function StatusBadge({ status }: { status: string }) {
  const variantMap: Record<string, keyof typeof badgeVariants> = {
    IN_TRANSIT: 'transit',
    IN_STOP: 'stop',
    IN_INCIDENT: 'incident',
    FINISHED: 'finished',
    CANCELLED: 'cancelled',
  };
  const variant = variantMap[status] || 'default';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${badgeVariants[variant]}`}>
      {statusLabels[status] || status}
    </span>
  );
}

// ─────────────────────────────────────────────
// Spinner / Loading
// ─────────────────────────────────────────────

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return <Loader2 className={`${sizes[size]} animate-spin text-blue-500`} />;
}

export function LoadingScreen({ message = 'Cargando...' }: { message?: string }) {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4">
      <Spinner size="lg" />
      <p className="text-slate-400 text-sm">{message}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-lg bg-slate-800 border border-slate-700 rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h3 className="text-base font-semibold text-slate-100">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="p-5 border-t border-slate-700">{footer}</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Telegram Status Badge
// ─────────────────────────────────────────────

export function TelegramBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; classes: string }> = {
    SENT: { label: '✓ Telegram', classes: 'bg-emerald-900/40 text-emerald-400 border-emerald-800' },
    FAILED: { label: '✗ Telegram', classes: 'bg-red-900/40 text-red-400 border-red-800' },
    PENDING: { label: '… Telegram', classes: 'bg-slate-700 text-slate-400 border-slate-600' },
    NOT_CONFIGURED: { label: '— Telegram', classes: 'bg-slate-800 text-slate-500 border-slate-700' },
  };
  const s = map[status] || map['PENDING'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border font-mono ${s.classes}`}>
      {s.label}
    </span>
  );
}
