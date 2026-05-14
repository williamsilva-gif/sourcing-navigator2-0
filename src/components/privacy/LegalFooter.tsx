import { Link } from "@tanstack/react-router";

export function LegalFooter() {
  return (
    <footer className="border-t border-border bg-card/30 px-6 py-4 text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
        <span>© {new Date().getFullYear()} SourcingHub — Travel Academy</span>
        <nav className="flex flex-wrap items-center gap-4">
          <Link to="/privacy" className="hover:text-foreground">
            Política de Privacidade
          </Link>
          <Link to="/terms" className="hover:text-foreground">
            Termos de Uso
          </Link>
          <Link to="/account/privacy" className="hover:text-foreground">
            Meus dados
          </Link>
        </nav>
      </div>
    </footer>
  );
}
