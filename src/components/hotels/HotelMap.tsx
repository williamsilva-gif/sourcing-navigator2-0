// Embedded Google Maps via free `output=embed` URL — no API key required.
// For richer features, replace src with a Maps Embed API URL using a key.

interface Props {
  lat?: number;
  lng?: number;
  query?: string;
  height?: number;
}

export function HotelMap({ lat, lng, query, height = 280 }: Props) {
  let src = "";
  if (typeof lat === "number" && typeof lng === "number" && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    src = `https://www.google.com/maps?q=${lat},${lng}&hl=pt-BR&z=16&output=embed`;
  } else if (query && query.trim().length > 0) {
    src = `https://www.google.com/maps?q=${encodeURIComponent(query)}&hl=pt-BR&z=15&output=embed`;
  }

  if (!src) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-md border border-dashed border-border bg-muted/20 text-xs text-muted-foreground"
      >
        Informe latitude/longitude ou valide o endereço para visualizar o mapa.
      </div>
    );
  }

  return (
    <iframe
      title="Mapa do hotel"
      src={src}
      style={{ height, border: 0 }}
      className="w-full overflow-hidden rounded-md border border-border"
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
