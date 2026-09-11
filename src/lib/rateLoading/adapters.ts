// Registry of approved portal adapters (shared by app UI and worker).
// Each adapter declares the only domains its automation may navigate to.

export interface AdapterDescriptor {
  key: string;
  version: string;
  label: string;
  allowedDomains: string[];
  /** Adapters flagged as test-only are never selectable for a real client portal. */
  testOnly?: boolean;
  mfaSupport: "none" | "manual";
}

export const PORTAL_ADAPTERS: AdapterDescriptor[] = [
  {
    key: "mock",
    version: "1.0.0",
    label: "Portal de testes (Navigator Mock OBT)",
    allowedDomains: ["mock:127.0.0.1", "mock:localhost"],
    testOnly: true,
    mfaSupport: "manual",
  },
  {
    key: "generic-obt",
    version: "1.0.0",
    label: "OBT genérico (configurar domínio)",
    allowedDomains: [],
    mfaSupport: "manual",
  },
];

export function getAdapter(key: string): AdapterDescriptor | undefined {
  return PORTAL_ADAPTERS.find((a) => a.key === key);
}
