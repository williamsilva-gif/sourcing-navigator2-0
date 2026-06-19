
# Vídeo de apresentação — SourcingHub (30s)

## Conceito
Um tour didático de ~30 segundos pela plataforma, estilo **Cinematic Minimal**: muito branco, tipografia grande (Instrument Serif + Inter), pace lento, transições suaves (fade + slide sutil), uma cor de acento por cena puxada do tema atual. Cada módulo entra com um título grande à esquerda e o screenshot real à direita com leve parallax/zoom.

## Estrutura (30s @ 30fps = 900 frames)

```text
[0.0s — 2.5s]  Abertura: logo + tagline "Strategic Sourcing for Hotel Programs"
[2.5s — 6.0s]  Cena 1 — Dashboard          "Visão executiva em tempo real"
[6.0s — 9.5s]  Cena 2 — Diagnóstico        "Entenda seu baseline em minutos"
[9.5s — 13.0s] Cena 3 — Estratégia         "Tiering, clusters e regras de negócio"
[13.0s — 16.5s] Cena 4 — RFP + Análise     "Distribua, colete e compare propostas"
[16.5s — 20.0s] Cena 5 — Negociação        "Kanban + leilão reverso"
[20.0s — 23.5s] Cena 6 — Seleção           "Matriz de awarded program + cobertura"
[23.5s — 27.0s] Cena 7 — Diretório Hotéis  "Sua base mestre, sempre auditada"
[27.0s — 30.0s] Encerramento: logo + URL
```

Cada cena: screenshot real em moldura macOS (skill `product-shot`), título à esquerda em Instrument Serif, subtítulo curto em Inter, micro-animação Ken-Burns (scale 1.0 → 1.05) + fade-in. Transição entre cenas: `fade` de 12 frames.

## Pipeline de produção

1. **Capturar screenshots reais** via Playwright contra `localhost:8080`, autenticando com a sessão Supabase já presente no sandbox. Visitar 7 rotas (`/`, `/diagnostico`, `/estrategia`, `/rfp`, `/analise` ou `/negociacao`, `/selecao`, `/hoteis`) em viewport 1920×1080 e salvar em `/tmp/shots/`. Aguardar dados carregarem (queries assentarem) antes de cada screenshot.
2. **Selecionar tenant com dados** — usar um cliente CORP que tenha o seed Demo aplicado, para que as telas apareçam povoadas em vez de vazias.
3. **Gerar trilha de música** via ElevenLabs Music API (~30s, "calm corporate ambient piano with subtle strings, cinematic, hopeful"). Salvar em `remotion/public/audio/track.mp3`. **Requer** o conector ElevenLabs vinculado — se não houver, sigo sem música (apenas legendas) ou aguardo conexão.
4. **Scaffold Remotion** em `remotion/` (fora de `src/`, não interfere no app). Instalar deps, aplicar o workaround do compositor musl→gnu, e configurar fonts (`@remotion/google-fonts/InstrumentSerif` + `Inter`).
5. **Implementar cenas** em `remotion/src/scenes/` — 1 arquivo por cena, layout assimétrico (texto 40% / screenshot 60%), Ken-Burns sutil, fade entre cenas via `TransitionSeries`.
6. **Renderizar** via script programático (`scripts/render-remotion.mjs`) para `/mnt/documents/sourcinghub-tour.mp4` (1920×1080, h264, com áudio se disponível). Smoke-test com `bunx remotion still` em frames-chave antes do render completo.
7. **Entregar** o MP4 via `<presentation-artifact>`.

## Pontos que preciso confirmar

- **Música**: posso conectar ElevenLabs para gerar a trilha? Sem isso, o vídeo sai mudo com legendas.
- **Tenant**: tem um cliente CORP com Demo já aplicado e dados visíveis? Se não, capturo as telas como estão (algumas podem aparecer vazias).
- **Logo/wordmark**: uso o texto "SourcingHub" em Instrument Serif na abertura/encerramento, ou você quer subir um arquivo de logo?

Quando aprovar, eu sigo direto para captura → render.
