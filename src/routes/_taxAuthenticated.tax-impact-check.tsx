import { createFileRoute } from '@tanstack/react-router';
import { TaxImpactPage } from '@/components/taxImpact/TaxImpactPage';
export const Route = createFileRoute('/_taxAuthenticated/tax-impact-check')({
  ssr: false,
  head: () => ({ meta: [
    { title: 'Tax Impact Check — Navigator' },
    { name: 'description', content: 'Simulações por diária, volumetria histórica e negociação de hospedagem corporativa com premissas, fontes e relatórios privados.' },
    { property: 'og:title', content: 'Tax Impact Check — Navigator' },
    { property: 'og:description', content: 'Análises versionadas de tarifas Single e Double, benefícios e encargos de hospedagem corporativa.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: TaxImpactPage,
});
