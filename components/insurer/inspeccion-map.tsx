// Mapa de la ubicación de la inspección. `<iframe>` de OpenStreetMap (sin
// dependencia ni API key). El punto sale de la primera foto con geolocalización.

export function InspeccionMap({ lat, lng }: { lat: number; lng: number }) {
  const d = 0.004;
  const bbox = `${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
  return (
    <div className="overflow-hidden rounded-2xl border border-white/12">
      <iframe
        title="Ubicación de la inspección"
        loading="lazy"
        referrerPolicy="no-referrer"
        className="h-64 w-full border-0"
        src={src}
      />
      <div className="flex flex-wrap gap-4 border-t border-white/10 bg-[#05121f]/60 px-4 py-2 text-xs">
        <span className="text-white/50">
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </span>
        <a
          className="font-semibold text-cyan-100 hover:underline"
          target="_blank"
          rel="noreferrer"
          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
        >
          Ver en OpenStreetMap
        </a>
        <a
          className="font-semibold text-cyan-100 hover:underline"
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
