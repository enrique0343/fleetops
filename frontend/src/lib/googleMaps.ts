// Carga perezosa y única del SDK de Google Maps JS.
let loader: Promise<any> | null = null;

export function loadGoogleMaps(apiKey: string): Promise<any> {
  const w = window as any;
  if (w.google?.maps) return Promise.resolve(w.google);
  if (loader) return loader;

  loader = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&language=es&region=SV`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve((window as any).google);
    s.onerror = () => { loader = null; reject(new Error('No se pudo cargar Google Maps')); };
    document.head.appendChild(s);
  });
  return loader;
}
