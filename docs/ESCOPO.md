# Diet Coach PWA — Proposta de Escopo e Roadmap (v0.1, para validação)

> Status: **rascunho para validação**. Nada de código ainda. Este documento registra o entendimento do escopo, as decisões propostas, as perguntas abertas e um roadmap em fases. Após sua validação ele vira a referência do projeto.

---

## 1. Visão

Um **coach de dieta pessoal** em formato PWA (instalável no celular, funciona offline para consulta de dados) que reproduz a experiência do seu chat "Dieta" para outros usuários. Cada usuário usa a **própria API key da Anthropic**, informada no app (mesmo modelo do B3 app). Todos os dados de saúde ficam **no dispositivo do usuário**; o único tráfego externo é a chamada à API da Anthropic.

Princípios:

1. **Zero backend.** App estático (hospedável em GitHub Pages / Vercel / Netlify). Sem servidor nosso, sem banco nosso, sem custo por usuário.
2. **Dados do usuário são do usuário.** Armazenamento local (IndexedDB) + exportação/importação de backup em JSON.
3. **Chat é a interface principal; o dashboard é o espelho.** O coach extrai dados estruturados das conversas (refeições, peso, medidas) e o dashboard mostra o que foi registrado. Formulários existem como atalho, não como obrigação.
4. **Memória do coach é explícita e editável.** Como cada chamada à API é sem estado, o app mantém um "perfil + combinados + resumos" que vão em todo prompt. O usuário pode ver e corrigir essa memória.

---

## 2. Personas e uso típico

- **Usuário final:** pessoa fazendo dieta com ou sem nutricionista, que quer registrar refeições por texto/foto, acompanhar peso/medidas/bioimpedância e receber orientação diária coerente com seus combinados.
- **Você (criador):** primeiro usuário, referência de comportamento do coach (chat Dieta).

Fluxo diário esperado:
1. Abre o app, vê o dashboard do dia (calorias, proteína, peso vs meta, aderência).
2. Registra café da manhã por texto ou foto no chat ("comi 2 ovos mexidos, 1 fatia de pão integral e café com leite").
3. Coach confirma a extração (kcal, macros, "dentro do plano"), dá um toque curto se necessário.
4. Pede sugestão de almoço compatível com o que falta no dia.
5. À noite, registra o peso ou sobe a bioimpedância do mês.
6. Semanalmente, pede/recebe um "fechamento da semana".

---

## 3. Escopo funcional proposto

### 3.1 Configuração e segurança
- Tela de **API key** (armazenada localmente, com opção de "lembrar neste dispositivo" ou somente em sessão). Validação da chave com uma chamada mínima.
- Seleção de **modelo** (padrão proposto: `claude-sonnet-5-5` para conversa; `claude-haiku-5-5` para extrações baratas em lote como classificar refeições; `claude-opus-5-5` como opção "qualidade máxima"). O usuário vê custo estimado por mês conforme uso.
- Aviso claro de privacidade: dados ficam no aparelho, apenas o conteúdo das conversas vai para a Anthropic.
- Disclaimer de saúde: não substitui nutricionista/médico.

### 3.2 Onboarding (primeiro uso) — "Entendimento + Combinados"
Entrevista conduzida pelo coach, em etapas, com progresso visível:
1. **Objetivo**: emagrecer / manter / ganhar massa / saúde (ex.: glicemia, colesterol), meta de peso e prazo, meta de % gordura ou cintura se tiver.
2. **Histórico disponível**: upload de plano alimentar anterior (PDF/foto), orientações do nutricionista, exames/bioimpedância anteriores, histórico de peso (CSV ou digitado).
3. **Rotina**: horários de trabalho/treino/sono, dias atípicos (ex.: fim de semana), quem cozinha, restrições (alergias, intolerâncias, vegetariano etc.), alimentos que odeia/ama, orçamento.
4. **Atividade física**: tipo, frequência, intensidade.
5. **Combinados**: o coach propõe e o usuário aprova/ajusta:
   - meta calórica diária e meta de proteína (g/kg), faixas de carbo/gordura;
   - número de refeições e janelas de horário;
   - o que conta como "fora da dieta" e quantas "refeições livres" por semana;
   - frequência de pesagem e medição de cintura; frequência de bioimpedância;
   - tom do coach (direto / acolhedor / técnico) e nível de detalhe.
6. Resultado: um **documento "Combinados"** estruturado (JSON + versão legível), editável e versionado. É a base do system prompt dali em diante.

### 3.3 Chat com o coach
- Streaming de resposta, histórico de conversas por dia, busca.
- Entrada por texto, **foto de refeição** (estimativa de porções e macros), **foto de rótulo/tabela nutricional**, PDF.
- O coach usa **ferramentas (tool use)** para gravar dados estruturados no banco local: `registrar_refeicao`, `registrar_peso`, `registrar_medidas`, `registrar_bioimpedancia`, `consultar_alimento`, `consultar_historico`, `atualizar_combinados`. Isso evita "parsing de texto" e permite que o usuário veja exatamente o que foi gravado e corrija.
- Memória: system prompt = perfil + combinados + resumo rolante das últimas semanas + registros do dia; conversas antigas são resumidas automaticamente para caber no contexto e economizar tokens. Uso de prompt caching no prefixo estável.

