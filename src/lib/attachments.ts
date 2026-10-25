/** Converte arquivos escolhidos pelo usuário em blocos de conteúdo para a API. */

export type ImageMedia = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export type AttachmentBlock =
  | { type: "image"; source: { type: "base64"; media_type: ImageMedia; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string }; title?: string };

export interface Attachment {
  name: string;
  block: AttachmentBlock;
}

const MAX_IMAGE_SIDE = 1600;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

export async function fileToAttachment(file: File): Promise<Attachment> {
  if (file.type === "application/pdf") {
    if (file.size > MAX_PDF_BYTES) throw new Error(`PDF acima de 20 MB: ${file.name}`);
    const data = await toBase64(file);
    return { name: file.name, block: { type: "document", source: { type: "base64", media_type: "application/pdf", data }, title: file.name } };
  }
  if (file.type.startsWith("image/")) {
    const { data, mediaType } = await downscaleImage(file);
    return { name: file.name, block: { type: "image", source: { type: "base64", media_type: mediaType, data } } };
  }
  throw new Error(`Tipo não suportado: ${file.type || file.name}. Envie imagem ou PDF.`);
}

async function toBase64(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/** Reduz a imagem para economizar tokens e converte para JPEG. */
async function downscaleImage(file: File): Promise<{ data: string; mediaType: ImageMedia }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { data: dataUrl.split(",")[1], mediaType: "image/jpeg" };
}
