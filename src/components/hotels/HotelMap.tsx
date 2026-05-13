import { memo, useMemo } from "react";

// Embedded Google Maps via free `output=embed` URL — no API key required.
// Memoized + src only changes when coords (or stable query) change, so we don't
// re-fetch Google's iframe on every keystroke in the form.

interface Props {
  lat?: number;
  lng?: number;
  /** Optional fallback query. Only used when no coords AND caller has stabilized it. */
  query?: string;
  height?: number;
}

function HotelMapImpl({ lat, lng, query, height = 280 }: Props) {
  const src = useMemo(() => {
    if (typeof lat === "number" && typeof lng === "number" && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      return `https://www.google.com/maps?q=${lat},${lng}&hl=pt-BR&z=16&output=embed`;
    }
    if (query && query.trim().length > 0) {
      return `https://www.google.com/maps?q=${encodeURIComponent(query)}&hl=pt-BR&z=15&output=embed`;
    }
    return "";
  }, [lat, lng, query]);

  if (!src) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-4 text-center text-xs text-muted-foreground"
      >
        Valide o endereço ou informe latitude/longitude para ver o mapa.
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

export const HotelMap = memo(HotelMapImpl);