### 3.4 Registro de alimentação
- Diário por refeição (café, almoço, lanche, jantar, extras) com kcal, proteína, carbo, gordura, fibra; flag "dentro/fora do plano" e motivo.
- **Base de alimentos**: tabela **TACO** (Tabela Brasileira de Composição de Alimentos, UNICAMP, aberta) embutida no app; o usuário pode subir tabelas próprias (CSV/PDF/foto) que são convertidas e indexadas. Alimentos "favoritos" e "minhas receitas" com macros calculados.
- Sugestões de refeição com base no que falta no dia e no que o usuário tem/gosta.
- Edição manual de qualquer registro.

### 3.5 Corpo e medidas
- Peso (diário/semanal), cintura, quadril, outras medidas opcionais.
- **Bioimpedância**: % gordura, massa magra/muscular, gordura visceral, água, TMB, idade metabólica. Entrada manual ou por **foto/PDF do laudo** (InBody, balança Omron, etc.) com extração automática e confirmação.
- Exames laboratoriais básicos opcionais (glicemia, colesterol) — ver pergunta aberta.

### 3.6 Dashboard
- **Hoje**: kcal consumidas vs meta (anel), proteína vs meta, macros, refeições registradas e pendentes, água (opcional).
- **Tendências**: peso vs meta com média móvel de 7 dias e projeção; cintura; % gordura e massa magra por bioimpedância; aderência semanal (dias dentro do plano, refeições livres usadas).
- **Semana**: resumo gerado pelo coach ("fechamento da semana") com ajustes propostos nos combinados.
- Insights contextuais ("sua proteína está abaixo da meta em 5 dos últimos 7 dias").

### 3.7 Documentos e conhecimento do usuário
- Biblioteca: planos alimentares, orientações do nutricionista, laudos, tabelas. Cada documento é lido pelo Claude uma vez, resumido em um "resumo estruturado" que entra na memória, e fica disponível para consulta sob demanda (o PDF completo só é enviado quando o usuário pede algo específico dele, para controlar custo).

### 3.8 Dados, backup e portabilidade
- Exportar/importar tudo em JSON (e CSV do diário/peso). Isso também é o caminho de "trocar de celular".
- Apagar tudo (com confirmação).

### 3.9 PWA
- Instalável, ícone, splash, funciona offline para ver dashboard e registrar manualmente; o chat precisa de internet.
- Lembretes: notificações locais enquanto o app estiver instalado (push real exige servidor; fica fora do v1 — ver perguntas).

---

## 4. Fora do escopo (v1), sugeridos para depois
- Backend / contas / sincronização entre dispositivos.
- Compartilhamento com nutricionista (relatório PDF exportável pode ser um meio-termo barato no v1.5).
- Integração com balanças/relógios (Google Fit, Apple Health).
- Leitor de código de barras (Open Food Facts) — barato de adicionar depois.
- Planejamento de compras / lista de mercado.
- Multi-idioma (v1 em pt-BR).

---

## 5. Arquitetura técnica proposta

| Camada | Escolha | Motivo |
|---|---|---|
| Framework | **Vite + React + TypeScript** | PWA simples, ecossistema amplo, fácil de hospedar estático |
| UI | Tailwind CSS + componentes leves (shadcn/ui) | Mobile-first rápido de iterar |
| PWA | `vite-plugin-pwa` (Workbox) | Manifest, service worker, cache offline |
| Estado/dados | **IndexedDB via Dexie** | Dados estruturados, consultas, volume grande (fotos, PDFs) |
| Gráficos | Recharts | Linhas, barras, anéis |
| Claude | `@anthropic-ai/sdk` no browser (`dangerouslyAllowBrowser`, chave do usuário) | Mesma estratégia do B3 app; streaming, tool use, PDFs e imagens nativos |
| Extração | Tool use com `strict: true` + structured outputs | Dados confiáveis para o banco local |
| Base TACO | JSON embutido, índice de busca local (Fuse.js) | Funciona offline e sem custo de tokens |
| Hospedagem | GitHub Pages (CI com GitHub Actions) | Grátis, versionado |
| Testes | Vitest + Playwright (fluxos críticos) | |

Observações:
- A API key fica em `localStorage` (ou só em memória se o usuário preferir). Nunca sai do dispositivo exceto para `api.anthropic.com`.
- Custo: controlar com prompt caching no prefixo estável, resumos em vez de histórico bruto, Haiku para extrações simples. Mostrar ao usuário uma estimativa de gasto acumulado (tokens × preço).

---

## 6. Roadmap em fases

Cada fase termina com algo usável e publicado.

