// Navigator Mock OBT — a navigable fake booking portal used to develop and test
// the Rate Loading automation without ever touching a real supplier portal.
// Run: node src/mockPortal.js  (defaults to http://127.0.0.1:4599)
import http from "node:http";

const PORT = Number(process.env.MOCK_PORTAL_PORT ?? 4599);
const USER = process.env.MOCK_PORTAL_USER ?? "demo@navigator.test";
const PASS = process.env.MOCK_PORTAL_PASS ?? "demo1234";

/** Scenario catalogue. The hotel name decides which behaviour the portal shows. */
const HOTELS = {
  "hotel exato": {
    rate: 450, currency: "BRL", roomType: "Standard King", ratePlan: "Corporate Negotiated",
    rateCode: "TA2026", lra: true, taxesIncluded: true, refundable: true,
    cancellation: "Cancelamento gratuito até 24 horas antes do check-in",
    amenities: ["breakfast", "wifi"],
  },
  "hotel tolerancia": {
    rate: 452, currency: "BRL", roomType: "Standard King", ratePlan: "Corporate Negotiated",
    rateCode: "TA2026", lra: true, taxesIncluded: true, refundable: true,
    cancellation: "Cancelamento gratuito até 24 horas antes do check-in",
    amenities: ["breakfast", "wifi"],
  },
  "hotel caro": {
    rate: 610, currency: "BRL", roomType: "Standard King", ratePlan: "Corporate Negotiated",
    rateCode: "TA2026", lra: true, taxesIncluded: true, refundable: true,
    cancellation: "Cancelamento gratuito até 24 horas antes do check-in",
    amenities: ["breakfast", "wifi"],
  },
  "hotel sem cafe": {
    rate: 450, currency: "BRL", roomType: "Standard King", ratePlan: "Corporate Negotiated",
    rateCode: "TA2026", lra: true, taxesIncluded: true, refundable: true,
    cancellation: "Cancelamento gratuito até 24 horas antes do check-in",
    amenities: ["wifi"],
  },
  "hotel nlra": {
    rate: 450, currency: "BRL", roomType: "Standard King", ratePlan: "Corporate Negotiated",
    rateCode: "TA2026", lra: false, taxesIncluded: true, refundable: true,
    cancellation: "Cancelamento gratuito até 24 horas antes do check-in",
    amenities: ["breakfast", "wifi"],
  },
  "hotel moeda": {
    rate: 450, currency: "USD", roomType: "Standard King", ratePlan: "Corporate Negotiated",
    rateCode: "TA2026", lra: true, taxesIncluded: true, refundable: true,
    cancellation: "Cancelamento gratuito até 24 horas antes do check-in",
    amenities: ["breakfast", "wifi"],
  },
  "hotel sem tarifa": null, // rate not loaded
};

const page = (title, body) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${title} — Navigator Mock OBT</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;color:#111}
h1{font-size:20px}label{display:block;margin:12px 0 4px;font-size:13px}
input{padding:8px;width:100%;border:1px solid #ccc;border-radius:6px}
button{margin-top:16px;padding:10px 16px;border:0;border-radius:6px;background:#111;color:#fff;cursor:pointer}
.card{border:1px solid #e5e5e5;border-radius:10px;padding:16px;margin-top:16px}
.k{color:#666;font-size:12px}.v{font-size:15px;font-weight:600}
.banner{background:#fff8e1;border:1px solid #f0d48a;padding:10px;border-radius:8px;font-size:13px}
</style></head><body><div class="banner">Ambiente de testes do Navigator. Nenhum portal real é acessado.</div>
<h1>${title}</h1>${body}</body></html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const send = (html, status = 200) => {
    res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  };

  if (url.pathname === "/" || url.pathname === "/login") {
    if (req.method === "POST") {
      const body = await new Promise((r) => {
        let d = "";
        req.on("data", (c) => (d += c));
        req.on("end", () => r(d));
      });
      const params = new URLSearchParams(body);
      if (params.get("username") !== USER || params.get("password") !== PASS) {
        return send(page("Entrar", `<p id="login-error">Usuário ou senha inválidos.</p>
          <a href="/login">Tentar novamente</a>`), 401);
      }
      res.writeHead(302, { location: "/search", "set-cookie": "mock_session=1; Path=/" });
      return res.end();
    }
    return send(page("Entrar", `<form method="post" action="/login">
      <label for="username">Usuário</label><input id="username" name="username" autocomplete="username">
      <label for="password">Senha</label><input id="password" name="password" type="password" autocomplete="current-password">
      <button type="submit" id="login-submit">Entrar</button></form>`));
  }

  const authed = (req.headers.cookie ?? "").includes("mock_session=1");
  if (!authed) {
    res.writeHead(302, { location: "/login" });
    return res.end();
  }

  if (url.pathname === "/search") {
    return send(page("Buscar tarifa", `<form method="get" action="/results">
      <label for="hotel">Hotel</label><input id="hotel" name="hotel">
      <label for="checkin">Check-in</label><input id="checkin" name="checkin" placeholder="AAAA-MM-DD">
      <label for="checkout">Check-out</label><input id="checkout" name="checkout" placeholder="AAAA-MM-DD">
      <label for="adults">Adultos</label><input id="adults" name="adults" value="1">
      <button type="submit" id="search-submit">Buscar</button></form>`));
  }

  if (url.pathname === "/results") {
    const hotel = (url.searchParams.get("hotel") ?? "").toLowerCase().trim();
    const key = Object.keys(HOTELS).find((k) => hotel.includes(k));
    if (!key) {
      return send(page("Resultados", `<p id="no-hotel">Nenhum hotel encontrado para "${hotel}".</p>`));
    }
    const offer = HOTELS[key];
    if (!offer) {
      return send(page("Resultados", `<p id="no-rate">Nenhuma tarifa corporativa carregada para este hotel.</p>`));
    }
    const nights = 1;
    return send(page("Resultados", `<div class="card" id="offer">
      <div class="k">Hotel</div><div class="v" data-field="hotel">${key}</div>
      <div class="k">Tarifa por noite</div><div class="v" data-field="rate">${offer.currency} ${offer.rate.toFixed(2)}</div>
      <div class="k">Tipo de quarto</div><div class="v" data-field="roomType">${offer.roomType}</div>
      <div class="k">Plano tarifário</div><div class="v" data-field="ratePlan">${offer.ratePlan}</div>
      <div class="k">Código corporativo</div><div class="v" data-field="rateCode">${offer.rateCode}</div>
      <div class="k">Disponibilidade</div><div class="v" data-field="lra">${offer.lra ? "LRA" : "NLRA"}</div>
      <div class="k">Impostos</div><div class="v" data-field="taxes">${offer.taxesIncluded ? "Inclusos" : "Não inclusos"}</div>
      <div class="k">Cancelamento</div><div class="v" data-field="cancellation">${offer.cancellation}</div>
      <div class="k">Comodidades</div><div class="v" data-field="amenities">${offer.amenities.join(", ")}</div>
      <div class="k">Noites</div><div class="v" data-field="nights">${nights}</div>
    </div>`));
  }

  send(page("Não encontrado", "<p>Página inexistente.</p>"), 404);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Mock OBT portal em http://127.0.0.1:${PORT} (usuário ${USER})`);
});
