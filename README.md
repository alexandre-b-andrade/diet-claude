# Diet Coach

Coach de dieta pessoal em PWA, movido pelo Claude. Cada usuário informa a própria API key da Anthropic; todos os dados de saúde ficam no aparelho (IndexedDB). Não há servidor.

Escopo, decisões e roadmap: [`docs/ESCOPO.md`](docs/ESCOPO.md).

## Estado atual (Fase 0)

- PWA instalável (manifest, service worker, ícones).
- Tela de API key com validação e opção de não salvar no aparelho.
- Chat com o coach com streaming, histórico local e Markdown.
- Escolha de modelo (Opus 5.5 padrão, Sonnet 5.5, Haiku 5.5) e estimativa de custo por mês.
- Deploy automático no GitHub Pages a cada push na `main`.

Próximas fases: onboarding e Combinados (F1), diário alimentar e dashboard (F2), corpo e tendências (F3), documentos (F4), fechamento semanal e backup (F5).

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
