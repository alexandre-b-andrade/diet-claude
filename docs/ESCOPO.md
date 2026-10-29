# Diet Coach PWA — Escopo e Roadmap (v0.2, validado)

> Status: **validado em 2026-10-25**. As perguntas da v0.1 foram respondidas e as decisões estão consolidadas na seção 7. Progresso: F0 a F6 entregues. Sincronização em nuvem permanece fora do escopo (ver seção 9).

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
- Seleção de **modelo** (padrão: `claude-opus-5-5` para conversa; `claude-haiku-5-5` para extrações baratas em lote como classificar refeições; `claude-sonnet-5-5` como opção mais econômica). O usuário vê custo estimado por mês conforme uso.
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
   - o que conta como "fora da dieta" (saldo do dia + qualidade dos alimentos; sem cota de refeições livres);
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
- **Tendências**: peso vs meta com média móvel de 7 dias e projeção; cintura; % gordura e massa magra por bioimpedância; aderência semanal (dias dentro da meta, refeições sinalizadas por qualidade).
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

## 7. Decisões validadas (respostas às perguntas da v0.1)

### Público, distribuição e dados
| Tema | Decisão |
|---|---|
| Público inicial | Amigos e família (dezenas de usuários). |
| Persistência | Somente local (IndexedDB) + exportar/importar backup JSON. Sem login, sem nuvem. |
| Arquivos enviados | Fotos e PDFs são processados e descartados; fica apenas o resumo estruturado extraído. |
| Hospedagem | GitHub Pages neste repositório, deploy por GitHub Actions. |
| Idioma | Somente pt-BR no v1 (estrutura preparada para i18n). |
| Stack | Vite + React + TypeScript + Tailwind + Dexie + Recharts; SDK oficial da Anthropic no browser. |
| Testes | Mínimo nos fluxos críticos: Vitest nos cálculos e no banco local, Playwright no onboarding e no registro de refeição. |

### Modelo e custo
| Tema | Decisão |
|---|---|
| Modelo padrão | **Claude Opus 5.5** (`claude-opus-5-5`) para a conversa. Haiku 5.5 para extrações simples em lote. Usuário pode trocar nas configurações. |
| API key | Informada pelo usuário e salva em `localStorage` (opção de não salvar). Mesmo princípio do B3 app, que usa `fetch` direto; aqui usamos o SDK oficial, que suporta streaming, PDFs e tool use sem código manual. |
| Custo | App mostra tokens acumulados e estimativa em US$ e R$ por mês nas configurações. |

### Comportamento do coach (equivalente ao chat Dieta)
| Tema | Decisão |
|---|---|
| Tom | **Técnico e detalhado**: explica o porquê nutricional, cita macros, fibras, qualidade dos alimentos. |
| Registro de refeição | Texto livre **ou foto do prato**. Resposta sempre com kcal e macros da refeição **e o saldo do dia** (o que falta de kcal e proteína até a meta, com sugestão para as próximas refeições). |
| Dentro/fora da dieta | **Saldo + qualidade**: o saldo calórico e proteico do dia manda, mas o coach sinaliza ultraprocessados, açúcar e frituras. Sem cota de refeições livres; abordagem flexível por calorias. |
| Metas diárias | Calculadas a partir de TMB (Mifflin-St Jeor ou TMB da balança) × fator de atividade, com déficit ou superávit definido nos Combinados. Proteína em g/kg. |
| Plano alimentar | Segue o plano do nutricionista quando existir; propõe plano próprio nos Combinados quando não houver. |
| Sugestões de refeição | Pelo que falta no dia, pelo que o usuário tem em casa e pela rotina e preferências dos Combinados. |
| Dias de treino | Ajusta kcal e carboidratos em dias de treino. |
| Suplementação | Orienta whey, creatina, vitaminas etc. conforme metas e exames, sempre com ressalva de confirmar com profissional. |
| Análises periódicas | Fechamento semanal, leitura comparativa da bioimpedância, projeção de quando a meta será atingida. |

### Tracking
| Tema | Decisão |
|---|---|
| Peso | 3 vezes por semana, com lembrete. Dashboard usa média móvel para suavizar. |
| Cintura | Semanal, com lembrete. |
| Bioimpedância | Manual **ou** foto/PDF do laudo com extração e confirmação. Fonte principal: balança doméstica (Omron, Xiaomi etc.). Campos: % gordura e massa gorda, massa magra/muscular, gordura visceral, água, TMB, idade metabólica. |
| Outros itens no v1 | Treino/atividade física (ajusta meta do dia), água, sono e passos (manual), exames laboratoriais como contexto. |
| Base de alimentos | TACO embutida + tabelas próprias do usuário + código de barras (Open Food Facts) + USDA como complemento. |
| Lembretes | Notificação local no v1 (registro, pesagem, cintura). Push com servidor fica fora. |

### Impacto no roadmap
- **F2** passa a incluir água e código de barras (Open Food Facts) além do diário alimentar.
- **F3** passa a incluir treino, sono, passos e exames laboratoriais, além de peso, cintura e bioimpedância.
- **F5** mantém lembretes locais, fechamento semanal, backup e custo.
- **F6** fica com USDA, relatório PDF para nutricionista e i18n.

## 7.1 Melhorias futuras (backlog, ainda não implementadas)

