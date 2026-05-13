import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { MapPin, Plus, Trash2, Loader2, Upload, Target, Building2 } from "lucide-react";
import { useBaselineStore } from "@/lib/baselineStore";
import { geocodeAddress, distanceMeters } from "@/lib/geocode";
import { readSpreadsheet } from "@/lib/xlsxTemplates";

export const POI_TYPES = ["Planta", "Filial", "Cliente", "Unidade", "Escritório", "Outro"] as const;
export type PoiType = (typeof POI_TYPES)[number];

export interface RfpPoi {
  id: string;
  name: string;
  type: PoiType;
  address: string;
  lat?: number;
  lng?: number;
  radiusKm: number;
}

interface Props {
  pois: RfpPoi[];
  onChange: (next: RfpPoi[]) => void;
}

export function RfpPoiStep({ pois, onChange }: Props) {
  const hotels = useBaselineStore((s) => s.hotels);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  function addPoi() {
    onChange([
      ...pois,
      { id: crypto.randomUUID(), name: "", type: "Filial", address: "", radiusKm: 5 },
    ]);
  }

  function update(id: string, patch: Partial<RfpPoi>) {
    onChange(pois.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function remove(id: string) {
    onChange(pois.filter((p) => p.id !== id));
  }

  async function geocodeOne(p: RfpPoi) {
    if (!p.address.trim()) {
      toast.error("Informe o endereço primeiro");
      return;
    }
    setBusyId(p.id);
    try {
      const r = await geocodeAddress(p.address);
      if (!r) {
        toast.warning(`${p.name || "POI"}: endereço não encontrado`);
        return;
      }
      update(p.id, { lat: r.lat, lng: r.lng });
      toast.success(`${p.name || "POI"} geocodificado`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleBulk(files: FileList | null) {
    if (!files || files.length === 0) return;
    setImporting(true);
    try {
      const next: RfpPoi[] = [...pois];
      for (const f of Array.from(files)) {
        const rows = await readSpreadsheet(f);
        for (const r of rows as Array<Record<string, unknown>>) {
          const name = String(r.name ?? r.nome ?? "").trim();
          if (!name) continue;
          const type = (POI_TYPES as readonly string[]).includes(String(r.type ?? r.tipo))
            ? (String(r.type ?? r.tipo) as PoiType)
            : "Filial";
          const address = String(r.address ?? r.endereco ?? r.endereço ?? "").trim();
          const lat = r.lat ?? r.latitude;
          const lng = r.lng ?? r.long ?? r.longitude;
          const radiusKm = Number(r.radius_km ?? r.raio_km ?? 5) || 5;
          next.push({
            id: crypto.randomUUID(),
            name,
            type,
            address,
            lat: lat === "" || lat == null ? undefined : Number(lat),
            lng: lng === "" || lng == null ? undefined : Number(lng),
            radiusKm,
          });
        }
      }
      onChange(next);
      toast.success(`${next.length - pois.length} POIs importados`);
    } catch (e) {
      toast.error(`Falha: ${(e as Error).message}`);
    } finally {
      setImporting(false);
    }
  }

  // Preview: hotels within any POI radius
  const matches = useMemo(() => {
    const geocoded = pois.filter((p) => typeof p.lat === "number" && typeof p.lng === "number");
    if (geocoded.length === 0) return { count: 0, byPoi: [] as Array<{ poi: RfpPoi; n: number }> };
    const found = new Set<string>();
    const byPoi = geocoded.map((p) => {
      const radM = p.radiusKm * 1000;
      const inRadius = hotels.filter(
        (h) =>
          typeof h.latitude === "number" &&
          typeof h.longitude === "number" &&
          distanceMeters({ lat: p.lat!, lng: p.lng! }, { lat: h.latitude, lng: h.longitude }) <= radM,
      );
      inRadius.forEach((h) => found.add(h.code));
      return { poi: p, n: inRadius.length };
    });
    return { count: found.size, byPoi };
  }, [pois, hotels]);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        Cadastre <strong className="text-foreground">pontos de interesse</strong> (plantas, filiais,
        clientes, unidades) para selecionar hotéis no raio escolhido. Clientes/TMC podem subir uma
        planilha com colunas <span className="font-mono">name, type, address, lat, lng, radius_km</span>.
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addPoi}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar POI
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={importing}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" />
          {importing ? "Importando…" : "Importar planilha"}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.xls,.csv"
          multiple
          className="hidden"
          onChange={(e) => {
            handleBulk(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="ml-auto flex items-center gap-1.5 rounded-md bg-success-soft px-2.5 py-1.5 text-[11px] font-semibold text-success">
          <Target className="h-3.5 w-3.5" />
          {matches.count} hotéis no(s) raio(s)
        </div>
      </div>

      {pois.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhum POI ainda. Adicione manualmente ou importe planilha.
        </div>
      ) : (
        <div className="space-y-2">
          {pois.map((p) => {
            const match = matches.byPoi.find((m) => m.poi.id === p.id);
            const geocoded = typeof p.lat === "number" && typeof p.lng === "number";
            return (
              <div key={p.id} className="grid grid-cols-12 items-end gap-2 rounded-md border border-border bg-card p-3">
                <div className="col-span-12 sm:col-span-3">
                  <label className="text-[10px] font-medium text-muted-foreground">Nome</label>
                  <input
                    value={p.name}
                    onChange={(e) => update(p.id, { name: e.target.value })}
                    placeholder="Planta SP-Lapa"
                    className="mt-0.5 h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="text-[10px] font-medium text-muted-foreground">Tipo</label>
                  <select
                    value={p.type}
                    onChange={(e) => update(p.id, { type: e.target.value as PoiType })}
                    className="mt-0.5 h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
                  >
                    {POI_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-12 sm:col-span-4">
                  <label className="text-[10px] font-medium text-muted-foreground">Endereço</label>
                  <input
                    value={p.address}
                    onChange={(e) => update(p.id, { address: e.target.value, lat: undefined, lng: undefined })}
                    placeholder="Rua, número, cidade"
                    className="mt-0.5 h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
                  />
                </div>
                <div className="col-span-4 sm:col-span-1">
                  <label className="text-[10px] font-medium text-muted-foreground">Raio km</label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={p.radiusKm}
                    onChange={(e) => update(p.id, { radiusKm: Math.max(0.1, Number(e.target.value) || 5) })}
                    className="mt-0.5 h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
                  />
                </div>
                <div className="col-span-8 sm:col-span-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => geocodeOne(p)}
                    disabled={busyId === p.id}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1.5 text-[11px] font-medium hover:bg-secondary disabled:opacity-50"
                  >
                    {busyId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
                    Geo
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="col-span-12 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                  {geocoded ? (
                    <span className="font-mono">
                      <MapPin className="mr-1 inline h-3 w-3 text-success" />
                      {p.lat!.toFixed(4)}, {p.lng!.toFixed(4)}
                    </span>
                  ) : (
                    <span className="text-warning-foreground">Sem coordenadas — clique em Geo</span>
                  )}
                  {match && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-0.5 text-primary">
                      <Building2 className="h-3 w-3" />
                      {match.n} hotéis no raio
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
