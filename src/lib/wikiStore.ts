import { useEffect, useState, useCallback } from "react";
import { listWikiPages, type WikiPage } from "./wikiRepo";

let cache: WikiPage[] = [];
let loaded = false;
const listeners = new Set<(p: WikiPage[]) => void>();

function setPages(next: WikiPage[]) {
  cache = next;
  listeners.forEach((fn) => fn(cache));
}

export async function reloadWikiPages(): Promise<void> {
  const data = await listWikiPages();
  loaded = true;
  setPages(data);
}

export function useWikiPages() {
  const [pages, setLocal] = useState<WikiPage[]>(cache);
  const [loading, setLoading] = useState(!loaded);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await reloadWikiPages();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    listeners.add(setLocal);
    setLocal(cache);
    if (!loaded) reload();
    return () => {
      listeners.delete(setLocal);
    };
  }, [reload]);

  return { pages, loading, reload };
}
