import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/useAuth";
import { useClientsStore } from "@/lib/clientsStore";
import { CookieBanner } from "@/components/privacy/CookieBanner";

// One-time purge of legacy persisted local data (demo bookings, seed clients,
// pending hotel uploads). Bumps the flag whenever we want to wipe again.
const PURGE_FLAG = "sourcinghub.localPurge.v2";
if (typeof window !== "undefined") {
  try {
    if (localStorage.getItem(PURGE_FLAG) !== "1") {
      localStorage.removeItem("sourcinghub.baseline.v1");
      localStorage.removeItem("sourcinghub.clients.v1");
      localStorage.removeItem("sourcinghub.snapshot.v1");
      localStorage.setItem(PURGE_FLAG, "1");
    }
  } catch {
    /* ignore */
  }
}

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SourcingHub — Hotel Sourcing Corporativo" },
      {
        name: "description",
        content:
          "Plataforma SaaS para hotel sourcing corporativo: diagnóstico, RFP, negociação, monitoramento e monetização de savings.",
      },
      { name: "author", content: "SourcingHub" },
      { property: "og:title", content: "SourcingHub — Hotel Sourcing Corporativo" },
      {
        property: "og:description",
        content:
          "Plataforma SaaS para hotel sourcing corporativo, do diagnóstico à monetização.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "SourcingHub — Hotel Sourcing Corporativo" },
      { name: "description", content: "Navigator is a corporate hotel sourcing SaaS platform for data-driven travel management." },
      { property: "og:description", content: "Navigator is a corporate hotel sourcing SaaS platform for data-driven travel management." },
      { name: "twitter:description", content: "Navigator is a corporate hotel sourcing SaaS platform for data-driven travel management." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/00554103-01bc-4ab6-93f3-a2cfeb1702c1/id-preview-ae5813f4--71c5bafd-e4cf-4ee3-8f7f-25747f6b987e.lovable.app-1776721532274.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/00554103-01bc-4ab6-93f3-a2cfeb1702c1/id-preview-ae5813f4--71c5bafd-e4cf-4ee3-8f7f-25747f6b987e.lovable.app-1776721532274.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { user } = useAuth();
  const syncClients = useClientsStore((s) => s.syncFromDb);
  useEffect(() => {
    if (user) syncClients();
  }, [user, syncClients]);

  return (
    <>
      <Outlet />
      <Toaster richColors position="bottom-right" />
    </>
  );
}
