import { useAppConfigStore, type Role } from "@/lib/appConfigStore";

const ROLE_DESC: Record<Role, string> = {
  admin: "Acesso total · gerencia configuração",
  manager: "Executa ações e edita caps",
  viewer: "Somente leitura — não executa ações",
};

export function RolesPanel() {
  const user = useAppConfigStore((s) => s.user);
  const setRole = useAppConfigStore((s) => s.setRole);
  const setUserName = useAppConfigStore((s) => s.setUserName);

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <h2 className="text-base font-semibold text-foreground">Usuários & Papéis</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Em produção esta lista virá de Lovable Cloud. Hoje atua sobre o usuário corrente para validar o controle de acesso.
      </p>

      <div className="mt-5 overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Usuário</th>
              <th className="px-4 py-2.5 font-medium">Papel</th>
              <th className="px-4 py-2.5 font-medium">Descrição</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border">
              <td className="px-4 py-2.5">
                <input
                  value={user.name}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full bg-transparent font-medium text-foreground outline-none"
                />
                <p className="text-[11px] text-muted-foreground">{user.id}</p>
              </td>
              <td className="px-4 py-2.5">
                <select
                  value={user.role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                >
                  <option value="admin">admin</option>
                  <option value="manager">manager</option>
                  <option value="viewer">viewer</option>
                </select>
              </td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{ROLE_DESC[user.role]}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
