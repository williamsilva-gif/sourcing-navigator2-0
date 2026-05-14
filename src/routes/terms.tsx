import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — SourcingHub" },
      {
        name: "description",
        content: "Termos e condições de uso da plataforma SourcingHub.",
      },
      { property: "og:title", content: "Termos de Uso — SourcingHub" },
      {
        property: "og:description",
        content: "Termos e condições de uso da plataforma SourcingHub.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-foreground">Termos de Uso</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última atualização: {new Date().toLocaleDateString("pt-BR")} · Versão v1.0
        </p>

        <div className="prose prose-sm mt-8 max-w-none text-foreground [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:text-muted-foreground [&_li]:text-muted-foreground">
          <h2>1. Aceitação</h2>
          <p>
            Ao criar uma conta no <strong>SourcingHub</strong> ("Plataforma"), você concorda com
            estes Termos e com a Política de Privacidade. Se não concorda, não use o serviço.
          </p>

          <h2>2. Definições</h2>
          <ul>
            <li>
              <strong>TA (Travel Academy):</strong> operadora da plataforma e Admin Master.
            </li>
            <li>
              <strong>TMC:</strong> agência de viagens corporativa cliente.
            </li>
            <li>
              <strong>Corporativo (Corp):</strong> empresa cliente final que consome o sourcing.
            </li>
            <li>
              <strong>Hotel:</strong> fornecedor que recebe e responde RFPs.
            </li>
          </ul>

          <h2>3. Cadastro e conta</h2>
          <p>
            Você é responsável pela veracidade das informações de cadastro e pela guarda das
            credenciais. É proibido compartilhar contas ou usar credenciais de terceiros.
          </p>

          <h2>4. Uso permitido</h2>
          <ul>
            <li>Não fazer engenharia reversa, scraping massivo ou tentativas de invasão.</li>
            <li>Não utilizar o serviço para finalidade ilícita ou que viole direitos de terceiros.</li>
            <li>Respeitar limites de uso e cotas estabelecidos pelo plano contratado.</li>
          </ul>

          <h2>5. Propriedade intelectual</h2>
          <p>
            A Plataforma, marca, layout, código e algoritmos são de titularidade da Travel Academy.
            Os <strong>dados inseridos pelo cliente</strong> permanecem de sua propriedade — a TA
            atua como operadora desses dados conforme a Política de Privacidade.
          </p>

          <h2>6. Limitação de responsabilidade</h2>
          <p>
            A Plataforma é fornecida "como está". Não garantimos disponibilidade ininterrupta nem
            que o serviço atenderá a expectativas específicas. Não nos responsabilizamos por
            decisões comerciais tomadas com base nas análises geradas.
          </p>

          <h2>7. Rescisão</h2>
          <p>
            Você pode encerrar sua conta a qualquer momento em{" "}
            <Link to="/account/privacy" className="underline">
              /account/privacy
            </Link>
            . A TA pode suspender contas em caso de violação destes Termos, fraude ou inadimplência.
          </p>

          <h2>8. Lei aplicável e foro</h2>
          <p>
            Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o
            foro da Comarca de São Paulo/SP para dirimir controvérsias, com renúncia a qualquer
            outro.
          </p>

          <h2>9. Contato</h2>
          <p>
            Dúvidas:{" "}
            <a href="mailto:contato@travelacademy.com.br" className="underline">
              contato@travelacademy.com.br
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
