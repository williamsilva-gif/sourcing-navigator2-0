import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { consentManager } from "@/lib/consentManager";

export function CookieBanner() {
  const [open, setOpen] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [prefs, setPrefs] = useState({
    cookies_functional: false,
    cookies_analytics: false,
    cookies_marketing: false,
  });

  useEffect(() => {
    // Defer to avoid SSR mismatch and let the page paint first
    const t = setTimeout(() => {
      if (!consentManager.hasDecided()) setOpen(true);
    }, 400);
    return () => clearTimeout(t);
  }, []);

  if (!open) return null;

  const acceptAll = () => {
    consentManager.acceptAll();
    setOpen(false);
  };
  const rejectAll = () => {
    consentManager.rejectAll();
    setOpen(false);
  };
  const savePrefs = () => {
    consentManager.setBulk(prefs);
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Preferências de cookies"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-xl border border-border bg-card p-5 shadow-2xl sm:inset-x-auto sm:right-4 sm:left-auto sm:bottom-4 sm:w-[34rem]"
    >
      <div className="flex items-start gap-3">
        <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="flex-1 text-sm text-foreground">
          <p className="font-semibold">Sua privacidade importa</p>
          <p className="mt-1 text-muted-foreground">
            Usamos cookies essenciais para fazer o app funcionar. Com seu consentimento, também
            usamos cookies opcionais para analytics, funcionalidades extras e marketing.{" "}
            <Link to="/privacy" className="underline underline-offset-2">
              Saiba mais
            </Link>
            .
          </p>
        </div>
        <button
          type="button"
          aria-label="Fechar"
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {showCustomize && (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
          <PrefRow
            label="Essenciais"
            description="Necessários para login, segurança e navegação. Não podem ser desativados."
            checked
            disabled
          />
          <PrefRow
            label="Funcionais"
            description="Lembram suas preferências (ex: cliente selecionado, tema)."
            checked={prefs.cookies_functional}
            onChange={(v) => setPrefs((p) => ({ ...p, cookies_functional: v }))}
          />
          <PrefRow
            label="Analytics"
            description="Nos ajudam a entender como o app é usado, de forma agregada."
            checked={prefs.cookies_analytics}
            onChange={(v) => setPrefs((p) => ({ ...p, cookies_analytics: v }))}
          />
          <PrefRow
            label="Marketing"
            description="Permitem comunicações personalizadas sobre o produto."
            checked={prefs.cookies_marketing}
            onChange={(v) => setPrefs((p) => ({ ...p, cookies_marketing: v }))}
          />
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {!showCustomize ? (
          <>
            <Button size="sm" onClick={acceptAll} className="flex-1 sm:flex-initial">
              Aceitar todos
            </Button>
            <Button size="sm" variant="outline" onClick={rejectAll} className="flex-1 sm:flex-initial">
              Recusar todos
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowCustomize(true)}
              className="flex-1 sm:flex-initial"
            >
              Personalizar
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" onClick={savePrefs} className="flex-1 sm:flex-initial">
              Salvar preferências
            </Button>
            <Button size="sm" variant="outline" onClick={acceptAll} className="flex-1 sm:flex-initial">
              Aceitar todos
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function PrefRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}
