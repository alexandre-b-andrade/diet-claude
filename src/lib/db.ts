import Dexie, { type EntityTable } from "dexie";

export interface Conversation {
  id?: number;
  title: string;
  /** "coach" = conversa livre; "onboarding" = entrevista inicial. */
  kind: "coach" | "onboarding";
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id?: number;
  conversationId: number;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  /** Nomes de anexos enviados junto (o arquivo em si não é guardado). */
  attachments?: string[];
  /** Ferramentas executadas nesta resposta, para mostrar na UI. */
  toolEvents?: { name: string; summary: string }[];
  /** Preenchido quando a resposta foi interrompida ou falhou. */
  error?: string;
  /** Mensagem técnica (ex.: abertura da entrevista) que não aparece na UI. */
  hidden?: boolean;
}

export interface UsageRecord {
  id?: number;
  createdAt: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  costUsd: number;
}

export type Sexo = "masculino" | "feminino" | "outro";
export type Objetivo = "emagrecer" | "manter" | "ganhar_massa" | "saude";
export type NivelAtividade = "sedentario" | "leve" | "moderado" | "intenso" | "muito_intenso";

export interface Bioimpedancia {
  data?: string;
  gorduraPct?: number;
  massaGordaKg?: number;
  massaMagraKg?: number;
  massaMuscularKg?: number;
  gorduraVisceral?: number;
  aguaPct?: number;
  tmbKcal?: number;
  idadeMetabolica?: number;
}

/** Perfil único do usuário (linha id = 1). */
export interface Profile {
  id: number;
  status: "onboarding" | "active" | "skipped";
  nome?: string;
  sexo?: Sexo;
  nascimento?: string; // YYYY-MM-DD
  alturaCm?: number;
  pesoAtualKg?: number;
  cinturaCm?: number;
  objetivo?: Objetivo;
  metaPesoKg?: number;
  prazo?: string;
  metaDetalhes?: string;
  nivelAtividade?: NivelAtividade;
  treinos?: string;
  rotina?: string;
  restricoes?: string;
  preferencias?: string;
  saude?: string;
  historico?: string;
  planoNutricionista?: string;
  bioimpedancia?: Bioimpedancia;
  createdAt: number;
  updatedAt: number;
}

export interface Refeicao {
  nome: string;
  horario: string;
  descricao?: string;
}

export interface Combinados {
  id?: number;
  versao: number;
  status: "proposto" | "aprovado" | "substituido";
  createdAt: number;
  aprovadoEm?: number;
  metaKcal: number;
  metaProteinaG: number;
  carboMinG: number;
  carboMaxG: number;
  gorduraMinG: number;
  gorduraMaxG: number;
  fibraG?: number;
  aguaMl?: number;
  refeicoes: Refeicao[];
  treinoAjusteKcal: number;
  treinoAjusteCarboG: number;
  pesagem: string;
  cintura: string;
  bioimpedancia: string;
  tom: "tecnico" | "direto" | "acolhedor";
  regras: string[];
  racional: string;
}

export type Classificacao = "dentro" | "atencao" | "fora";

export interface MealItem {
  nome: string;
  /** Quantidade na unidade informada (ex.: 2 unidades, 150 g). */
  quantidade: number;
  unidade: string;
  /** Peso estimado em gramas, quando conhecido. */
  gramas?: number;
  kcal: number;
  proteinaG: number;
  carboG: number;
  gorduraG: number;
  fibraG?: number;
  /** De onde vieram os valores: "taco", "usuario", "openfoodfacts", "usda", "estimativa". */
  fonte?: string;
}

export interface Meal {
  id?: number;
  /** YYYY-MM-DD no fuso do aparelho. */
  date: string;
  /** HH:MM */
  hora: string;
  /** Nome da refeição (Café da manhã, Almoço, Lanche, Jantar, Extra...). */
  refeicao: string;
  descricao: string;
  itens: MealItem[];
  kcal: number;
  proteinaG: number;
  carboG: number;
  gorduraG: number;
  fibraG: number;
  classificacao: Classificacao;
  motivo?: string;
  createdAt: number;
}

export interface WaterEntry {
  id?: number;
  date: string;
  ml: number;
  createdAt: number;
}

/** Alimento do usuário (tabela própria, rótulo, código de barras ou USDA). Valores por 100 g. */
export interface CustomFood {
  id?: number;
  nome: string;
  marca?: string;
  kcal: number;
  proteinaG: number;
  carboG: number;
  gorduraG: number;
  fibraG?: number;
  /** Porção usual em gramas, se conhecida. */
  porcaoG?: number;
  fonte: "usuario" | "tabela" | "openfoodfacts" | "usda";
  codigoBarras?: string;
  createdAt: number;
}

export type MedidaTipo = "peso" | "cintura" | "quadril" | "pescoco" | "peito" | "braco" | "coxa";

export interface Measurement {
  id?: number;
  date: string;
  tipo: MedidaTipo;
  /** kg para peso, cm para as demais. */
  valor: number;
  notas?: string;
  createdAt: number;
}

