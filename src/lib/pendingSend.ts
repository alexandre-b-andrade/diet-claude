import type { Attachment } from "./attachments";

/** Mensagem a enviar ao coach assim que a tela de chat abrir (ex.: upload vindo de outra aba). */
export interface PendingSend {
  text: string;
  attachments: Attachment[];
}

let pending: PendingSend | null = null;

export function queueSend(p: PendingSend) {
  pending = p;
}

export function takePendingSend(): PendingSend | null {
  const p = pending;
  pending = null;
  return p;
}
