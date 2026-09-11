import { useEffect, useRef, useId, ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react';
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
  secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300',
  danger: 'bg-red-600 hover:bg-red-700 text-white disabled:bg-red-800',
  ghost: 'bg-transparent hover:bg-white text-slate-700 border border-slate-200',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  warning: 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-200',
};

const sizeClasses = {
  sm: 'px-3 py-2 text-sm gap-1.5 min-h-10',
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
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white',
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
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...props}
        className={[
          'w-full bg-white border rounded-xl px-4 py-3 text-slate-900 text-sm',
          'placeholder-slate-500 transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error ? 'border-red-500' : 'border-slate-200 hover:border-slate-300',
          className,
        ].join(' ')}
      />
      {error && <p className="mt-1.5 text-xs text-red-700 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
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
        <label htmlFor={selectId} className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <select
        id={selectId}
        {...props}
        className={[
          'w-full bg-white border rounded-xl px-4 py-3 text-slate-900 text-sm',
          'transition-colors duration-150 appearance-none cursor-pointer',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error ? 'border-red-500' : 'border-slate-200 hover:border-slate-300',
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
      {error && <p className="mt-1.5 text-xs text-red-700 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
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
        <label htmlFor={areaId} className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <textarea
        id={areaId}
        {...props}
        className={[
          'w-full bg-white border rounded-xl px-4 py-3 text-slate-900 text-sm resize-none',
          'placeholder-slate-500 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          error ? 'border-red-500' : 'border-slate-200 hover:border-slate-300',
          className,
        ].join(' ')}
      />
      {error && <p className="mt-1.5 text-xs text-red-700 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-2xl p-4 ${className}`}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────
// Alert
// ─────────────────────────────────────────────

const alertVariants = {
  error: { bg: 'bg-red-50 border-red-200', icon: XCircle, iconColor: 'text-red-700', textColor: 'text-red-700' },
  success: { bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle, iconColor: 'text-emerald-700', textColor: 'text-emerald-700' },
  warning: { bg: 'bg-amber-50 border-amber-200', icon: AlertCircle, iconColor: 'text-amber-700', textColor: 'text-amber-700' },
  info: { bg: 'bg-blue-50 border-blue-200', icon: Info, iconColor: 'text-blue-700', textColor: 'text-blue-700' },
};

export function Alert({ type = 'info', message }: { type?: keyof typeof alertVariants; message: string }) {
  const v = alertVariants[type];
  const Icon = v.icon;
  return (
    <div role={type === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 p-3 rounded-xl border ${v.bg}`}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${v.iconColor}`} />
      <p className={`text-sm ${v.textColor}`}>{message}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Badge
// ─────────────────────────────────────────────

const badgeVariants = {
  transit: 'bg-blue-50 text-blue-700 border-blue-200',
  stop: 'bg-amber-50 text-amber-700 border-amber-200',
  incident: 'bg-red-50 text-red-700 border-red-200',
  finished: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-300',
  default: 'bg-slate-100 text-slate-700 border-slate-300',
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
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-medium border whitespace-nowrap ${badgeVariants[variant]}`}>
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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
      <Spinner size="lg" />
      <p className="text-slate-600 text-sm">{message}</p>
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
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);
  return (
    <dialog ref={dialog} aria-labelledby={titleId} className="ui-dialog" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      {open && <div className="ui-dialog-panel">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 gap-4">
          <h3 id={titleId} className="text-base font-semibold text-slate-900">{title}</h3>
          <button type="button" aria-label="Cerrar diálogo" onClick={onClose} className="text-slate-600 hover:text-slate-900 p-2"><XCircle className="w-5 h-5" /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="p-5 border-t border-slate-200">{footer}</div>}
      </div>}
    </dialog>
  );
}

// ─────────────────────────────────────────────
// Telegram Status Badge
// ─────────────────────────────────────────────

export function TelegramBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; classes: string }> = {
    SENT: { label: '✓ Telegram', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    FAILED: { label: '✗ Telegram', classes: 'bg-red-50 text-red-700 border-red-200' },
    PENDING: { label: '… Telegram', classes: 'bg-slate-100 text-slate-600 border-slate-300' },
    NOT_CONFIGURED: { label: '— Telegram', classes: 'bg-white text-slate-500 border-slate-200' },
  };
  const s = map[status] || map['PENDING'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border font-mono ${s.classes}`}>
      {s.label}
    </span>
  );
}
