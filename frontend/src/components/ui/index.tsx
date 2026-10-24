import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, useEffect } from 'react';
import { Loader2, AlertCircle, CheckCircle, Info, XCircle, X, AlertTriangle } from 'lucide-react';

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
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const modalSizes = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: ModalProps) {
  // Cerrar con Escape y bloquear el scroll de fondo mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-backdrop-in" onClick={onClose} />
      <div className={[
        'relative z-10 w-full bg-slate-800 border border-slate-700 flex flex-col',
        'max-h-[92vh] sm:max-h-[85vh] shadow-2xl',
        'rounded-t-2xl sm:rounded-2xl animate-sheet-in sm:animate-modal-in',
        modalSizes[size],
      ].join(' ')}>
        {/* Asa visual en móvil (bottom sheet) */}
        <div className="sm:hidden pt-2.5 flex justify-center">
          <span className="w-9 h-1 rounded-full bg-slate-600" />
        </div>
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-700">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-100 leading-snug">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 -mr-1 -mt-0.5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-4.5 h-4.5 w-[18px] h-[18px]" />
          </button>
        </div>
        <div className="px-5 py-5 overflow-y-auto flex-1 overscroll-contain">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-slate-700 bg-slate-800/50">{footer}</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ConfirmDialog — confirmación elegante para acciones importantes
// ─────────────────────────────────────────────

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger' | 'success' | 'warning';
  loading?: boolean;
}

const confirmTone = {
  primary: { icon: Info, iconWrap: 'bg-blue-500/15 text-blue-400', button: 'primary' as const },
  danger: { icon: AlertTriangle, iconWrap: 'bg-red-500/15 text-red-400', button: 'danger' as const },
  success: { icon: CheckCircle, iconWrap: 'bg-emerald-500/15 text-emerald-400', button: 'success' as const },
  warning: { icon: AlertTriangle, iconWrap: 'bg-amber-500/15 text-amber-400', button: 'warning' as const },
};

export function ConfirmDialog({
  open, onClose, onConfirm, title, message, detail,
  confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  tone = 'primary', loading = false,
}: ConfirmDialogProps) {
  const t = confirmTone[tone];
  const Icon = t.icon;
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" fullWidth onClick={onClose} disabled={loading}>{cancelLabel}</Button>
          <Button variant={t.button} fullWidth onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </div>
      }
    >
      <div className="flex items-start gap-4">
        <span className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${t.iconWrap}`}>
          <Icon className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-slate-200 leading-relaxed">{message}</p>
          {detail && <p className="text-xs text-slate-400 mt-2 leading-relaxed">{detail}</p>}
        </div>
      </div>
    </Modal>
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
