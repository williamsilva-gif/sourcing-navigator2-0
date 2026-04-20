import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-[260px]">
        <Header />
        <main className="mx-auto max-w-[1600px] px-6 py-8">{children}</main>
      </div>
    </div>
  );
}