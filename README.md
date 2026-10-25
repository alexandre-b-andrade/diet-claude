# Diet Coach

Coach de dieta pessoal em PWA, movido pelo Claude. Cada usuário informa a própria API key da Anthropic; todos os dados de saúde ficam no aparelho (IndexedDB). Não há servidor.

Escopo, decisões e roadmap: [`docs/ESCOPO.md`](docs/ESCOPO.md).

## Estado atual (Fases 0 a 4)

- PWA instalável (manifest, service worker, ícones).
- Tela de API key com validação e opção de não salvar no aparelho.
- Entrevista inicial guiada: o coach entende objetivo, dados, histórico, rotina e atividade, grava o perfil com ferramentas e propõe os **Combinados** (metas e regras), que o usuário revisa, edita e aprova.
- Chat com o coach com streaming, ferramentas, anexos (foto e PDF), histórico local e Markdown.
- Diário alimentar: o coach registra refeições com itens, porções e macros usando a tabela **TACO** embutida (NEPA/UNICAMP, via [taco-api](https://github.com/raulfdm/taco-api), MIT) e os alimentos do usuário; código de barras via Open Food Facts; água.
- Dashboard **Hoje** com saldo de kcal e proteína (com ajuste em dia de treino), macros, refeições classificadas (dentro, atenção, fora), água e **Tendências**: peso com média de 7 dias, tendência semanal e projeção da meta, cintura, bioimpedância e aderência dos últimos 7 dias.
- Biblioteca de documentos: plano alimentar, orientações do nutricionista, laudos, exames, tabelas e receitas em PDF ou foto. O coach lê, resume e guarda só o resumo; o plano entra no contexto de todas as conversas.
- Corpo: peso, medidas, bioimpedância (manual ou por foto do laudo via coach), treino, sono, passos e exames laboratoriais, com histórico. Aba **Registros** com diário por dia, corpo e busca de alimentos.
- Prompt dinâmico: perfil e Combinados vigentes entram em todo turno; o bloco fixo usa cache de prompt.
- Escolha de modelo (Opus 5.5 padrão, Sonnet 5.5, Haiku 5.5) e estimativa de custo por mês.
- Deploy automático no GitHub Pages a cada push na `main`.

Próximas fases: fechamento semanal, lembretes e backup (F5), extras (F6).

## Desenvolvimento

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest
npm run build      # typecheck + build em dist/
```

Para simular o caminho do GitHub Pages localmente:

```bash
VITE_BASE=/diet-claude/ npm run build && VITE_BASE=/diet-claude/ npx vite preview
```

## Publicação

O workflow `.github/workflows/deploy.yml` publica `dist/` no GitHub Pages a cada push na `main`. No repositório, em **Settings → Pages**, selecione **Source: GitHub Actions** uma única vez.

## Stack

Vite · React · TypeScript · Tailwind CSS · Dexie (IndexedDB) · `@anthropic-ai/sdk` no browser · vite-plugin-pwa.

## Aviso

Este app não substitui nutricionista ou médico.
