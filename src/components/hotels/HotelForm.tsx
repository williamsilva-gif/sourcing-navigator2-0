import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MapPin, Save, X, CheckCircle2, AlertTriangle, Loader2, Search } from "lucide-react";
import { hotelSchema, type Hotel } from "@/lib/baselineSchemas";
import {
  geocodeAddress,
  distanceMeters,
  autocompleteAddress,
  resolvePlace,
  type GeocodeResult,
  type AutocompletePrediction,
} from "@/lib/geocode";

// Lazy: keeps the heavy Google Maps iframe out of the form's initial render.
const HotelMap = lazy(() => import("./HotelMap").then((m) => ({ default: m.HotelMap })));

interface Props {
  initial?: Partial<Hotel>;
  onSave: (h: Hotel) => void;
  onCancel: () => void;
  existingCodes: string[];
}

const empty: Hotel = {
  code: "",
  name: "",
  address: "",
  postal_code: "",
  city: "",
  state_province: "",
  country_code: "BR",
  phone_number: "",
  Contact: "",
  latitude: undefined,
  longitude: undefined,
  star_rating: undefined,
  category_id: "",
};

const CONFIDENCE_LABEL: Record<GeocodeResult["confidence"], { label: string; cls: string }> = {
  high: { label: "Alta confiança (rooftop)", cls: "bg-success-soft text-success" },
  medium: { label: "Confiança média (interpolado)", cls: "bg-primary-soft text-primary" },
  low: { label: "Baixa confiança (aproximado)", cls: "bg-warning-soft text-warning-foreground" },
};

