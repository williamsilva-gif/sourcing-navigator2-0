import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inviteSchema = z.object({
  tenantId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["tmc_admin", "tmc_user", "corp_admin", "corp_user", "hotel_admin", "hotel_user"]),
});

const listSchema = z.object({ tenantId: z.string().uuid() });
const removeSchema = z.object({ tenantId: z.string().uuid(), userId: z.string().uuid() });

/**
 * Convida um usuário para um cliente: cria o user (ou pega o existente) via Auth Admin API,
 * cria o role no tenant, envia magic link. Somente TA master/staff pode chamar.
 */
export const inviteTenantUserFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isTa } = await context.supabase.rpc("is_ta_master", { _user_id: context.userId });
    if (!isTa) throw new Error("Apenas TA pode convidar usuários.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Tenta criar o usuário; se já existir, pega o id.
    let userId: string | null = null;
    const created = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { invited_to_tenant: data.tenantId, invited_role: data.role },
    });
    if (created.error) {
      const msg = created.error.message ?? "";
      if (/already|exists|registered/i.test(msg)) {
        // Busca usuário existente
        const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const found = list.data?.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
        if (!found) throw new Error(`Usuário existe mas não foi encontrado: ${msg}`);
        userId = found.id;
      } else {
        throw new Error(`Falha ao convidar: ${msg}`);
      }
    } else {
      userId = created.data.user?.id ?? null;
    }
    if (!userId) throw new Error("Não foi possível obter user id.");

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, tenant_id: data.tenantId, role: data.role });
    if (roleErr && !/duplicate|unique/i.test(roleErr.message)) {
      throw new Error(`Falha ao atribuir papel: ${roleErr.message}`);
    }

    return { ok: true, userId, email: data.email, role: data.role };
  });

/** Lista usuários do tenant (apenas TA). */
export const listTenantUsersFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isTa } = await context.supabase.rpc("is_ta_master", { _user_id: context.userId });
    if (!isTa) throw new Error("Apenas TA pode listar usuários.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rolesRows, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .eq("tenant_id", data.tenantId);
    if (error) throw new Error(error.message);

    const userIds = (rolesRows ?? []).map((r) => r.user_id);
    if (userIds.length === 0) return [];

    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds);

    return (rolesRows ?? []).map((r) => {
      const p = profs?.find((x) => x.id === r.user_id);
      return {
        userId: r.user_id,
        role: r.role as string,
        email: p?.email ?? "",
        fullName: p?.full_name ?? "",
      };
    });
  });

/** Remove o papel do usuário no tenant. */
export const removeTenantUserFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => removeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isTa } = await context.supabase.rpc("is_ta_master", { _user_id: context.userId });
    if (!isTa) throw new Error("Apenas TA pode remover usuários.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("tenant_id", data.tenantId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
