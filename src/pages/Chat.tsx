import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import ChatView from "../components/ChatView";
import { PageHeader } from "../components/ui";
import { createConversation, useCoachChat } from "../hooks/useCoachChat";
import { db } from "../lib/db";
import { takePendingSend } from "../lib/pendingSend";

export default function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const convId = conversationId ? Number(conversationId) : undefined;

  // Sem id na URL: abre a conversa livre mais recente ou cria a primeira.
  useEffect(() => {
    if (convId !== undefined) return;
    let cancelled = false;
    (async () => {
      const last = await db.conversations.where("kind").equals("coach").last();
      const id = last?.id ?? (await createConversation("coach"));
      if (!cancelled) navigate(`/chat/${id}`, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [convId, navigate]);

  const chat = useCoachChat(convId, "coach");

  // Envio pendente vindo de outra tela (ex.: upload em Registros › Documentos).
  useEffect(() => {
    if (convId === undefined || !chat.ready || chat.streaming || chat.messages === undefined) return;
    const p = takePendingSend();
    if (p) void chat.send(p.text, p.attachments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId, chat.ready, chat.messages === undefined]);

  async function startNew() {
    const id = await createConversation("coach");
    navigate(`/chat/${id}`);
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Coach"
        action={
          <button onClick={startNew} className="rounded-full p-2 text-stone-600 hover:bg-stone-100" aria-label="Nova conversa">
            <Plus size={20} />
          </button>
        }
      />
      <ChatView
        messages={chat.messages}
        streaming={chat.streaming}
        error={chat.error}
        onSend={chat.send}
        onStop={chat.stop}
        placeholder="Conte o que comeu, seu peso, ou peça uma sugestão…"
        empty={<Welcome />}
      />
    </div>
  );
}

function Welcome() {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
      <p className="font-medium text-stone-800">Olá. Sou seu coach de dieta.</p>
      <p className="mt-2">Você pode:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>descrever o que comeu, ou mandar a foto do prato, para eu calcular kcal e macros;</li>
        <li>informar peso, cintura ou a bioimpedância de hoje;</li>
        <li>dizer o que tem em casa para eu sugerir uma refeição.</li>
      </ul>
    </div>
  );
}
