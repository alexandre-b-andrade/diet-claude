import { makeClient } from "./claude";
import type { ChatMessage } from "./db";

/** Resume mensagens antigas de uma conversa para liberar contexto. Usa Haiku por custo. */
export async function summarizeMessages(apiKey: string, anterior: string | undefined, msgs: ChatMessage[]): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number } }> {
  const client = makeClient(apiKey);
  const transcript = msgs.map((m) => `${m.role === "user" ? "Usuário" : "Coach"}: ${m.content}`).join("\n\n");
  const res = await client.messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 1500,
    system:
      "Você resume conversas entre um usuário e seu coach de dieta. Produza um resumo em português, em tópicos curtos, preservando: fatos sobre o usuário, decisões e combinados, refeições e medidas mencionadas com datas, pendências e preferências. Sem introdução nem conclusão.",
    messages: [
      {
        role: "user",
        content: `${anterior ? `Resumo anterior:\n${anterior}\n\n` : ""}Novas mensagens a incorporar:\n\n${transcript}\n\nEscreva o resumo atualizado (máximo 400 palavras).`,
      },
    ],
  });
  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return { text, usage: { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens } };
}
