import type { Backup } from "./backup";
import type {
  Activity,
  BioimpedanceEntry,
  ChatMessage,
  Combinados,
  Conversation,
  CustomFood,
  DailyLog,
  LabResult,
  Meal,
  MealItem,
  Measurement,
  Profile,
  UsageRecord,
  UserDocument,
  WaterEntry,
  WeeklyReview,
} from "./db";
import { addDays, toDateKey } from "./dates";
import { somarItens } from "./diary";
import { estimateCostUsd } from "./pricing";
import { inicioSemana, metricasEmTexto, metricasSemana } from "./weekly";

/** Gerador pseudoaleatório determinístico (os mesmos dados a cada geração). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const item = (nome: string, quantidade: number, unidade: string, gramas: number, kcal: number, p: number, c: number, g: number, fib = 0, fonte = "taco"): MealItem => ({
  nome,
  quantidade,
  unidade,
  gramas,
  kcal,
  proteinaG: p,
  carboG: c,
  gorduraG: g,
  fibraG: fib,
  fonte,
});

/** Cardápio com valores aproximados da TACO. */
const CAFES: { descricao: string; itens: MealItem[]; cls: Meal["classificacao"]; motivo?: string }[] = [
  { descricao: "2 ovos mexidos, 1 fatia de pão integral, café com leite", itens: [item("Ovo de galinha, mexido", 2, "unidade", 100, 184, 13.3, 1.6, 13.6), item("Pão integral", 1, "fatia", 30, 75, 3.0, 13.0, 1.1, 2.1), item("Café com leite desnatado", 1, "xícara", 200, 70, 6.8, 9.8, 0.4, 0, "estimativa")], cls: "dentro" },
  { descricao: "Iogurte natural com aveia e banana", itens: [item("Iogurte natural desnatado", 1, "pote", 170, 71, 7.1, 9.6, 0.5), item("Aveia em flocos", 3, "colheres de sopa", 30, 118, 4.2, 20.1, 2.5, 2.7), item("Banana prata", 1, "unidade", 80, 78, 1.0, 20.8, 0.1, 1.6)], cls: "dentro" },
  { descricao: "Tapioca com queijo minas e ovo", itens: [item("Tapioca (goma hidratada)", 3, "colheres de sopa", 60, 147, 0, 36.3, 0), item("Queijo minas frescal", 1, "fatia", 30, 79, 5.3, 1.0, 6.1), item("Ovo cozido", 1, "unidade", 50, 73, 6.7, 0.3, 4.8)], cls: "dentro" },
  { descricao: "Pão na chapa com manteiga e café", itens: [item("Pão francês", 1, "unidade", 50, 150, 4.0, 29.3, 1.6, 1.2), item("Manteiga com sal", 1, "colher de chá", 10, 73, 0.1, 0, 8.2), item("Café preto", 1, "xícara", 100, 3, 0.2, 0.7, 0)], cls: "atencao", motivo: "Pouca proteína no café da manhã" },
];
const ALMOCOS: typeof CAFES = [
  { descricao: "Arroz integral, feijão carioca, frango grelhado e salada", itens: [item("Arroz integral cozido", 4, "colheres de sopa", 120, 149, 3.1, 31.0, 1.2, 3.2), item("Feijão carioca cozido", 1, "concha", 100, 76, 4.8, 13.6, 0.5, 8.5), item("Frango, peito, grelhado", 150, "g", 150, 239, 48.0, 0, 3.9), item("Salada de alface e tomate", 1, "prato", 120, 24, 1.4, 4.4, 0.3, 1.6, "estimativa")], cls: "dentro" },
  { descricao: "Carne moída refogada, arroz, feijão e abobrinha", itens: [item("Carne bovina moída refogada", 120, "g", 120, 258, 32.0, 0, 13.6), item("Arroz branco cozido", 4, "colheres de sopa", 120, 154, 3.0, 33.7, 0.2, 1.9), item("Feijão preto cozido", 1, "concha", 100, 77, 4.5, 14.0, 0.5, 8.4), item("Abobrinha refogada", 3, "colheres de sopa", 90, 25, 1.1, 3.6, 0.9, 1.4)], cls: "dentro" },
  { descricao: "Tilápia assada com batata doce e brócolis", itens: [item("Tilápia, filé, assado", 160, "g", 160, 154, 32.0, 0, 2.6), item("Batata doce cozida", 150, "g", 150, 116, 1.0, 28.3, 0.2, 3.3), item("Brócolis cozido", 1, "xícara", 90, 23, 2.0, 3.9, 0.4, 3.1)], cls: "dentro" },
  { descricao: "Macarrão à bolonhesa com queijo ralado", itens: [item("Macarrão cozido", 1, "prato", 200, 222, 7.2, 46.0, 1.2, 3.2), item("Molho bolonhesa", 1, "concha", 150, 210, 15.0, 8.0, 12.0, 1.5, "estimativa"), item("Queijo parmesão ralado", 1, "colher de sopa", 10, 45, 3.6, 0.2, 3.3)], cls: "atencao", motivo: "Carboidrato alto para o almoço e proteína abaixo do ideal" },
  { descricao: "Estrogonofe de frango com arroz e batata palha", itens: [item("Estrogonofe de frango", 1, "concha", 180, 290, 24.0, 8.0, 18.0, 0.5, "estimativa"), item("Arroz branco cozido", 4, "colheres de sopa", 120, 154, 3.0, 33.7, 0.2, 1.9), item("Batata palha", 2, "colheres de sopa", 20, 104, 1.0, 10.0, 6.8, 0.6, "estimativa")], cls: "atencao", motivo: "Creme de leite e batata palha elevam gordura" },
];
const LANCHES: typeof CAFES = [
  { descricao: "Whey com água e 1 maçã", itens: [item("Whey protein (dose)", 1, "scoop", 30, 120, 24.0, 3.0, 1.5, 0, "usuario"), item("Maçã fuji", 1, "unidade", 130, 73, 0.4, 19.7, 0.3, 1.7)], cls: "dentro" },
  { descricao: "Castanhas e café", itens: [item("Castanha de caju torrada", 1, "punhado", 30, 171, 5.6, 8.9, 13.9, 1.1), item("Café preto", 1, "xícara", 100, 3, 0.2, 0.7, 0)], cls: "dentro" },
  { descricao: "Pão de queijo e café com leite", itens: [item("Pão de queijo assado", 2, "unidades", 60, 181, 3.1, 20.6, 9.8, 0.5), item("Café com leite integral", 1, "xícara", 200, 95, 5.6, 9.0, 4.4, 0, "estimativa")], cls: "atencao", motivo: "Lanche sem proteína relevante" },
  { descricao: "Iogurte proteico e morangos", itens: [item("Iogurte proteico", 1, "pote", 150, 90, 15.0, 6.0, 0.5, 0, "openfoodfacts"), item("Morango", 10, "unidades", 120, 36, 1.1, 8.2, 0.4, 2.0)], cls: "dentro" },
];
const JANTARES: typeof CAFES = [
  { descricao: "Omelete de 3 ovos com queijo e salada", itens: [item("Omelete de ovos", 3, "ovos", 150, 240, 19.5, 2.4, 17.0), item("Queijo muçarela", 1, "fatia", 20, 56, 4.5, 0.6, 4.0), item("Salada verde com azeite", 1, "prato", 120, 70, 1.5, 4.0, 5.5, 1.6, "estimativa")], cls: "dentro" },
  { descricao: "Sopa de legumes com frango desfiado", itens: [item("Sopa de legumes", 1, "prato fundo", 300, 120, 4.0, 20.0, 2.5, 4.0, "estimativa"), item("Frango, peito, cozido, desfiado", 100, "g", 100, 163, 31.5, 0, 3.2)], cls: "dentro" },
  { descricao: "Salmão grelhado com purê de mandioquinha", itens: [item("Salmão grelhado", 140, "g", 140, 335, 36.5, 0, 20.0), item("Purê de mandioquinha", 3, "colheres de sopa", 120, 124, 1.0, 29.0, 0.3, 2.2, "estimativa")], cls: "dentro" },
  { descricao: "Pizza de calabresa (3 fatias) e refrigerante", itens: [item("Pizza de calabresa", 3, "fatias", 300, 810, 33.0, 84.0, 36.0, 4.5, "estimativa"), item("Refrigerante cola", 1, "lata", 350, 147, 0, 37.0, 0)], cls: "fora", motivo: "Ultraprocessado, açúcar e gordura; estourou o saldo do dia" },
  { descricao: "Hambúrguer artesanal com batata frita", itens: [item("Hambúrguer artesanal", 1, "unidade", 250, 620, 32.0, 42.0, 34.0, 2.0, "estimativa"), item("Batata frita", 1, "porção média", 120, 312, 3.8, 41.4, 14.9, 3.2)], cls: "fora", motivo: "Fritura e gordura alta; saldo estourado" },
];

