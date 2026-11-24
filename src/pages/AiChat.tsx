import { useEffect, useRef, useState } from 'react';
import { ApiError, aiApi } from '../lib/api';
import type { AiMessage, AiStatus, Conversation } from '../lib/types';
import { useApp } from '../state/AppContext';
import { ErrorNote, LoadingBlock } from '../components/ui';
import { formatDateTime, timeAgo } from '../lib/format';

const SUGGESTIONS = [
  'Como funciona o 22m Vazamentos?',
  'Quais categorias de conteúdo existem?',
  'Como uso a 22M Community?',
  'Me ajude a escrever uma descrição para um tutorial.',
];

export default function AiChat() {
  const { user, toast } = useApp();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadConversations = async () => {
    const res = await aiApi.conversations();
    setConversations(res.conversations);
    return res.conversations;
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [st, list] = await Promise.all([aiApi.status(), aiApi.conversations()]);
        if (!alive) return;
        setStatus(st);
        setConversations(list.conversations);
        if (list.conversations.length) {
          const first = list.conversations[0];
          setActiveId(first.id);
          const conv = await aiApi.conversation(first.id);
          if (alive) setMessages(conv.messages);
        }
      } catch (err) {
        if (alive) setError(err instanceof ApiError ? err.message : 'Não foi possível carregar a 22M AI.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const openConversation = async (id: number) => {
    setError('');
    setActiveId(id);
    try {
      const conv = await aiApi.conversation(id);
      setMessages(conv.messages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível abrir a conversa.');
    }
  };

  const newConversation = async () => {
    setError('');
    try {
      const res = await aiApi.createConversation('Nova conversa');
      await loadConversations();
      setActiveId(res.conversation.id);
      setMessages([]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar a conversa.');
    }
  };

  const deleteConversation = async (id: number) => {
    try {
      await aiApi.remove(id);
      const list = await loadConversations();
      if (activeId === id) {
        if (list.length) {
          setActiveId(list[0].id);
          const conv = await aiApi.conversation(list[0].id);
          setMessages(conv.messages);
        } else {
          setActiveId(null);
          setMessages([]);
        }
      }
      toast('Conversa apagada.', 'success');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Não foi possível apagar a conversa.', 'error');
    }
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || sending) return;
    setError('');

    let id = activeId;
    if (!id) {
      try {
        const res = await aiApi.createConversation(content.slice(0, 60));
        id = res.conversation.id;
        setActiveId(id);
        await loadConversations();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Não foi possível iniciar a conversa.');
        return;
      }
    }

    const optimistic: AiMessage = {
      id: Date.now(),
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setInput('');
    setSending(true);

    try {
      const res = await aiApi.send(id, content);
      const reply: AiMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: res.reply,
        created_at: new Date().toISOString(),
      };
      setMessages((m) => [...m, reply]);
      setStatus((s) => (s ? { ...s, used: s.dailyLimit - res.remaining, remaining: res.remaining } : s));
      void loadConversations();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'A 22M AI não respondeu. Tente novamente.';
      setError(message);
      setMessages((m) => m.filter((msg) => msg.id !== optimistic.id));
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingBlock label="Iniciando 22M AI…" />;

  return (
    <section className="section" style={{ paddingTop: 18 }}>
      <div className="container">
        <div className="ai-layout">
          <aside className="ai-sidebar glass-panel">
            <div className="ai-head">
              <div>
                <strong className="small">Conversas</strong>
                <p className="tiny text-muted">Histórico salvo na sua conta</p>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => void newConversation()}>+ Nova</button>
            </div>

            <div className="ai-convos">
              {conversations.length ? (
                conversations.map((c) => (
                  <div key={c.id} className={`convo-row${c.id === activeId ? ' active' : ''}`}>
                    <button className="convo-btn" onClick={() => void openConversation(c.id)}>
                      <span className="convo-title">{c.title}</span>
                      <span className="tiny text-muted">{timeAgo(c.updated_at)}</span>
                    </button>
                    <button
                      className="convo-del"
                      title="Apagar conversa"
                      aria-label={`Apagar ${c.title}`}
                      onClick={() => void deleteConversation(c.id)}
                    >
                      ×
                    </button>
                  </div>
                ))
              ) : (
                <p className="tiny text-muted" style={{ padding: '10px 4px' }}>
                  Nenhuma conversa ainda. Envie uma mensagem para começar.
                </p>
              )}
            </div>

            <div className="ai-usage">
              <div className="row between tiny">
                <span className="text-muted">Uso diário</span>
                <span>{status ? `${status.used}/${status.dailyLimit}` : '—'}</span>
              </div>
              <div className="meter">
                <span
                  style={{
                    width: status && status.dailyLimit ? `${Math.min(100, (status.used / status.dailyLimit) * 100)}%` : '0%',
                  }}
                />
              </div>
              <p className="tiny text-muted" style={{ marginTop: 8 }}>
                {status?.configured ? `Modelo: ${status.model}` : 'Provedor de IA não configurado'}
              </p>
              {status && !status.configured ? (
                <p className="tiny text-muted" style={{ marginTop: 6 }}>
                  Para ativar as respostas, defina <strong>OPENAI_API_KEY</strong> nas variáveis de ambiente do
                  servidor (Settings → Environment variables). Nenhuma chave fica exposta no navegador.
                </p>
              ) : null}
            </div>
          </aside>

          <main className="ai-main glass-panel">
            <header className="ai-head">
              <div className="row" style={{ gap: 10 }}>
                <span className="ai-orb" aria-hidden />
                <div>
                  <strong>22M AI</strong>
                  <p className="tiny text-muted">Assistente oficial da plataforma</p>
                </div>
              </div>
              {status && !status.configured ? <span className="badge">Provedor pendente</span> : null}
            </header>

            <div className="ai-messages" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="ai-welcome">
                  <span className="ai-orb lg" aria-hidden />
                  <h1 className="section-title" style={{ fontSize: 'clamp(24px, 4vw, 34px)' }}>
                    Olá{user ? `, ${user.displayName}` : ''}. Eu sou a 22M AI.
                  </h1>
                  <p className="small text-muted" style={{ maxWidth: 520 }}>
                    Posso explicar como usar a plataforma, ajudar a encontrar conteúdos, esclarecer tutoriais,
                    gerar ideias e apoiar seus textos.
                  </p>
                  <div className="ai-suggestions">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} className="chip" onClick={() => void send(s)}>{s}</button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`msg ${m.role === 'user' ? 'user' : 'assistant'}`}>
                    <div className="msg-bubble">
                      <div className="msg-text">{m.content}</div>
                      <span className="msg-meta">{formatDateTime(m.created_at)}</span>
                    </div>
                  </div>
                ))
              )}

              {sending ? (
                <div className="msg assistant">
                  <div className="msg-bubble typing">
                    <span className="dot-pulse" />
                    <span className="dot-pulse" />
                    <span className="dot-pulse" />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="ai-composer">
              {error ? <ErrorNote>{error}</ErrorNote> : null}
              <form
                className="row"
                style={{ gap: 10, alignItems: 'flex-end' }}
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(input);
                }}
              >
                <textarea
                  className="textarea"
                  rows={1}
                  placeholder="Pergunte algo à 22M AI…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void send(input);
                    }
                  }}
                  maxLength={2000}
                />
                <button className="btn btn-primary" type="submit" disabled={sending || !input.trim()}>
                  {sending ? '…' : 'Enviar'}
                </button>
              </form>
              <p className="tiny text-muted" style={{ marginTop: 8 }}>
                A 22M AI responde via backend seguro. Nenhuma chave de API é exposta ao navegador.
              </p>
            </div>
          </main>
        </div>
      </div>
    </section>
  );
}