Itens registrados após as fases 0 a 6, para a próxima rodada:

### Chat (implementado em 2026-10-26)
- ~~Campo de texto que cresce ao digitar~~ (feito, até o máximo ajustável).
- ~~Divisor arrastável entre conversa e campo de texto~~ (feito, toque ou mouse; o tamanho fica salvo no aparelho).
- ~~Campo volta ao tamanho mínimo após enviar~~ (feito).
- ~~Busca dentro da conversa atual~~ (feito em 2026-10-29: botão de lupa no topo do chat, contagem de resultados, anterior e próximo, destaque das mensagens e dos trechos encontrados).
- ~~Histórico de conversas consultável~~ (feito: menu Conversas no topo do chat com lista, prévia, renomear e apagar; busca por texto em todas as mensagens que abre a conversa no ponto encontrado, com destaque).

### Já listados nas respostas anteriores
- Web Push com servidor mínimo (notificação com o app fechado), decisão pendente.
- Guia de primeiro uso para novos usuários (criar chave, instalar, entrevista).
- Teste de ponta a ponta no CI; casos de borda da API (sem crédito, limite de requisições, foto grande).
- Reduzir o bundle principal; completar a tradução das telas de Registros e Combinados.
- Leitura automática da foto da balança de bioimpedância; lista de compras; modo "comer fora".

## 8. Riscos e cuidados
- **Precisão nutricional**: estimativas por foto têm erro alto; o app deve mostrar faixas e pedir confirmação de porções.
- **Saúde**: o coach não prescreve dietas restritivas severas, suplementos ou medicamentos; encaminha para profissional em sinais de alerta (perda de peso muito rápida, TCA, gestação, condições crônicas).
- **Privacidade**: dados sensíveis de saúde no aparelho; API key do usuário; sem analytics de terceiros.
- **Custo de tokens**: sem controle, um usuário ativo pode gastar bastante. Mitigações na seção 5.
- **Limites de PWA no iOS**: notificações e armazenamento podem ser limpos pelo sistema; backup explícito é essencial.

---

## 9. Progresso
1. ~~Validar escopo~~ (feito).
2. ~~F0~~: scaffold, PWA, tela de API key, chat com streaming, deploy no GitHub Pages (feito).
3. ~~F1~~: entrevista inicial guiada com ferramentas (`atualizar_perfil`, `calcular_metas`, `propor_combinados`, `consultar_perfil`), perfil e Combinados versionados no IndexedDB, tela de revisão e aprovação, prompt dinâmico com perfil e Combinados, anexos de foto e PDF no chat (feito).
4. ~~F2~~: diário alimentar com ferramentas (`registrar_refeicao`, `atualizar_refeicao`, `remover_refeicao`, `consultar_diario`, `buscar_alimento`, `buscar_codigo_barras`, `salvar_alimento`, `registrar_agua`), tabela TACO embutida (591 alimentos), alimentos do usuário, código de barras via Open Food Facts com leitor de câmera, saldo do dia com anéis de kcal e proteína, macros, água, aba Registros com diário por dia e busca de alimentos; diário de hoje e de ontem entram no contexto do coach (feito).
5. ~~F3~~: ferramentas de corpo (`registrar_peso`, `registrar_medida`, `registrar_bioimpedancia`, `registrar_treino`, `registrar_dia`, `registrar_exame`, `consultar_historico`), aba Registros › Corpo com formulários e histórico, média móvel de 7 dias, tendência semanal por regressão, projeção da meta, saldo com ajuste em dia de treino, gráficos de peso vs meta, cintura, bioimpedância e aderência de 7 dias no dashboard; resumo corporal no contexto do coach (feito).
6. ~~F4~~: biblioteca de documentos com ferramentas (`salvar_documento`, `atualizar_documento`, `remover_documento`, `consultar_documento`), upload em Registros › Documentos que encaminha o PDF ou foto ao coach, resumo estruturado em Markdown guardado no aparelho (arquivo descartado), planos e orientações completos no contexto do coach e os demais em uma linha com consulta sob demanda (feito).
7. ~~F5~~: fechamento semanal (métricas calculadas no app, análise e ajustes pelo coach via `salvar_fechamento`, histórico em Registros › Semanas), insights determinísticos no dashboard (proteína, kcal, ritmo de peso, pesagem e cintura atrasadas, água, treinos), lembretes locais configuráveis com notificação quando o app está aberto, backup JSON exportar e importar (mesclar ou substituir), resumo automático de conversas longas com Haiku, orçamento mensal com aviso (feito).
8. ~~F6~~: busca complementar no USDA FoodData Central (opcional, com chave própria ou DEMO_KEY, resultados salvos para reuso offline), relatório imprimível para o nutricionista (perfil, Combinados, peso com tendência, medidas, bioimpedância, alimentação por semana, diário recente, exames, fechamentos, documentos; salvar como PDF pelo navegador), idioma pt-BR ou inglês para a interface principal e para as respostas do coach (telas de registro detalhadas permanecem em português) (feito).
9. **Sincronização em nuvem**: não implementada por decisão de escopo (zero backend, dados só no aparelho). Caminho atual: exportar e importar backup JSON. Se desejado no futuro, a opção menos invasiva é sync opcional via Supabase com criptografia no cliente.