export const DEMO_NAME = "Marina (demonstração)";

/** Monta um backup completo e verossímil, com datas relativas a `hoje`. */
export function buildDemoBackup(hoje = new Date()): Backup {
  const rand = rng(20261030);
  const pick = <T>(arr: T[], skipLast?: T): T => {
    let v = arr[Math.floor(rand() * arr.length)];
    if (skipLast !== undefined && arr.length > 1 && v === skipLast) v = arr[(arr.indexOf(v) + 1) % arr.length];
    return v;
  };
  const today = toDateKey(hoje);
  const DIAS = 56;
  const inicio = addDays(today, -(DIAS - 1));
  const ts = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00`).getTime();
  const now = Date.now();

  // Perfil e Combinados
  const profile: Profile = {
    id: 1,
    status: "active",
    nome: DEMO_NAME,
    sexo: "feminino",
    nascimento: "1988-04-12",
    alturaCm: 168,
    pesoAtualKg: 0, // preenchido abaixo
    cinturaCm: 0,
    objetivo: "emagrecer",
    metaPesoKg: 68,
    prazo: "6 meses",
    metaDetalhes: "Chegar a 25% de gordura e cintura abaixo de 80 cm",
    nivelAtividade: "moderado",
    treinos: "Musculação 3x por semana (seg, qua, sex) e caminhada no fim de semana",
    rotina: "Trabalho das 9h às 18h em escritório; acorda 6h30, dorme 23h; cozinha em casa durante a semana, almoça fora às quartas",
    restricoes: "Intolerância leve à lactose (evita leite integral)",
    preferencias: "Gosta de ovos, frango, peixe, frutas e iogurte; evita fígado e quiabo; orçamento moderado",
    saude: "Sem doenças; vitamina D baixa no último exame",
    historico: "Fez low carb em 2024 e perdeu 5 kg, recuperou em 2025. Nunca contou calorias antes.",
    planoNutricionista: "Plano de 1800 kcal com 5 refeições (dr. Paulo, set/2026)",
    createdAt: ts(inicio, "08:00"),
    updatedAt: now,
  };

  const combinados: Combinados[] = [
    {
      id: 1,
      versao: 1,
      status: "substituido",
      createdAt: ts(inicio, "08:30"),
      aprovadoEm: ts(inicio, "08:45"),
      metaKcal: 1900,
      metaProteinaG: 140,
      carboMinG: 170,
      carboMaxG: 220,
      gorduraMinG: 53,
      gorduraMaxG: 74,
      fibraG: 27,
      aguaMl: 2600,
      refeicoes: [
        { nome: "Café da manhã", horario: "07:00" },
        { nome: "Lanche da manhã", horario: "10:00" },
        { nome: "Almoço", horario: "12:30" },
        { nome: "Lanche da tarde", horario: "16:00" },
        { nome: "Jantar", horario: "19:30" },
      ],
      treinoAjusteKcal: 200,
      treinoAjusteCarboG: 40,
      pesagem: "3x por semana (seg, qua, sex), em jejum",
      cintura: "toda segunda-feira",
      bioimpedancia: "mensal, na academia",
      tom: "tecnico",
      regras: ["Proteína em todas as refeições", "Água 2,6 L por dia", "Álcool só no fim de semana, no máximo 2 doses", "Registrar as refeições no mesmo dia"],
      racional: "TMB 1.430 kcal (Mifflin-St Jeor, 74 kg, 168 cm, 38 anos), gasto total 2.217 kcal com fator moderado, déficit de 300 kcal arredondado para 1.900. Proteína 1,9 g/kg.",
    },
    {
      id: 2,
      versao: 2,
      status: "aprovado",
      createdAt: ts(addDays(inicio, 28), "09:00"),
      aprovadoEm: ts(addDays(inicio, 28), "09:10"),
      metaKcal: 1850,
      metaProteinaG: 140,
      carboMinG: 160,
      carboMaxG: 210,
      gorduraMinG: 51,
      gorduraMaxG: 72,
      fibraG: 26,
      aguaMl: 2500,
      refeicoes: [
        { nome: "Café da manhã", horario: "07:00" },
        { nome: "Lanche da manhã", horario: "10:00" },
        { nome: "Almoço", horario: "12:30" },
        { nome: "Lanche da tarde", horario: "16:00" },
        { nome: "Jantar", horario: "19:30" },
      ],
      treinoAjusteKcal: 200,
      treinoAjusteCarboG: 40,
      pesagem: "3x por semana (seg, qua, sex), em jejum",
      cintura: "toda segunda-feira",
      bioimpedancia: "mensal, na academia",
      tom: "tecnico",
      regras: ["Proteína em todas as refeições", "Água 2,5 L por dia", "Álcool só no fim de semana, no máximo 2 doses", "Registrar as refeições no mesmo dia", "Jantar leve nos dias sem treino"],
      racional: "Recalculado após 4 semanas: peso caiu para 72 kg e o ritmo estava em 0,45 kg/semana. Meta ajustada em -50 kcal para manter o déficit. Ajustado manualmente pela usuária a partir da v1.",
    },
  ];

  // Refeições e água
  const meals: Meal[] = [];
  const water: WaterEntry[] = [];
  const activities: Activity[] = [];
  const daily: DailyLog[] = [];
  let mealId = 1;
  let lastCafe: (typeof CAFES)[number] | undefined;
  for (let i = 0; i < DIAS; i++) {
    const date = addDays(inicio, i);
    const dow = new Date(`${date}T12:00:00`).getDay();
    const fimDeSemana = dow === 0 || dow === 6;
    // Alguns dias sem registro (viagem na semana 3, e um ou outro esquecimento)
    if (i >= 17 && i <= 19) continue;
    if (rand() < 0.06) continue;
    const treino = [1, 3, 5].includes(dow) && rand() < 0.85;
    if (treino) activities.push({ date, tipo: "musculação", duracaoMin: 55 + Math.round(rand() * 15), intensidade: rand() < 0.3 ? "intensa" : "moderada", createdAt: ts(date, "07:40") });
    if (fimDeSemana && rand() < 0.6) activities.push({ date, tipo: "caminhada", duracaoMin: 40 + Math.round(rand() * 20), intensidade: "leve", createdAt: ts(date, "09:10") });

    const cafe = pick(CAFES, lastCafe);
    lastCafe = cafe;
    const almoco = pick(ALMOCOS);
    const lanche = pick(LANCHES);
    const semJantarPesado = !fimDeSemana || rand() < 0.5;
    const jantar = semJantarPesado ? pick(JANTARES.slice(0, 3)) : pick(JANTARES.slice(3));
    const plano: [string, string, (typeof CAFES)[number]][] = [
      ["07:10", "Café da manhã", cafe],
      ["12:40", "Almoço", almoco],
      ["16:05", "Lanche da tarde", lanche],
      ["19:45", "Jantar", jantar],
    ];
    // Dia incompleto de vez em quando (esqueceu o jantar)
    const registrar = rand() < 0.08 ? plano.slice(0, 3) : plano;
    for (const [hora, refeicao, r] of registrar) {
      const itens = r.itens.map((x) => ({ ...x }));
      const t = somarItens(itens);
      meals.push({
        id: mealId++,
        date,
        hora,
        refeicao,
        descricao: r.descricao,
        itens,
        ...t,
        classificacao: r.cls,
        motivo: r.motivo,
        createdAt: ts(date, hora) + 5 * 60_000,
      });
    }
    const copos = 5 + Math.floor(rand() * 5);
    for (let k = 0; k < copos; k++) water.push({ date, ml: [200, 250, 300, 500][Math.floor(rand() * 4)], createdAt: ts(date, `${String(8 + k * 2).padStart(2, "0")}:00`) });
    if (rand() < 0.8) daily.push({ date, sonoHoras: Math.round((6.2 + rand() * 1.8) * 10) / 10, passos: 4000 + Math.round(rand() * 7000), updatedAt: ts(date, "22:30") });
  }

  // Peso 3x/semana com tendência de -0,45 kg/semana e ruído; cintura semanal
  const measurements: Measurement[] = [];
  let mid = 1;
  for (let i = 0; i < DIAS; i++) {
    const date = addDays(inicio, i);
    const dow = new Date(`${date}T12:00:00`).getDay();
    const base = 74.6 - (i / 7) * 0.45;
    if ([1, 3, 5].includes(dow) && !(i >= 17 && i <= 19)) {
      measurements.push({ id: mid++, date, tipo: "peso", valor: Math.round((base + (rand() - 0.5) * 0.6) * 10) / 10, createdAt: ts(date, "06:45") });
    }
    if (dow === 1 && !(i >= 17 && i <= 19)) {
      measurements.push({ id: mid++, date, tipo: "cintura", valor: Math.round((88 - (i / 7) * 0.5 + (rand() - 0.5) * 0.6) * 10) / 10, createdAt: ts(date, "06:50") });
    }
  }
  const pesos = measurements.filter((m) => m.tipo === "peso");
  profile.pesoAtualKg = pesos[pesos.length - 1].valor;
  profile.cinturaCm = measurements.filter((m) => m.tipo === "cintura").at(-1)!.valor;

  const bioimpedance: BioimpedanceEntry[] = [0, 28, 55].map((d, k) => {
    const date = addDays(inicio, d);
    return {
      id: k + 1,
      date,
      pesoKg: Math.round((74.6 - (d / 7) * 0.45) * 10) / 10,
      gorduraPct: [31.2, 29.6, 28.1][k],
      massaGordaKg: [23.3, 21.3, 19.8][k],
      massaMagraKg: [51.3, 50.9, 50.7][k],
      massaMuscularKg: [28.4, 28.3, 28.4][k],
      gorduraVisceral: [8, 7, 7][k],
      aguaPct: [50.1, 51.0, 51.8][k],
      tmbKcal: [1430, 1415, 1408][k],
      idadeMetabolica: [44, 42, 40][k],
      fonte: "balança da academia",
      createdAt: ts(date, "08:00"),
    };
  });
  profile.bioimpedancia = { data: bioimpedance[2].date, gorduraPct: 28.1, massaGordaKg: 19.8, massaMagraKg: 50.7, massaMuscularKg: 28.4, gorduraVisceral: 7, aguaPct: 51.8, tmbKcal: 1408, idadeMetabolica: 40 };

  const labs: LabResult[] = [
    { id: 1, date: addDays(inicio, -10), exame: "Glicemia de jejum", valor: 96, unidade: "mg/dL", referencia: "70–99", createdAt: now },
    { id: 2, date: addDays(inicio, -10), exame: "Colesterol total", valor: 212, unidade: "mg/dL", referencia: "< 190", createdAt: now },
    { id: 3, date: addDays(inicio, -10), exame: "HDL", valor: 48, unidade: "mg/dL", referencia: "> 40", createdAt: now },
    { id: 4, date: addDays(inicio, -10), exame: "LDL", valor: 138, unidade: "mg/dL", referencia: "< 130", createdAt: now },
    { id: 5, date: addDays(inicio, -10), exame: "Triglicerídeos", valor: 131, unidade: "mg/dL", referencia: "< 150", createdAt: now },
    { id: 6, date: addDays(inicio, -10), exame: "Vitamina D (25-OH)", valor: 22, unidade: "ng/mL", referencia: "> 30", createdAt: now },
    { id: 7, date: addDays(inicio, 50), exame: "Glicemia de jejum", valor: 89, unidade: "mg/dL", referencia: "70–99", createdAt: now },
    { id: 8, date: addDays(inicio, 50), exame: "Colesterol total", valor: 196, unidade: "mg/dL", referencia: "< 190", createdAt: now },
    { id: 9, date: addDays(inicio, 50), exame: "LDL", valor: 124, unidade: "mg/dL", referencia: "< 130", createdAt: now },
    { id: 10, date: addDays(inicio, 50), exame: "Vitamina D (25-OH)", valor: 31, unidade: "ng/mL", referencia: "> 30", createdAt: now },
  ];

  const documents: UserDocument[] = [
    {
      id: 1,
      titulo: "Plano alimentar dr. Paulo (set/2026)",
      tipo: "plano",
      data: addDays(inicio, -5),
      resumo: `## Metas\n- 1.800 kcal/dia, 130 g de proteína, 5 refeições\n\n## Café da manhã (7h)\n- 2 ovos ou 1 pote de iogurte natural + 3 col. de aveia\n- 1 fruta\n- Café sem açúcar\n\n## Lanche da manhã (10h)\n- 1 fruta + 10 castanhas\n\n## Almoço (12h30)\n- 4 col. de arroz integral, 1 concha de feijão\n- 150 g de proteína magra (frango, peixe ou carne magra)\n- Salada à vontade com 1 fio de azeite\n\n## Lanche da tarde (16h)\n- Whey com água ou iogurte proteico\n\n## Jantar (19h30)\n- Proteína + legumes; evitar massas à noite\n\n## Observações\n- Água 2,5 L\n- Suplementar vitamina D 2.000 UI/dia (receita anexa)`,
      arquivoNome: "plano-dr-paulo.pdf",
      createdAt: ts(inicio, "09:00"),
      updatedAt: ts(inicio, "09:00"),
    },
    {
      id: 2,
      titulo: "Exames laboratoriais (pré-início)",
      tipo: "exame",
      data: addDays(inicio, -10),
      resumo: "Glicemia 96, colesterol total 212 (alto), HDL 48, LDL 138 (alto), triglicerídeos 131, vitamina D 22 (baixa). Médico recomendou dieta e reposição de vitamina D.",
      arquivoNome: "exames-set-2026.pdf",
      createdAt: ts(inicio, "09:05"),
      updatedAt: ts(inicio, "09:05"),
    },
    {
      id: 3,
      titulo: "Receita: omelete proteica",
      tipo: "receita",
      resumo: "3 ovos, 20 g de queijo muçarela, tomate e cebolinha. Aproximadamente 300 kcal, 24 g de proteína, 3 g de carboidrato, 21 g de gordura.",
      createdAt: ts(addDays(inicio, 9), "20:00"),
      updatedAt: ts(addDays(inicio, 9), "20:00"),
    },
  ];

  const foods: CustomFood[] = [
    { id: 1, nome: "Whey protein baunilha", marca: "Marca X", kcal: 400, proteinaG: 80, carboG: 10, gorduraG: 5, porcaoG: 30, fonte: "usuario", createdAt: ts(inicio, "16:00") },
    { id: 2, nome: "Iogurte proteico morango", marca: "Marca Y", kcal: 60, proteinaG: 10, carboG: 4, gorduraG: 0.3, porcaoG: 150, fonte: "openfoodfacts", codigoBarras: "7891000000000", createdAt: ts(addDays(inicio, 3), "16:00") },
  ];

  // Fechamentos semanais
  const reviews: WeeklyReview[] = [];
  const semanas: string[] = [];
  for (let s = inicioSemana(inicio); addDays(s, 6) < today; s = addDays(s, 7)) semanas.push(s);
  const textos = [
    "Primeira semana completa de registros. Proteína ficou na meta em 5 de 6 dias; o café da manhã de pão com manteiga puxou a média para baixo. Peso ainda oscilando pela retenção inicial.",
    "Semana estável. Jantares leves nos dias sem treino funcionaram. Pizza de sábado estourou o saldo em 600 kcal, mas a média semanal ficou dentro.",
    "Viagem de 3 dias sem registros. Nos dias registrados a aderência foi boa. Peso retomou a queda ao voltar.",
    "Melhor semana até aqui: 7 dias registrados, proteína na meta todos os dias, 3 treinos. Cintura caiu 1 cm.",
    "Metas recalculadas para 1.850 kcal após 4 semanas (peso 72 kg). Ritmo de 0,45 kg/semana está no alvo de 0,5 a 1% do peso.",
    "Duas refeições fora no fim de semana (hambúrguer e pizza). Ainda assim a média ficou 80 kcal acima da meta, dentro da tolerância.",
    "Bioimpedância do mês: gordura de 29,6% para 28,1%, massa magra preservada. Sono abaixo de 7 h em 4 noites; vale observar.",
    "Exames de controle: LDL de 138 para 124 e vitamina D normalizada com a suplementação. Boa semana de treinos.",
  ];
  const ajustes = [
    "- Trocar o pão com manteiga por ovos ou iogurte no café\n- Manter 2,6 L de água",
    "- Manter jantar leve nos dias sem treino\n- Planejar a refeição livre do fim de semana",
    "- Em viagem, registrar pelo menos o almoço e o jantar\n- Levar whey e castanhas",
    "- Manter o padrão\n- Medir cintura na segunda em jejum",
    "- Nova meta: 1.850 kcal, 140 g de proteína\n- Carboidrato 160 a 210 g",
    "- Uma refeição livre por fim de semana, não duas\n- Escolher pizza ou hambúrguer, não os dois",
    "- Dormir antes das 23h nos dias de treino\n- Manter creatina 3 g/dia",
    "- Repetir exames em 3 meses\n- Manter vitamina D 2.000 UI",
  ];
  semanas.forEach((s, k) => {
    const fim = addDays(s, 6);
    const m = metricasSemana(s, fim, meals, water, activities, pesos, combinados[k >= 4 ? 1 : 0]);
    if (!m.diasRegistrados) return;
    reviews.push({
      id: k + 1,
      semanaInicio: s,
      semanaFim: fim,
      resumo: `## Semana ${k + 1}\n${textos[k % textos.length]}\n\n### Números\n${metricasEmTexto(m).split("\n").slice(1).map((l) => `- ${l}`).join("\n")}`,
      ajustes: ajustes[k % ajustes.length],
      metricas: { mediaKcal: m.mediaKcal, mediaProteinaG: m.mediaProteinaG, diasRegistrados: m.diasRegistrados, variacaoPesoKg: m.variacaoPesoKg },
      createdAt: ts(addDays(fim, 1), "08:30"),
    });
  });

  // Conversas
  const conversations: Conversation[] = [];
  const messages: ChatMessage[] = [];
  let msgId = 1;
  const addConv = (kind: Conversation["kind"], title: string, date: string, turns: { role: ChatMessage["role"]; content: string; hora: string; toolEvents?: ChatMessage["toolEvents"]; hidden?: boolean }[]) => {
    const id = conversations.length + 1;
    conversations.push({ id, kind, title, createdAt: ts(date, turns[0].hora), updatedAt: ts(date, turns[turns.length - 1].hora) });
    for (const t of turns) messages.push({ id: msgId++, conversationId: id, role: t.role, content: t.content, createdAt: ts(date, t.hora), toolEvents: t.toolEvents, hidden: t.hidden });
  };

  addConv("onboarding", "Entrevista inicial", inicio, [
    { role: "user", content: "Olá, quero começar minha entrevista inicial.", hora: "08:00", hidden: true },
    { role: "assistant", content: "Olá. Sou seu coach de dieta: vou entender seu objetivo, rotina e histórico e propor os Combinados que vamos acompanhar.\n\n**Etapa 1, objetivo.** O que você quer alcançar, qual o seu peso atual e qual a meta de peso e prazo?", hora: "08:01" },
    { role: "user", content: "Quero emagrecer. Estou com 74,6 kg e quero chegar a 68 kg em uns 6 meses. Também quero baixar o % de gordura, estou em 31%.", hora: "08:03" },
    { role: "assistant", content: "Anotado. 6,6 kg em 6 meses dá cerca de 0,25 kg por semana, um ritmo conservador e sustentável.\n\n**Etapa 2, dados básicos.** Sexo, data de nascimento, altura e, se souber, cintura atual.", hora: "08:03", toolEvents: [{ name: "atualizar_perfil", summary: "Perfil atualizado: objetivo, pesoAtualKg, metaPesoKg, prazo, metaDetalhes" }] },
    { role: "user", content: "Feminino, 12/04/1988, 1,68 m. Cintura 88 cm. Tenho a bioimpedância da academia: 31,2% gordura, 51,3 kg massa magra, visceral 8, TMB 1430.", hora: "08:06" },
    { role: "assistant", content: "Bioimpedância registrada. Com a TMB medida de 1.430 kcal eu uso esse valor em vez da fórmula.\n\n**Etapa 3, histórico.** Já fez dietas antes? Tem plano de nutricionista, condições de saúde ou exames recentes?", hora: "08:06", toolEvents: [{ name: "atualizar_perfil", summary: "Perfil atualizado: sexo, nascimento, alturaCm, cinturaCm" }, { name: "registrar_bioimpedancia", summary: "Bioimpedância registrada: 31.2% gordura" }] },
    { role: "user", content: "Fiz low carb em 2024, perdi 5 kg e recuperei. Tenho plano do dr. Paulo de 1800 kcal (vou mandar o PDF) e exames: colesterol 212, LDL 138, vitamina D 22.", hora: "08:10" },
    { role: "assistant", content: "Histórico e exames registrados. LDL 138 e vitamina D 22 pedem atenção: a dieta ajuda no LDL e a reposição de vitamina D deve seguir a receita.\n\n**Etapa 4, rotina.** Horários de trabalho, sono e refeições; quem cozinha; alergias e preferências.", hora: "08:10", toolEvents: [{ name: "atualizar_perfil", summary: "Perfil atualizado: historico, planoNutricionista, saude" }, { name: "registrar_exame", summary: "Exame registrado: LDL 138 mg/dL" }] },
    { role: "user", content: "Trabalho 9h às 18h, acordo 6h30 e durmo 23h. Cozinho em casa, almoço fora às quartas. Intolerância leve à lactose. Gosto de ovos, frango, peixe e iogurte; não como fígado nem quiabo.", hora: "08:14" },
    { role: "assistant", content: "**Etapa 5, atividade física.** Que treinos faz, com que frequência e intensidade?", hora: "08:14", toolEvents: [{ name: "atualizar_perfil", summary: "Perfil atualizado: rotina, restricoes, preferencias" }] },
    { role: "user", content: "Musculação seg, qua e sex, cerca de 1 hora. Caminhada no fim de semana.", hora: "08:16" },
    { role: "assistant", content: "Nível de atividade: moderado.\n\n**Etapa 6, Combinados.** Cálculo:\n\n| Item | Valor |\n|---|---|\n| TMB (balança) | 1.430 kcal |\n| Gasto total (×1,55) | 2.217 kcal |\n| Déficit | −300 kcal |\n| **Meta** | **1.900 kcal** |\n| Proteína (1,9 g/kg) | 140 g |\n| Carboidrato | 170–220 g |\n| Gordura | 53–74 g |\n\nProponho 5 refeições (7h, 10h, 12h30, 16h, 19h30), +200 kcal e +40 g de carboidrato em dia de treino, pesagem 3x por semana em jejum, cintura toda segunda e bioimpedância mensal. Regras: proteína em todas as refeições, 2,6 L de água, álcool só no fim de semana. Concorda?", hora: "08:17", toolEvents: [{ name: "atualizar_perfil", summary: "Perfil atualizado: treinos, nivelAtividade" }, { name: "calcular_metas", summary: "Metas calculadas: 1900 kcal, 140 g proteína" }] },
    { role: "user", content: "Concordo. Pode fechar.", hora: "08:20" },
    { role: "assistant", content: "Combinados v1 gravados. Revise e aprove na tela Combinados. A partir daí registre o que comer, seu peso e os treinos aqui no chat; eu calculo o saldo do dia.", hora: "08:20", toolEvents: [{ name: "propor_combinados", summary: "Combinados v1 propostos: 1900 kcal, 140 g proteína" }] },
  ]);

  const d1 = addDays(inicio, 1);
  addConv("coach", "Café e almoço do dia 2", d1, [
    { role: "user", content: "Café da manhã: 2 ovos mexidos, 1 fatia de pão integral e café com leite desnatado.", hora: "07:20" },
    { role: "assistant", content: "| Item | Porção | kcal | P | C | G |\n|---|---|---|---|---|---|\n| Ovo mexido | 2 un (100 g) | 184 | 13,3 | 1,6 | 13,6 |\n| Pão integral | 1 fatia (30 g) | 75 | 3,0 | 13,0 | 1,1 |\n| Café com leite desnatado | 200 ml | 70 | 6,8 | 9,8 | 0,4 |\n| **Total** | | **329** | **23,1** | **24,4** | **15,1** |\n\n**Saldo do dia:** faltam 1.571 kcal e 117 g de proteína (meta 1.900 / 140, sem treino hoje). Classificação: **dentro**, boa proteína para o café. Fibras baixas até agora; inclua fruta no lanche.", hora: "07:21", toolEvents: [{ name: "buscar_alimento", summary: 'Alimento buscado: "ovo mexido" (3 resultados)' }, { name: "registrar_refeicao", summary: "Refeição registrada: Café da manhã · 329 kcal, 23.1 g proteína" }] },
    { role: "user", content: "Almoço: arroz integral, feijão, 150 g de frango grelhado e salada.", hora: "12:50" },
    { role: "assistant", content: "Registrado: **488 kcal, 57 g de proteína**. Com o café, você está em 817 kcal e 80 g de proteína. Faltam 1.083 kcal e 60 g de proteína para o dia. Dentro do plano; o frango de 150 g já garante 40% da meta de proteína.", hora: "12:51", toolEvents: [{ name: "registrar_refeicao", summary: "Refeição registrada: Almoço · 488 kcal, 57.1 g proteína" }] },
  ]);

  const d2 = addDays(inicio, 13);
  addConv("coach", "Pizza no sábado", d2, [
    { role: "user", content: "Hoje saiu do controle: 3 fatias de pizza de calabresa e uma lata de coca.", hora: "21:10" },
    { role: "assistant", content: "Registrado: 957 kcal, 33 g de proteína, 121 g de carboidrato. O dia fechou em **2.540 kcal, 640 acima da meta**. Classificação: fora do plano, por ultraprocessado, açúcar e gordura.\n\nO que isso significa na prática: um dia assim custa cerca de 0,1 kg no ritmo da semana. Não compensa com jejum amanhã. Faça o café normal, prefira o jantar leve de domingo e volte ao padrão. A média semanal ainda está dentro da tolerância.", hora: "21:12", toolEvents: [{ name: "registrar_refeicao", summary: "Refeição registrada: Jantar · 957 kcal, 33 g proteína" }] },
  ]);

  const d3 = addDays(inicio, 28);
  addConv("coach", "Pesagem e nova meta", d3, [
    { role: "user", content: "Pesei 72,1 hoje. Faz 4 semanas que começamos.", hora: "06:50" },
    { role: "assistant", content: "Peso registrado. Média de 7 dias: **72,3 kg**, tendência de **−0,45 kg/semana** nos últimos 28 dias, ou 0,6% do peso, dentro da faixa saudável. No ritmo atual a meta de 68 kg chega em ~9 semanas.\n\nComo o peso caiu 2,3 kg, o gasto total também caiu. Recalculei: meta de **1.850 kcal**, proteína mantida em 140 g, carboidrato 160–210 g. Proposta gravada como Combinados v2 para você aprovar.", hora: "06:52", toolEvents: [{ name: "registrar_peso", summary: "Peso registrado: 72.1 kg" }, { name: "calcular_metas", summary: "Metas calculadas: 1850 kcal, 140 g proteína" }, { name: "propor_combinados", summary: "Combinados v2 propostos: 1850 kcal, 140 g proteína" }] },
  ]);

  const d4 = addDays(today, -1);
  addConv("coach", "Bioimpedância do mês", d4, [
    { role: "user", content: "Bioimpedância de hoje: 28,1% gordura, 50,7 massa magra, visceral 7, água 51,8%, TMB 1408.", hora: "08:05" },
    { role: "assistant", content: "Registrada. Comparação com as anteriores:\n\n| | Início | Mês 1 | Hoje |\n|---|---|---|---|\n| Gordura | 31,2% | 29,6% | **28,1%** |\n| Massa gorda | 23,3 kg | 21,3 kg | **19,8 kg** |\n| Massa magra | 51,3 kg | 50,9 kg | 50,7 kg |\n| Visceral | 8 | 7 | 7 |\n\nVocê perdeu 3,5 kg de gordura e só 0,6 kg de massa magra em 8 semanas: a proteína alta e a musculação estão fazendo o trabalho. Para proteger a massa magra na reta final, mantenha os 140 g de proteína e não aumente o déficit.", hora: "08:07", toolEvents: [{ name: "registrar_bioimpedancia", summary: "Bioimpedância registrada: 28.1% gordura" }] },
  ]);

  // Uso da API (estimativa)
  const usage: UsageRecord[] = [];
  let uid = 1;
  for (let i = 0; i < DIAS; i++) {
    const date = addDays(inicio, i);
    const n = 1 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const u = { inputTokens: 900 + Math.round(rand() * 1500), outputTokens: 250 + Math.round(rand() * 500), cacheWriteTokens: k === 0 ? 4200 : 600, cacheReadTokens: k === 0 ? 0 : 4800 + Math.round(rand() * 3000) };
      usage.push({ id: uid++, createdAt: ts(date, `${String(8 + k * 5).padStart(2, "0")}:15`), model: "claude-opus-5-5", ...u, costUsd: Math.round(estimateCostUsd("claude-opus-5-5", u) * 10000) / 10000 });
    }
  }

  return {
    app: "diet-coach",
    version: 1,
    exportedAt: hoje.toISOString(),
    tables: { conversations, messages, usage, profile: [profile], combinados, meals, water, foods, measurements, bioimpedance, activities, daily, labs, documents, reviews },
  };
}