export function HotelForm({ initial, onSave, onCancel, existingCodes }: Props) {
  const [form, setForm] = useState<Hotel>({ ...empty, ...(initial as Hotel) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [geocoding, setGeocoding] = useState(false);
  const [geo, setGeo] = useState<GeocodeResult | null>(null);
  const [validation, setValidation] = useState<null | { ok: boolean; message: string; distance?: number; confidence?: GeocodeResult["confidence"] }>(null);
  const [radiusKm, setRadiusKm] = useState<number>(1);

  // Autocomplete state
  const [acQuery, setAcQuery] = useState("");
  const [acOpen, setAcOpen] = useState(false);
  const [acLoading, setAcLoading] = useState(false);
  const [predictions, setPredictions] = useState<AutocompletePrediction[]>([]);
  const sessionTokenRef = useRef<string>(crypto.randomUUID());

  const isEdit = Boolean(initial?.code);

  function set<K extends keyof Hotel>(k: K, v: Hotel[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setValidation(null);
  }

  // Debounced autocomplete
  useEffect(() => {
    if (acQuery.trim().length < 3) {
      setPredictions([]);
      return;
    }
    const handle = setTimeout(async () => {
      setAcLoading(true);
      try {
        const r = await autocompleteAddress(acQuery, sessionTokenRef.current);
        setPredictions(r);
        setAcOpen(true);
      } catch (e) {
        toast.error(`Autocomplete: ${(e as Error).message}`);
      } finally {
        setAcLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [acQuery]);

  async function pickPrediction(p: AutocompletePrediction) {
    setAcOpen(false);
    setAcQuery(p.description);
    try {
      const place = await resolvePlace(p.placeId);
      if (!place) return;
      setForm((f) => ({
        ...f,
        address: p.mainText ?? place.displayName,
        latitude: place.lat,
        longitude: place.lng,
      }));
      setGeo(place);
      setValidation({ ok: true, confidence: place.confidence, message: `Endereço selecionado · ${CONFIDENCE_LABEL[place.confidence].label}` });
      sessionTokenRef.current = crypto.randomUUID(); // close billing session
      toast.success("Coordenadas obtidas via Google Places");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleValidateAddress() {
    const query = [form.address, form.postal_code, form.city, form.state_province, form.country_code]
      .filter(Boolean)
      .join(", ");
    if (!query.trim()) {
      toast.error("Preencha o endereço antes de validar");
      return;
    }
    setGeocoding(true);
    setValidation(null);
    try {
      const result = await geocodeAddress(query);
      if (!result) {
        setValidation({ ok: false, message: "Endereço não encontrado pelo Google Maps" });
        toast.warning("Endereço não localizado");
        return;
      }
      setGeo(result);

      if (typeof form.latitude === "number" && typeof form.longitude === "number") {
        const d = distanceMeters({ lat: form.latitude, lng: form.longitude }, { lat: result.lat, lng: result.lng });
        const radiusM = radiusKm * 1000;
        if (d > radiusM) {
          setValidation({
            ok: false,
            distance: d,
            confidence: result.confidence,
            message: `Coordenadas a ${(d / 1000).toFixed(2)} km do endereço (raio ${radiusKm} km)`,
          });
          toast.warning(`Lat/Long fora do raio aceitável (${(d / 1000).toFixed(2)} km)`);
          return;
        }
        setValidation({
          ok: true,
          distance: d,
          confidence: result.confidence,
          message: `Endereço confere · ${d.toFixed(0)} m do ponto · ${CONFIDENCE_LABEL[result.confidence].label}`,
        });
        toast.success("Endereço validado");
      } else {
        setForm((f) => ({ ...f, latitude: result.lat, longitude: result.lng }));
        setValidation({ ok: true, confidence: result.confidence, message: `Coordenadas preenchidas · ${CONFIDENCE_LABEL[result.confidence].label}` });
        toast.success("Coordenadas obtidas do endereço");
      }
    } catch (e) {
      toast.error(`Falha na validação: ${(e as Error).message}`);
    } finally {
      setGeocoding(false);
    }
  }

  function handleSave() {
    const result = hotelSchema.safeParse(form);
    if (!result.success) {
      const next: Record<string, string> = {};
      result.error.issues.forEach((iss) => {
        const path = iss.path.join(".");
        next[path] = iss.message;
      });
      setErrors(next);
      toast.error(`Corrija ${Object.keys(next).length} campo(s)`);
      return;
    }
    if (!isEdit && existingCodes.includes(result.data.code)) {
      setErrors({ code: "Código já cadastrado" });
      toast.error("Código duplicado");
      return;
    }
    setErrors({});
    onSave(result.data);
    toast.success(`${result.data.name} salvo`);
  }

  const inputCls = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Código" error={errors.code} required>
            <input value={form.code} onChange={(e) => set("code", e.target.value)} disabled={isEdit} className={inputCls} placeholder="H-001" />
          </Field>
          <Field label="Nome do hotel" error={errors.name} required>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
          </Field>
        </div>

        {/* Google Places Autocomplete */}
        <Field label="Buscar endereço (Google Places Autocomplete)">
          <div className="relative">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={acQuery}
                onChange={(e) => setAcQuery(e.target.value)}
                onFocus={() => predictions.length > 0 && setAcOpen(true)}
                onBlur={() => setTimeout(() => setAcOpen(false), 150)}
                placeholder="Digite o nome do hotel ou endereço…"
                className={`${inputCls} pl-8`}
              />
              {acLoading && <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />}
            </div>
            {acOpen && predictions.length > 0 && (
              <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-popover shadow-lg">
                {predictions.map((p) => (
                  <li key={p.placeId}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickPrediction(p)}
                      className="block w-full px-3 py-2 text-left text-xs hover:bg-secondary"
                    >
                      <div className="font-medium text-foreground">{p.mainText ?? p.description}</div>
                      {p.secondaryText && <div className="text-[10px] text-muted-foreground">{p.secondaryText}</div>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Field>

        <Field label="Endereço" error={errors.address}>
          <input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} className={inputCls} placeholder="Av. das Nações Unidas, 13301" />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="CEP" error={errors.postal_code}>
            <input value={form.postal_code ?? ""} onChange={(e) => set("postal_code", e.target.value)} className={inputCls} placeholder="04578-000" />
          </Field>
          <Field label="Cidade" error={errors.city} required>
            <input value={form.city} onChange={(e) => set("city", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Estado / Província" error={errors.state_province}>
            <input value={form.state_province ?? ""} onChange={(e) => set("state_province", e.target.value)} className={inputCls} placeholder="SP" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="País (ISO)" error={errors.country_code}>
            <input value={form.country_code ?? ""} onChange={(e) => set("country_code", e.target.value.toUpperCase())} className={inputCls} placeholder="BR" maxLength={3} />
          </Field>
          <Field label="Telefone" error={errors.phone_number}>
            <input value={form.phone_number ?? ""} onChange={(e) => set("phone_number", e.target.value)} className={inputCls} placeholder="+55 11 0000-0000" />
          </Field>
          <Field label="Contato" error={errors.Contact}>
            <input value={form.Contact ?? ""} onChange={(e) => set("Contact", e.target.value)} className={inputCls} placeholder="reservas@hotel.com" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Field label="Latitude" error={errors.latitude}>
            <input type="number" step="0.0001" value={form.latitude ?? ""} onChange={(e) => set("latitude", e.target.value === "" ? undefined : Number(e.target.value))} className={inputCls} />
          </Field>
          <Field label="Longitude" error={errors.longitude}>
            <input type="number" step="0.0001" value={form.longitude ?? ""} onChange={(e) => set("longitude", e.target.value === "" ? undefined : Number(e.target.value))} className={inputCls} />
          </Field>
          <Field label="Estrelas" error={errors.star_rating}>
            <input type="number" min={0} max={5} step="0.5" value={form.star_rating ?? ""} onChange={(e) => set("star_rating", e.target.value === "" ? undefined : Number(e.target.value))} className={inputCls} />
          </Field>
          <Field label="Categoria" error={errors.category_id}>
            <input value={form.category_id ?? ""} onChange={(e) => set("category_id", e.target.value)} className={inputCls} placeholder="UPSCALE" />
          </Field>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/20 p-3">
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">Raio aceitável (km)</span>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Math.max(0.1, Number(e.target.value) || 1))}
              className={`${inputCls} w-24`}
            />
          </div>
          <button
            type="button"
            onClick={handleValidateAddress}
            disabled={geocoding}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-50"
          >
            {geocoding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
            Validar endereço no mapa
          </button>
          {validation && (
            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${validation.ok ? "bg-success-soft text-success" : "bg-warning-soft text-warning-foreground"}`}>
              {validation.ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              {validation.message}
            </span>
          )}
          {validation?.confidence && (
            <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${CONFIDENCE_LABEL[validation.confidence].cls}`}>
              {CONFIDENCE_LABEL[validation.confidence].label}
            </span>
          )}
          {typeof validation?.distance === "number" && (
            <span className="rounded-md bg-secondary px-2 py-1 text-[10px] font-mono text-foreground">
              dist {validation.distance < 1000 ? `${validation.distance.toFixed(0)} m` : `${(validation.distance / 1000).toFixed(2)} km`} · raio {radiusKm} km
            </span>
          )}
        </div>

        {geo && (
          <p className="text-[11px] text-muted-foreground">
            Endereço normalizado: <span className="font-mono">{geo.displayName}</span>
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button onClick={onCancel} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary">
            <X className="h-3.5 w-3.5" />
            Cancelar
          </button>
          <button onClick={handleSave} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
            <Save className="h-3.5 w-3.5" />
            {isEdit ? "Salvar alterações" : "Cadastrar hotel"}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pré-visualização do mapa</p>
        <HotelMap
          lat={form.latitude}
          lng={form.longitude}
          query={[form.name, form.address, form.city, form.state_province, form.country_code].filter(Boolean).join(", ")}
          height={420}
        />
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Autocomplete e validação via Google Places + Geocoding. A chave fica no servidor.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  error,
  required,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
      {error && <span className="block text-[10px] text-destructive">{error}</span>}
    </label>
  );
}
