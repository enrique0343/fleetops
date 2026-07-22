import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { MapPin, Search, X, Check } from 'lucide-react';

export interface AddressResult {
  name: string;
  lat: number;
  lng: number;
}

interface Props {
  label?: string;
  placeholder?: string;
  value: AddressResult | null;
  onChange: (result: AddressResult | null) => void;
}

// Buscador de direcciones tipo Google Maps/Waze (OpenStreetMap vía el worker).
// Escribe y elige una sugerencia; las coordenadas se fijan solas.
export function AddressSearch({ label = 'Dirección', placeholder = 'Buscar dirección o lugar…', value, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AddressResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Búsqueda con debounce mientras se escribe.
  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.get(`/geo/search?q=${encodeURIComponent(query.trim())}`);
        setResults(r.data.data || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [query]);

  // Cerrar las sugerencias al hacer clic fuera.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (value) {
    return (
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
        <div className="flex items-start gap-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl px-4 py-3">
          <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white leading-snug">{value.name}</p>
            <p className="text-xs text-emerald-300/70 mt-0.5">
              📍 {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            </p>
          </div>
          <button onClick={() => { onChange(null); setQuery(''); }}
            className="text-slate-400 hover:text-white shrink-0" title="Cambiar">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl pl-10 pr-4 py-3 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searching && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-30 mt-2 w-full bg-slate-800 border border-slate-600 rounded-xl overflow-hidden shadow-xl max-h-64 overflow-y-auto">
          {results.map((r, i) => (
            <li key={i}>
              <button
                onClick={() => { onChange(r); setOpen(false); }}
                className="w-full flex items-start gap-2.5 px-4 py-3 text-left hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0"
              >
                <MapPin className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-200 leading-snug">{r.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !searching && query.trim().length >= 3 && results.length === 0 && (
        <p className="text-xs text-slate-500 mt-1.5">
          Sin resultados. Intenta con más detalle (municipio, colonia, punto de referencia…).
        </p>
      )}
    </div>
  );
}
