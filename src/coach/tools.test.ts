import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ONBOARDING_TOOLS, atualizarPerfil, proporCombinados } from "./tools";

function toSchema(schema: z.ZodType) {
  const json = z.toJSONSchema(schema, { target: "draft-7", io: "input" }) as Record<string, unknown>;
  delete json.$schema;
  return json as { type: string; properties: Record<string, Record<string, unknown>>; required?: string[] };
}

describe("tool schemas", () => {
  it("every tool converts to a JSON Schema object", () => {
    for (const t of ONBOARDING_TOOLS) {
      const s = toSchema(t.schema);
      expect(s.type).toBe("object");
      expect(t.name).toMatch(/^[a-z_]+$/);
      expect(t.description.length).toBeGreaterThan(20);
    }
  });

  it("optional profile fields are nullable and keep descriptions", () => {
    const s = toSchema(atualizarPerfil.schema);
    expect(s.required ?? []).toEqual([]);
    const nasc = s.properties.nascimento;
    expect(JSON.stringify(nasc)).toContain("YYYY-MM-DD");
    expect(JSON.stringify(nasc)).toContain("null");
  });

  it("propor_combinados requires the core goals", () => {
    const s = toSchema(proporCombinados.schema);
    expect(s.required).toEqual(expect.arrayContaining(["metaKcal", "metaProteinaG", "refeicoes", "regras", "tom"]));
  });

  it("validates tool input with zod", () => {
    expect(atualizarPerfil.schema.safeParse({ pesoAtualKg: 90, sexo: "masculino" }).success).toBe(true);
    expect(atualizarPerfil.schema.safeParse({ sexo: "x" }).success).toBe(false);
    expect(proporCombinados.schema.safeParse({ metaKcal: 2000 }).success).toBe(false);
  });
});
