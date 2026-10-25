import { useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate } from "react-router-dom";
import { ClipboardCheck } from "lucide-react";
import ChatView from "../components/ChatView";
import { PageHeader } from "../components/ui";
import { createConversation, useCoachChat } from "../hooks/useCoachChat";
import { db, getCombinadosAtivos, getProfile, upsertProfile } from "../lib/db";
import { Button } from "../components/ui";
import { useT } from "../i18n";

const STEPS = ["Objetivo", "Dados", "Histórico", "Rotina", "Atividade", "Combinados"] as const;

export default function OnboardingPage() {
  const navigate = useNavigate();
  const conv = useLiveQuery(() => db.conversations.where("kind").equals("onboarding").last(), []);
  const profile = useLiveQuery(getProfile, []);
  const combinados = useLiveQuery(getCombinadosAtivos, []);
  const chat = useCoachChat(conv?.id, "onboarding");
  const started = useRef(false);
  const { t } = useT();
  const aberturaFalhou = Boolean(chat.error) && !chat.streaming && (chat.messages?.filter((m) => m.role === "assistant").length ?? 0) === 0;

  // Cria a conversa da entrevista e deixa o coach abrir com a primeira pergunta.
  useEffect(() => {
    if (conv !== undefined || started.current) return;
    started.current = true;
    (async () => {
      const id = await createConversation("onboarding");
      await db.messages.add({
        conversationId: id,
        role: "user",
        content: "Olá, quero começar minha entrevista inicial.",
        createdAt: Date.now(),
        hidden: true,
      });
      await upsertProfile({ status: "onboarding" });
    })();
  }, [conv]);

  // Quando a conversa existe mas só tem a mensagem de abertura, gera a resposta do coach.
  useEffect(() => {
    if (!conv?.id || !chat.ready || chat.streaming || !chat.messages) return;
    if (chat.messages.length === 1 && chat.messages[0].role === "user") {
      void chat.run(conv.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv?.id, chat.ready, chat.messages?.length]);

  const done = stepsDone(profile, Boolean(combinados));

  async function skip() {
    await upsertProfile({ status: "skipped" });
    navigate("/chat");
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Entrevista inicial"
        action={
          <button onClick={skip} className="text-sm text-stone-500 underline">
            Pular
          </button>
        }
      />
      <ol className="flex flex-wrap gap-1 border-b border-stone-200 bg-white px-4 py-2 text-xs">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`rounded-full px-2.5 py-1 ${
              done[i] ? "bg-brand-100 text-brand-800" : "bg-stone-100 text-stone-500"
            }`}
          >
            {done[i] ? "✓ " : ""}
            {s}
          </li>
        ))}
      </ol>
      <div className="min-h-0 flex-1">
        <ChatView
          messages={chat.messages}
          streaming={chat.streaming}
          error={chat.error}
          onSend={chat.send}
          onStop={chat.stop}
          placeholder="Responda aqui… pode anexar laudo, plano ou foto"
          footer={
            aberturaFalhou && conv?.id ? (
              <Button variant="ghost" className="w-full" onClick={() => void chat.run(conv.id!)}>
                {t("chat.retry")}
              </Button>
            ) : combinados ? (
              <Link
                to="/combinados"
                className="flex items-center justify-center gap-2 rounded-xl bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-800"
              >
                <ClipboardCheck size={18} />
                Revisar e aprovar Combinados v{combinados.versao}
              </Link>
            ) : null
          }
        />
      </div>
    </div>
  );
}

function stepsDone(p: Awaited<ReturnType<typeof getProfile>>, hasCombinados: boolean): boolean[] {
  return [
    Boolean(p?.objetivo && (p.metaPesoKg || p.metaDetalhes || p.objetivo === "manter")),
    Boolean(p?.sexo && p.nascimento && p.alturaCm && p.pesoAtualKg),
    Boolean(p?.historico || p?.planoNutricionista || p?.saude),
    Boolean(p?.rotina || p?.preferencias || p?.restricoes),
    Boolean(p?.nivelAtividade),
    hasCombinados,
  ];
}