| Fase | Entrega | Resultado para o usuário |
|---|---|---|
| **F0 – Fundação** | Scaffold Vite/React/TS, PWA instalável, tela de API key, chat básico com streaming, deploy no GitHub Pages | Já conversa com o coach pelo celular |
| **F1 – Onboarding e Combinados** | Entrevista guiada, perfil, documento de Combinados editável, memória no system prompt | Coach personalizado e consistente entre conversas |
| **F2 – Diário alimentar** | Tool use para registrar refeições, base TACO, foto de refeição, dashboard "Hoje" (kcal/proteína/macros, dentro/fora do plano), sugestões de refeição | Tracking diário completo |
| **F3 – Corpo e tendências** | Peso, cintura, bioimpedância (manual + laudo por foto/PDF), gráficos de tendência vs meta, projeções | Acompanha progresso real |
| **F4 – Documentos e conhecimento** | Biblioteca de PDFs/fotos (planos, nutricionista, tabelas próprias), resumos estruturados, consulta sob demanda | Coach "conhece" o histórico do usuário |
| **F5 – Rotina e fechamento** | Fechamento semanal, insights, lembretes locais, exportar/importar backup, controle de custo de tokens | Hábito sustentado, dados portáteis |
| **F6 – Extras (opcional)** | Código de barras, relatório PDF para nutricionista, sync em nuvem, i18n | Expansão conforme uso |

Estimativa: F0–F2 formam o MVP real. Sugiro validar com 2–3 usuários ao fim da F2 antes de seguir.

---

## 7. Perguntas abertas (preciso das respostas para fechar o escopo)

### Sobre o chat Dieta e o B3 app
1. **Chat Dieta**: não tenho acesso a ele a partir deste repositório. Pode colar aqui as **instruções do projeto/system prompt**, o estilo de resposta esperado e 2–3 exemplos de interações típicas (registro de refeição, pedido de sugestão, análise de bioimpedância)? Isso define o comportamento do coach.
2. **B3 app**: qual stack ele usa (React? Vite? outra), como guarda a API key e como chama a API (SDK no browser ou fetch)? Posso reaproveitar a mesma abordagem e até componentes.

### Público e distribuição
3. Público inicial: amigos/família (dezenas) ou aberto ao público? Isso muda o peso de onboarding, disclaimers e suporte.
4. Hospedagem: GitHub Pages neste repositório está bom? Precisa de domínio próprio?
5. Idioma: só pt-BR no v1?

### Dados e persistência
6. Confirma **somente local + backup JSON** no v1 (sem login, sem nuvem)? Trocar de celular = exportar/importar.
7. Fotos de refeições e PDFs ficam guardados no aparelho (ocupam espaço) ou só o resumo extraído?

### Funcionalidades
8. Base de alimentos: TACO embutida é suficiente? Quer também USDA (inglês) ou outra tabela que você já usa no chat Dieta?
9. Bioimpedância: quais campos você acompanha hoje (gordura %, massa muscular, visceral, água, TMB…)? Qual aparelho/laudo (para testar a leitura por foto)?
10. Plano alimentar: o coach deve **seguir** o plano do nutricionista quando existir, **gerar** um plano próprio quando não existir, ou ambos?
11. Treino/exercício: registrar atividade física e ajustar meta calórica do dia, ou fica fora?
12. Água, sono, passos: algum deles entra no tracking do v1?
13. Exames laboratoriais (glicemia, colesterol, etc.): entram como contexto para o coach?
14. "Refeições livres": você usa esse conceito (ex.: 2 por semana)? Como define "fora da dieta" hoje?
15. Lembretes: notificação local (só funciona com app instalado e, no iOS, com limitações) é aceitável no v1, ou deixamos para depois?

### Modelo e custo
16. Modelo padrão: proposta é Sonnet 5.5 para conversa e Haiku 5.5 para extrações. Prefere Opus 5.5 como padrão (mais caro, mais capaz)?
17. Quer que o app mostre ao usuário uma estimativa de custo em R$/US$ por mês?

### Técnico
18. Stack proposta (Vite + React + TS + Tailwind + Dexie): ok, ou prefere algo que você já domine do B3 app?
19. Testes automatizados: nível desejado (mínimo nos fluxos críticos vs cobertura ampla)?

---

## 8. Riscos e cuidados
- **Precisão nutricional**: estimativas por foto têm erro alto; o app deve mostrar faixas e pedir confirmação de porções.
- **Saúde**: o coach não prescreve dietas restritivas severas, suplementos ou medicamentos; encaminha para profissional em sinais de alerta (perda de peso muito rápida, TCA, gestação, condições crônicas).
- **Privacidade**: dados sensíveis de saúde no aparelho; API key do usuário; sem analytics de terceiros.
- **Custo de tokens**: sem controle, um usuário ativo pode gastar bastante. Mitigações na seção 5.
- **Limites de PWA no iOS**: notificações e armazenamento podem ser limpos pelo sistema; backup explícito é essencial.

---

## 9. Próximos passos
1. Você responde às perguntas da seção 7 (pode ser direto no chat).
2. Ajusto este documento (v0.2) e fechamos o roadmap.
3. Início da F0.
