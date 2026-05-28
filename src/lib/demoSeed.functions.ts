import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Deterministic PRNG seeded by tenant id hash, so each client gets a stable
// but distinct dataset (different cities, ADRs, compliance gaps, etc.).
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CHANNELS = ["Direct", "GDS", "OTA", "Corporate Tool"] as const;
const TIERS = ["Luxury", "Upscale", "Midscale", "Economy"] as const;
const AMENITY_POOL = ["breakfast", "wifi", "lra", "parking", "gym"];

interface HotelInfo {
  id: string;
  name: string;
  city: string;
  state: string | null;
}

function pickTier(rand: () => number): typeof TIERS[number] {
  const r = rand();
  if (r < 0.1) return "Luxury";
  if (r < 0.45) return "Upscale";
  if (r < 0.85) return "Midscale";
  return "Economy";
}

function baseAdrFor(tier: string): number {
  switch (tier) {
    case "Luxury": return 520;
    case "Upscale": return 340;
    case "Midscale": return 230;
    default: return 160;
  }
}

const seedSchema = z.object({
  clientTenantId: z.string().uuid(),
  hotelIds: z.array(z.string().uuid()).optional(),
});

export const seedDemoDataFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => seedSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = data.clientTenantId;

    // 1. Verify tenant exists and check type — skip TMC
    const { data: tenant, error: tErr } = await supabase
      .from("tenants")
      .select("id, name, type")
      .eq("id", tenantId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!tenant) throw new Error("Tenant não encontrado ou sem permissão.");
    if (tenant.type === "TMC") {
      return { skipped: true, reason: "TMC fica vazia (consolida dados dos clientes filhos).", tenant: tenant.name };
    }

    // 2. Pick hotels (caller-visible). If hotelIds given, use them; else pick top 15-25 by name.
    let hotels: HotelInfo[] = [];
    if (data.hotelIds && data.hotelIds.length > 0) {
      const { data: rows, error } = await supabase
        .from("hotels").select("id, name, city, state").in("id", data.hotelIds);
      if (error) throw new Error(error.message);
      hotels = (rows ?? []) as HotelInfo[];
    } else {
      const { data: rows, error } = await supabase
        .from("hotels").select("id, name, city, state").order("name").limit(60);
      if (error) throw new Error(error.message);
      hotels = (rows ?? []) as HotelInfo[];
    }
    if (hotels.length === 0) {
      throw new Error("Nenhum hotel disponível para semear. Cadastre hotéis primeiro.");
    }

    const rand = mulberry32(hashSeed(tenantId));

    // Pick a subset (12-20 hotels) and bias per-tenant by shuffling
    const shuffled = [...hotels].sort(() => rand() - 0.5);
    const selected = shuffled.slice(0, Math.min(20, Math.max(12, Math.floor(shuffled.length * 0.6))));

    // 3. Wipe existing demo rows for this tenant (idempotent reseed)
    await Promise.all([
      supabase.from("bookings").delete().eq("client_tenant_id", tenantId),
      supabase.from("baseline_contracts").delete().eq("client_tenant_id", tenantId),
      supabase.from("strategy_tiers").delete().eq("client_tenant_id", tenantId),
      supabase.from("strategy_caps").delete().eq("client_tenant_id", tenantId),
      supabase.from("strategy_clusters").delete().eq("client_tenant_id", tenantId),
      supabase.from("rfp_analysis_rows").delete().eq("client_tenant_id", tenantId),
      supabase.from("negotiation_threads").delete().eq("client_tenant_id", tenantId),
      supabase.from("negotiation_lots").delete().eq("client_tenant_id", tenantId),
      supabase.from("awarded_program").delete().eq("client_tenant_id", tenantId),
      supabase.from("demand_targets").delete().eq("client_tenant_id", tenantId),
    ]);

    // Assign tier & base ADR to each selected hotel
    const enriched = selected.map((h) => {
      const tier = pickTier(rand);
      const baseAdr = baseAdrFor(tier);
      const brand = h.name.split(/[\s-]+/)[0] || "Independent";
      return { ...h, tier, baseAdr, brand };
    });

    // 4. Generate BOOKINGS — 2024, 2025, 2026 (forecast)
    const bookings: Array<Record<string, unknown>> = [];
    const years: Array<{ year: number; count: number; yoy: number; spikeRate: number }> = [
      { year: 2024, count: 600, yoy: 1.0, spikeRate: 0.16 },
      { year: 2025, count: 700, yoy: 1.06, spikeRate: 0.22 },
      { year: 2026, count: 250, yoy: 1.10, spikeRate: 0.18 },
    ];
    for (const yc of years) {
      const start = new Date(Date.UTC(yc.year, 0, 1)).getTime();
      const end = new Date(Date.UTC(yc.year, 11, 31)).getTime();
      for (let i = 0; i < yc.count; i++) {
        const h = enriched[Math.floor(rand() * enriched.length)];
        const noise = (rand() - 0.5) * 60;
        const spike = rand() < yc.spikeRate ? rand() * 90 : 0;
        const adr = Math.max(110, Math.round((h.baseAdr + noise + spike) * yc.yoy));
        const roomNights = 1 + Math.floor(rand() * 5);
        const checkin = new Date(start + Math.floor(rand() * (end - start))).toISOString().slice(0, 10);
        const channel = CHANNELS[Math.floor(rand() * CHANNELS.length)];
        bookings.push({
          client_tenant_id: tenantId,
          booking_external_id: `DEMO-${yc.year}-${String(i + 1).padStart(5, "0")}`,
          hotel_name: h.name,
          city: h.city,
          state: h.state,
          checkin,
          room_nights: roomNights,
          adr,
          channel,
          raw: {},
        });
      }
    }
    const CHUNK = 500;
    for (let i = 0; i < bookings.length; i += CHUNK) {
      const { error } = await supabase.from("bookings").insert(bookings.slice(i, i + CHUNK) as never);
      if (error) throw new Error(`bookings insert: ${error.message}`);
    }

    // 5. Generate CONTRACTS (one per hotel per active year)
    const contracts: Array<Record<string, unknown>> = [];
    for (const yc of [2024, 2025, 2026]) {
      const yoy = yc === 2024 ? 1.0 : yc === 2025 ? 1.05 : 1.10;
      for (const h of enriched) {
        const negotiated = Math.round(h.baseAdr * yoy * (0.94 + rand() * 0.08));
        const cap = Math.round(negotiated * 1.05);
        contracts.push({
          client_tenant_id: tenantId,
          hotel_name: h.name,
          hotel_code: h.name,
          cap,
          currency: "BRL",
          valid_from: `${yc}-01-01`,
          valid_until: `${yc}-12-31`,
          raw: { negotiated_adr: negotiated },
        });
      }
    }
    for (let i = 0; i < contracts.length; i += CHUNK) {
      const { error } = await supabase.from("baseline_contracts").insert(contracts.slice(i, i + CHUNK) as never);
      if (error) throw new Error(`contracts insert: ${error.message}`);
    }

    // 6. STRATEGY: tiers, caps, clusters
    const tierGroups = new Map<string, HotelInfo[]>();
    enriched.forEach((h) => {
      if (!tierGroups.has(h.tier)) tierGroups.set(h.tier, []);
      tierGroups.get(h.tier)!.push(h);
    });
    const tierRows = Array.from(tierGroups.entries()).map(([tier, list], idx) => ({
      client_tenant_id: tenantId,
      tier,
      brands: Array.from(new Set(list.map((h) => h.name.split(/[\s-]+/)[0]))).slice(0, 6),
      qs_min: tier === "Luxury" ? 85 : tier === "Upscale" ? 75 : tier === "Midscale" ? 65 : 50,
      qs_max: tier === "Luxury" ? 100 : tier === "Upscale" ? 90 : tier === "Midscale" ? 80 : 70,
      share_pct: Math.round((list.length / enriched.length) * 100),
      notes: `${list.length} hotéis nesta faixa`,
      position: idx,
    }));
    if (tierRows.length > 0) {
      const { error } = await supabase.from("strategy_tiers").insert(tierRows as never);
      if (error) throw new Error(`strategy_tiers: ${error.message}`);
    }

    const cityGroups = new Map<string, typeof enriched>();
    enriched.forEach((h) => {
      if (!cityGroups.has(h.city)) cityGroups.set(h.city, []);
      cityGroups.get(h.city)!.push(h);
    });
    const capRows = Array.from(cityGroups.entries()).map(([city, list]) => {
      const avgBase = list.reduce((s, h) => s + h.baseAdr, 0) / list.length;
      const baseline = Math.round(avgBase * 1.06);
      const cap = Math.round(baseline * 0.98);
      return {
        client_tenant_id: tenantId,
        city,
        baseline_adr: baseline,
        suggested_cap: cap,
        approved_cap: null,
        rationale: `${list.length} hotéis · ADR médio ${avgBase.toFixed(0)}`,
      };
    });
    if (capRows.length > 0) {
      const { error } = await supabase.from("strategy_caps").insert(capRows as never);
      if (error) throw new Error(`strategy_caps: ${error.message}`);
    }

    const clusterRows = [
      { type: "Strategic", count: Math.ceil(enriched.length * 0.2), share: 45 },
      { type: "Preferred", count: Math.ceil(enriched.length * 0.35), share: 35 },
      { type: "Tactical", count: Math.ceil(enriched.length * 0.3), share: 15 },
      { type: "Drop", count: Math.floor(enriched.length * 0.15), share: 5 },
    ].map((c, idx) => {
      const slice = enriched.slice(
        idx === 0 ? 0 :
        idx === 1 ? Math.ceil(enriched.length * 0.2) :
        idx === 2 ? Math.ceil(enriched.length * 0.55) :
                    Math.ceil(enriched.length * 0.85),
        idx === 0 ? Math.ceil(enriched.length * 0.2) :
        idx === 1 ? Math.ceil(enriched.length * 0.55) :
        idx === 2 ? Math.ceil(enriched.length * 0.85) :
                    enriched.length,
      );
      return {
        client_tenant_id: tenantId,
        name: c.type,
        hotels: slice.map((h) => h.name),
        cities: Array.from(new Set(slice.map((h) => h.city))),
        rationale:
          c.type === "Strategic" ? "Top performers — RFP anual com leilão reverso." :
          c.type === "Preferred" ? "Volume relevante — RFP anual padrão." :
          c.type === "Tactical" ? "Demanda esporádica — review trimestral." :
                                    "Baixa performance — candidato a saída.",
        share_pct: c.share,
      };
    });
    if (clusterRows.length > 0) {
      const { error } = await supabase.from("strategy_clusters").insert(clusterRows as never);
      if (error) throw new Error(`strategy_clusters: ${error.message}`);
    }

    // 7. DEMAND TARGETS
    const targetRows = Array.from(cityGroups.entries()).map(([city, list]) => ({
      client_tenant_id: tenantId,
      city,
      target_nights: list.length * (300 + Math.floor(rand() * 500)),
    }));
    if (targetRows.length > 0) {
      const { error } = await supabase.from("demand_targets").insert(targetRows as never);
      if (error) throw new Error(`demand_targets: ${error.message}`);
    }

    // 8. RFP ANALYSIS (compare responses): one row per hotel
    const analysisRows = enriched.map((h) => {
      const current = h.baseAdr;
      const proposed = Math.round(current * (0.88 + rand() * 0.18));
      const savingsPct = ((current - proposed) / current) * 100;
      const qs = Math.round(60 + rand() * 40);
      const compliance = Math.round(70 + rand() * 30);
      const recommendation =
        savingsPct >= 8 && qs >= 75 ? "approve" :
        savingsPct >= 3 ? "negotiate" :
        savingsPct < 0 ? "reject" : "review";
      return {
        client_tenant_id: tenantId,
        rfp_id: null,
        hotel_name: h.name,
        city: h.city,
        current_adr: current,
        proposed_adr: proposed,
        savings_pct: Number(savingsPct.toFixed(1)),
        quality_score: qs,
        compliance_pct: compliance,
        amenities: AMENITY_POOL.filter(() => rand() > 0.4),
        recommendation,
        notes: null,
      };
    });
    if (analysisRows.length > 0) {
      const { error } = await supabase.from("rfp_analysis_rows").insert(analysisRows as never);
      if (error) throw new Error(`rfp_analysis_rows: ${error.message}`);
    }

    // 9. NEGOTIATION lots + threads
    const lotCities = Array.from(cityGroups.keys()).slice(0, 4);
    const lots = lotCities.map((city, idx) => ({
      id: crypto.randomUUID(),
      client_tenant_id: tenantId,
      name: `Lote ${city} 2026`,
      city,
      status: idx === 0 ? "closing" : idx === 1 ? "open" : idx === 2 ? "review" : "open",
      hotels_count: cityGroups.get(city)!.length,
      target_savings_pct: 10 + rand() * 8,
      current_savings_pct: 4 + rand() * 8,
      owner: ["Ana Souza", "Carlos Lima", "Bruno Tavares", "Marina Costa"][idx % 4],
      deadline: `2026-${String(3 + idx).padStart(2, "0")}-15`,
      notes: null,
    }));
    if (lots.length > 0) {
      const { error } = await supabase.from("negotiation_lots").insert(lots as never);
      if (error) throw new Error(`negotiation_lots: ${error.message}`);
    }

    const threads: Array<Record<string, unknown>> = [];
    for (const lot of lots) {
      const cityHotels = cityGroups.get(lot.city) ?? [];
      for (const h of cityHotels.slice(0, 4)) {
        const enrichedH = enriched.find((e) => e.id === h.id);
        if (!enrichedH) continue;
        const starting = Math.round(enrichedH.baseAdr * 1.08);
        const target = Math.round(enrichedH.baseAdr * 0.92);
        const current = Math.round(starting - (starting - target) * (0.3 + rand() * 0.5));
        const lastDays = Math.floor(rand() * 14);
        threads.push({
          client_tenant_id: tenantId,
          lot_id: lot.id,
          hotel_name: h.name,
          city: h.city,
          starting_adr: starting,
          current_offer: current,
          target_adr: target,
          status: rand() > 0.7 ? "agreed" : rand() > 0.4 ? "counter" : rand() > 0.2 ? "review" : "received",
          last_message_at: new Date(Date.now() - lastDays * 86400000).toISOString(),
          last_message_from: rand() > 0.5 ? "hotel" : "buyer",
          owner: lot.owner,
          deadline: lot.deadline,
        });
      }
    }
    if (threads.length > 0) {
      const { error } = await supabase.from("negotiation_threads").insert(threads as never);
      if (error) throw new Error(`negotiation_threads: ${error.message}`);
    }

    // 10. AWARDED PROGRAM (Diretório de Hotéis)
    const awarded = enriched.map((h, idx) => {
      const isPrimary = idx < Math.ceil(enriched.length * 0.7);
      const finalAdr = Math.round(h.baseAdr * (0.92 + rand() * 0.06));
      const cap = Math.round(finalAdr * 1.05);
      const startingAdr = Math.round(h.baseAdr * 1.08);
      return {
        client_tenant_id: tenantId,
        hotel_name: h.name,
        brand: h.brand,
        city: h.city,
        tier: h.tier,
        final_adr: finalAdr,
        cap,
        starting_adr: startingAdr,
        room_nights: 200 + Math.floor(rand() * 1800),
        quality_score: Math.round(70 + rand() * 30),
        compliance_pct: Math.round(80 + rand() * 20),
        amenities: AMENITY_POOL.filter(() => rand() > 0.35),
        cancellation_hours: rand() > 0.5 ? 24 : 48,
        contract_start: "2026-01-01",
        contract_end: "2026-12-31",
        status: isPrimary ? "primary" : "backup",
      };
    });
    if (awarded.length > 0) {
      const { error } = await supabase.from("awarded_program").insert(awarded as never);
      if (error) throw new Error(`awarded_program: ${error.message}`);
    }

    return {
      tenant: tenant.name,
      tenantType: tenant.type,
      hotels: enriched.length,
      bookings: bookings.length,
      contracts: contracts.length,
      tiers: tierRows.length,
      caps: capRows.length,
      clusters: clusterRows.length,
      analysisRows: analysisRows.length,
      lots: lots.length,
      threads: threads.length,
      awarded: awarded.length,
      userId,
    };
  });

// Wipe all demo data for a tenant
export const wipeDemoDataFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clientTenantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const t = data.clientTenantId;
    await Promise.all([
      supabase.from("bookings").delete().eq("client_tenant_id", t),
      supabase.from("baseline_contracts").delete().eq("client_tenant_id", t),
      supabase.from("strategy_tiers").delete().eq("client_tenant_id", t),
      supabase.from("strategy_caps").delete().eq("client_tenant_id", t),
      supabase.from("strategy_clusters").delete().eq("client_tenant_id", t),
      supabase.from("rfp_analysis_rows").delete().eq("client_tenant_id", t),
      supabase.from("negotiation_threads").delete().eq("client_tenant_id", t),
      supabase.from("negotiation_lots").delete().eq("client_tenant_id", t),
      supabase.from("awarded_program").delete().eq("client_tenant_id", t),
      supabase.from("demand_targets").delete().eq("client_tenant_id", t),
    ]);
    return { ok: true };
  });
