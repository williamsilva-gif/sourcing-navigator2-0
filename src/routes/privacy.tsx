import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — SourcingHub" },
      {
        name: "description",
        content:
          "Como o SourcingHub coleta, usa e protege seus dados pessoais conforme LGPD e GDPR.",
      },
      { property: "og:title", content: "Política de Privacidade — SourcingHub" },
      {
        property: "og:description",
        content: "Política de privacidade do SourcingHub em conformidade com LGPD e GDPR.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-foreground">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última atualização: {new Date().toLocaleDateString("pt-BR")} · Versão v1.0
        </p>

        <div className="prose prose-sm mt-8 max-w-none text-foreground [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_p]:text-muted-foreground [&_li]:text-muted-foreground">
          <p>
            Esta Política descreve como o <strong>SourcingHub</strong> (operado por Travel Academy)
            trata os dados pessoais dos usuários da plataforma, em conformidade com a{" "}
            <strong>Lei Geral de Proteção de Dados (LGPD — Lei 13.709/18)</strong> e o{" "}
            <strong>Regulamento Geral de Proteção de Dados (GDPR — UE 2016/679)</strong>.
          </p>

          <h2>1. Dados que coletamos</h2>
          <ul>
            <li>
              <strong>Cadastro:</strong> nome, e-mail, organização, papel (TA, TMC, Corp, Hotel).
            </li>
            <li>
              <strong>Hotéis cadastrados:</strong> nome, código, CNPJ, endereço, contato, geolocalização.
            </li>
            <li>
              <strong>Operacionais:</strong> RFPs criadas, respostas, bookings importados, decisões.
            </li>
            <li>
              <strong>Técnicos:</strong> endereço IP, user agent, logs de acesso e de consentimento.
            </li>
          </ul>

          <h2>2. Finalidades do tratamento</h2>
          <ul>
            <li>Operar a plataforma de hotel sourcing corporativo.</li>
            <li>Autenticar usuários e proteger contas.</li>
            <li>Gerar análises e recomendações de negociação.</li>
            <li>Cumprir obrigações legais e regulatórias.</li>
          </ul>

          <h2>3. Bases legais</h2>
          <ul>
            <li>
              <strong>Execução de contrato</strong> (art. 7º, V LGPD / art. 6º(1)(b) GDPR) — para
              prestar o serviço contratado.
            </li>
            <li>
              <strong>Consentimento</strong> (art. 7º, I LGPD / art. 6º(1)(a) GDPR) — para cookies
              opcionais e comunicações de marketing.
            </li>
            <li>
              <strong>Legítimo interesse</strong> (art. 7º, IX LGPD / art. 6º(1)(f) GDPR) — para
              segurança, prevenção a fraudes e melhoria do produto.
            </li>
            <li>
              <strong>Obrigação legal</strong> (art. 7º, II LGPD / art. 6º(1)(c) GDPR) — para
              retenção fiscal e atendimento a autoridades.
            </li>
          </ul>

          <h2>4. Compartilhamento com terceiros</h2>
          <p>Compartilhamos dados estritamente com operadores que sustentam o serviço:</p>
          <ul>
            <li>
              <strong>Lovable Cloud / Supabase</strong> — infraestrutura de banco de dados e
              autenticação.
            </li>
            <li>
              <strong>Cloudflare</strong> — hospedagem e CDN.
            </li>
            <li>
              <strong>Google Maps</strong> — geocoding de endereços de hotéis.
            </li>
          </ul>
          <p>Não vendemos dados pessoais a terceiros.</p>

          <h2>5. Retenção de dados</h2>
          <ul>
            <li>Dados de cadastro: enquanto a conta estiver ativa.</li>
            <li>Logs de acesso: 6 meses (Marco Civil da Internet).</li>
            <li>Dados fiscais e contratuais: 5 anos após o término da relação.</li>
            <li>Logs de consentimento: pelo prazo da relação contratual + 5 anos.</li>
          </ul>

          <h2>6. Seus direitos</h2>
          <p>Conforme LGPD (art. 18) e GDPR (arts. 15–22), você pode:</p>
          <ul>
            <li>Acessar e exportar seus dados (portabilidade).</li>
            <li>Corrigir dados incompletos ou desatualizados.</li>
            <li>Solicitar a exclusão da conta e dos dados associados.</li>
            <li>Revogar consentimentos a qualquer momento.</li>
            <li>Opor-se a tratamentos baseados em legítimo interesse.</li>
          </ul>
          <p>
            Você pode exercer esses direitos diretamente em{" "}
            <Link to="/account/privacy" className="underline">
              /account/privacy
            </Link>{" "}
            ou pelo e-mail abaixo.
          </p>

          <h2>7. Cookies</h2>
          <p>
            Usamos cookies <strong>essenciais</strong> (sessão, segurança), <strong>funcionais</strong>{" "}
            (preferências de UI), <strong>analytics</strong> (uso agregado) e{" "}
            <strong>marketing</strong> (apenas com consentimento explícito). Você pode gerenciá-los
            no banner de cookies ou em /account/privacy.
          </p>

          <h2>8. Encarregado (DPO)</h2>
          <p>
            <strong>Encarregado de Dados (DPO):</strong> William Silva
            <br />
            <strong>E-mail:</strong>{" "}
            <a href="mailto:dpo@travelacademy.com.br" className="underline">
              dpo@travelacademy.com.br
            </a>
          </p>

          <h2>9. Alterações</h2>
          <p>
            Podemos atualizar esta política. Mudanças materiais serão comunicadas no app e por
            e-mail.
          </p>
        </div>
      </div>
    </div>
  );
}
