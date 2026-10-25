import { describe, expect, it } from "vitest";
import type { Combinados } from "./db";
import { calcularSaldo, somarItens, somarRefeicoes } from "./diary";

const combinados: Combinados = {
  versao: 1,
  status: "aprovado",
  createdAt: 0,
  metaKcal: 2000,
  metaProteinaG: 150,
  carboMinG: 150,
  carboMaxG: 250,
  gorduraMinG: 55,
  gorduraMaxG: 78,
  refeicoes: [],
  treinoAjusteKcal: 200,
  treinoAjusteCarboG: 50,
  pesagem: "",
  cintura: "",
  bioimpedancia: "",
  tom: "tecnico",
  regras: [],
  racional: "",
};

describe("diary", () => {
  it("sums items with rounding", () => {
    const t = somarItens([
      { nome: "ovo", quantidade: 2, unidade: "un", kcal: 143, proteinaG: 13.3, carboG: 1.6, gorduraG: 8.9 },
      { nome: "pão", quantidade: 1, unidade: "fatia", kcal: 70, proteinaG: 2.5, carboG: 13.1, gorduraG: 0.9, fibraG: 1.2 },
    ]);
    expect(t).toEqual({ kcal: 213, proteinaG: 15.8, carboG: 14.7, gorduraG: 9.8, fibraG: 1.2 });
  });

  it("computes remaining balance and applies training adjustment", () => {
    const totais = somarRefeicoes([{ kcal: 1200, proteinaG: 90, carboG: 100, gorduraG: 40, fibraG: 10 }]);
    const s = calcularSaldo(totais, combinados, false);
    expect(s.restanteKcal).toBe(800);
    expect(s.restanteProteinaG).toBe(60);
    expect(s.pctKcal).toBe(60);
    const treino = calcularSaldo(totais, combinados, true);
    expect(treino.metaKcal).toBe(2200);
    expect(treino.restanteKcal).toBe(1000);
  });
});
