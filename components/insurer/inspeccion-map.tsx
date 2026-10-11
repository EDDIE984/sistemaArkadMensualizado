// Mapa de la ubicación de la inspección. `<iframe>` de OpenStreetMap (sin
// dependencia ni API key). El punto sale de la primera foto con geolocalización.

export function InspeccionMap({ lat, lng }: { lat: number; lng: number }) {
  const d = 0.004;
  const bbox = `${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <iframe
        title="Ubicación de la inspección"
        loading="lazy"
        referrerPolicy="no-referrer"
        className="h-64 w-full border-0"
        src={src}
      />
      <div className="flex flex-wrap gap-4 border-t border-line bg-surface-muted px-4 py-2 text-xs">
        <span className="text-ink-subtle">
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </span>
        <a
          className="font-semibold text-brand-text hover:underline"
          target="_blank"
          rel="noreferrer"
          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
        >
          Ver en OpenStreetMap
        </a>
        <a
          className="font-semibold text-brand-text hover:underline"
          target="_blank"
          rel="noreferrer"
          href={`https://www.google.com/maps?q=${lat},${lng}`}
        >
          Ver en Google Maps
        </a>
      </div>
    </div>
  );
}
