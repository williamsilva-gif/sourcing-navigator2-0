import { createFileRoute } from '@tanstack/react-router';
import { TaxImpactPage } from '@/components/taxImpact/TaxImpactPage';
export const Route = createFileRoute('/_taxAuthenticated/tax-impact-check')({
  ssr: false,
  head: () => ({ meta: [
    { title: 'Tax Impact Check — Navigator' },
    { name: 'description', content: 'Importação privada e comparação determinística de programas e propostas de hospedagem corporativa por cliente.' },
    { property: 'og:title', content: 'Tax Impact Check — Navigator' },
    { property: 'og:description', content: 'Análises versionadas de tarifas Single e Double, benefícios e encargos de hospedagem corporativa.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: TaxImpactPage,
});
