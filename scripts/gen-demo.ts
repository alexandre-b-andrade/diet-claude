/** Gera o arquivo de demonstração com datas relativas a hoje. Uso: npm run demo:json [-- caminho/saida.json] */
import { writeFileSync } from "node:fs";
import { buildDemoBackup } from "../src/lib/demo";

const out = process.argv[2] ?? "diet-coach-demo.json";
const b = buildDemoBackup(new Date());
writeFileSync(out, JSON.stringify(b));
const n = Object.entries(b.tables).map(([k, v]) => `${k}=${v?.length ?? 0}`).join(", ");
console.log(`${out}: ${n}`);