export interface BioimpedanceEntry {
  id?: number;
  date: string;
  pesoKg?: number;
  gorduraPct?: number;
  massaGordaKg?: number;
  massaMagraKg?: number;
  massaMuscularKg?: number;
  gorduraVisceral?: number;
  aguaPct?: number;
  tmbKcal?: number;
  idadeMetabolica?: number;
  fonte?: string;
  createdAt: number;
}

export interface Activity {
  id?: number;
  date: string;
  tipo: string;
  duracaoMin: number;
  intensidade: "leve" | "moderada" | "intensa";
  kcal?: number;
  notas?: string;
  createdAt: number;
}

/** Registro diário de sono e passos (uma linha por dia). */
export interface DailyLog {
  date: string;
  sonoHoras?: number;
  passos?: number;
  notas?: string;
  updatedAt: number;
}

export interface LabResult {
  id?: number;
  date: string;
  exame: string;
  valor: number;
  unidade?: string;
  referencia?: string;
  notas?: string;
  createdAt: number;
}

class DietCoachDB extends Dexie {
  measurements!: EntityTable<Measurement, "id">;
  bioimpedance!: EntityTable<BioimpedanceEntry, "id">;
  activities!: EntityTable<Activity, "id">;
  daily!: EntityTable<DailyLog, "date">;
  labs!: EntityTable<LabResult, "id">;
  conversations!: EntityTable<Conversation, "id">;
  messages!: EntityTable<ChatMessage, "id">;
  usage!: EntityTable<UsageRecord, "id">;
  profile!: EntityTable<Profile, "id">;
  combinados!: EntityTable<Combinados, "id">;
  meals!: EntityTable<Meal, "id">;
  water!: EntityTable<WaterEntry, "id">;
  foods!: EntityTable<CustomFood, "id">;

  constructor() {
    super("dietcoach");
    this.version(1).stores({
      conversations: "++id, updatedAt",
      messages: "++id, conversationId, createdAt",
      usage: "++id, createdAt, model",
    });
    this.version(2)
      .stores({
        conversations: "++id, kind, updatedAt",
        messages: "++id, conversationId, createdAt",
        usage: "++id, createdAt, model",
        profile: "id",
        combinados: "++id, versao, status",
      })
      .upgrade((tx) =>
        tx
          .table("conversations")
          .toCollection()
          .modify((c) => {
            c.kind ??= "coach";
          }),
      );
    this.version(3).stores({
      conversations: "++id, kind, updatedAt",
      messages: "++id, conversationId, createdAt",
      usage: "++id, createdAt, model",
      profile: "id",
      combinados: "++id, versao, status",
      meals: "++id, date, createdAt",
      water: "++id, date",
      foods: "++id, nome, fonte, codigoBarras",
    });
    this.version(4).stores({
      conversations: "++id, kind, updatedAt",
      messages: "++id, conversationId, createdAt",
      usage: "++id, createdAt, model",
      profile: "id",
      combinados: "++id, versao, status",
      meals: "++id, date, createdAt",
      water: "++id, date",
      foods: "++id, nome, fonte, codigoBarras",
      measurements: "++id, date, tipo, [tipo+date]",
      bioimpedance: "++id, date",
      activities: "++id, date",
      daily: "date",
      labs: "++id, date, exame",
    });
  }
}

export const db = new DietCoachDB();

export const PROFILE_ID = 1;

export async function getProfile(): Promise<Profile | undefined> {
  return db.profile.get(PROFILE_ID);
}

export async function upsertProfile(patch: Partial<Profile>): Promise<Profile> {
  const now = Date.now();
  const current = await getProfile();
  const next: Profile = {
    id: PROFILE_ID,
    status: "onboarding",
    createdAt: now,
    ...current,
    ...patch,
    updatedAt: now,
  };
  // Mescla bioimpedância em vez de substituir.
  if (current?.bioimpedancia && patch.bioimpedancia) {
    next.bioimpedancia = { ...current.bioimpedancia, ...patch.bioimpedancia };
  }
  await db.profile.put(next);
  return next;
}

/** Combinados em vigor: o aprovado mais recente; sem aprovado, a proposta mais recente. */
export async function getCombinadosAtivos(): Promise<Combinados | undefined> {
  const aprovado = await db.combinados.where("status").equals("aprovado").last();
  if (aprovado) return aprovado;
  return db.combinados.where("status").equals("proposto").last();
}

/** Proposta do coach ainda não aprovada, se houver. */
export async function getCombinadosPendentes(): Promise<Combinados | undefined> {
  return db.combinados.where("status").equals("proposto").last();
}

/** Aprova uma versão: as demais aprovadas e propostas viram histórico. */
export async function aprovarCombinados(id: number) {
  await db.transaction("rw", db.combinados, db.profile, async () => {
    await db.combinados.where("status").anyOf("proposto", "aprovado").modify({ status: "substituido" });
    await db.combinados.update(id, { status: "aprovado", aprovadoEm: Date.now() });
  });
  await upsertProfile({ status: "active" });
}

export async function wipeAllData() {
  await db.delete();
  await db.open();
}
