import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, communityApi } from '../lib/api';
import type { ChatMessage, OnlineMember } from '../lib/types';
import { useApp } from '../state/AppContext';
import { Avatar, ErrorNote, LoadingBlock, Modal, RoleBadge } from '../components/ui';
import { formatTime } from '../lib/format';

const EMOJIS = ['😀', '😂', '🔥', '💎', '👏', '🚀', '❤️', '😎', '🤝', '✨'];

export default function Community() {
  const { user, isStaff, toast } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [online, setOnline] = useState<OnlineMember[]>([]);
  const [rules, setRules] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [showEmojis, setShowEmojis] = useState(false);
  const [reportTarget, setReportTarget] = useState<ChatMessage | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [blocked, setBlocked] = useState<number[]>([]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollDown = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [msgRes, rulesRes] = await Promise.all([communityApi.messages(60), communityApi.rules()]);
        if (!alive) return;
        setMessages(msgRes.messages);
        setRules(rulesRes.rules);
        setEnabled(rulesRes.enabled);
        const on = await communityApi.online();
        if (alive) setOnline(on.online);
        if (user) {
          const blocks = await communityApi.blocks();
          if (alive) setBlocked(blocks.blocks.map((b) => b.user_id));
        }
      } catch (err) {
        if (alive) setError(err instanceof ApiError ? err.message : 'Não foi possível carregar a comunidade.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  /* Tempo real via Server-Sent Events (sessão autenticada). */
  useEffect(() => {
    if (!user) return;
    const es = new EventSource('/api/community/stream');

    es.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse((ev as MessageEvent).data) as ChatMessage;
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      } catch {
        /* ignora payload inválido */
      }
    });

    es.addEventListener('message-deleted', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as { id: number };
        setMessages((prev) =>
          prev.map((m) => (m.id === data.id ? { ...m, body: null, deleted: true } : m)),
        );
      } catch {
        /* ignora */
      }
    });

    es.addEventListener('chat-state', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as { enabled: boolean };
        setEnabled(Boolean(data.enabled));
      } catch {
        /* ignora */
      }
    });

    es.addEventListener('presence', () => {
      communityApi
        .online()
        .then((res) => setOnline(res.online))
        .catch(() => undefined);
    });

    return () => es.close();
  }, [user]);

  useEffect(() => {
    scrollDown();
  }, [messages.length]);

  const visible = useMemo(() => messages.filter((m) => !blocked.includes(m.author.id)), [messages, blocked]);

  const send = async () => {
    const body = input.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const res = await communityApi.send(body, replyTo?.id ?? null);
      setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
      setInput('');
      setReplyTo(null);
      setShowEmojis(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar a mensagem.');
    } finally {
      setSending(false);
    }
  };

  const removeMessage = async (id: number) => {
    try {
      await communityApi.remove(id);
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, body: null, deleted: true } : m)));
      toast('Mensagem apagada.', 'success');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Não foi possível apagar.', 'error');
    }
  };

  const submitReport = async () => {
    if (!reportTarget) return;
    const reason = reportReason.trim();
    if (reason.length < 5) {
      toast('Descreva o motivo com pelo menos 5 caracteres.', 'error');
      return;
    }
    try {
      await communityApi.report(reportTarget.id, reason);
      toast('Denúncia enviada à moderação.', 'success');
      setReportTarget(null);
      setReportReason('');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Não foi possível denunciar.', 'error');
    }
  };

  const toggleBlock = async (member: OnlineMember) => {
    try {
      const res = await communityApi.toggleBlock(member.id);
      setBlocked((prev) => (res.blocked ? [...prev, member.id] : prev.filter((id) => id !== member.id)));
      toast(res.blocked ? `${member.name || member.username} bloqueado.` : 'Usuário desbloqueado.', 'success');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Ação indisponível.', 'error');
    }
  };

  if (loading) return <LoadingBlock label="Conectando à 22M Community…" />;

  return (
    <section className="section" style={{ paddingTop: 18 }}>
      <div className="container">
        <div className="section-head" style={{ marginBottom: 18 }}>
          <div>
            <div className="eyebrow"><span className="dot" /> Comunidade oficial</div>
            <h1 className="section-title">22M COMMUNITY</h1>
            <p className="section-desc">
              Converse com outros membros em tempo real. {online.length ? `${online.length} pessoa(s) online agora.` : 'Seja o primeiro a entrar.'}
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <span className={`badge${enabled ? ' badge-live' : ''}`}>
              <span className="pulse" /> {enabled ? 'Ao vivo' : 'Desativado'}
            </span>
            {isStaff ? <Link className="btn btn-ghost btn-sm" to="/admin?tab=comunidade">Moderação</Link> : null}
          </div>
        </div>

        <div className="community-layout">
          <div className="chat-panel glass-panel">
            <div className="chat-head">
              <Avatar name={user?.displayName || 'Visitante'} src={user?.avatar} size="md" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong className="small">Chat público</strong>
                <p className="tiny text-muted">
                  {user ? 'Mensagens vinculadas à sua identidade verificada' : 'Entre na sua conta para participar'}
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEmojis((v) => !v)} aria-label="Emojis">
                ☺
              </button>
            </div>

            <div className="chat-scroll" ref={scrollRef}>
              {visible.length === 0 ? (
                <p className="tiny text-muted" style={{ textAlign: 'center', marginTop: 30 }}>
                  Nenhuma mensagem ainda. Comece a conversa.
                </p>
              ) : (
                visible.map((m) => {
                  const own = user?.id === m.author.id;
                  return (
                    <div key={m.id} className={`chat-msg${own ? ' own' : ''}`}>
                      <Avatar name={m.author.name || m.author.username} src={m.author.avatar} size="sm" />
                      <div className="chat-bubble-wrap">
                        <div className="chat-author">
                          <span>{m.author.name || m.author.username}</span>
                          <RoleBadge role={m.author.role} />
                        </div>
                        {m.deleted ? (
                          <p className="chat-deleted">Mensagem removida pela moderação.</p>
                        ) : (
                          <div className="chat-bubble">
                            {m.replyTo ? (
                              <div className="chat-reply-quote">
                                <strong>{m.replyTo.author}</strong>: {m.replyTo.body || 'mensagem removida'}
                              </div>
                            ) : null}
                            {m.body}
                          </div>
                        )}
                        <div className="chat-time">{formatTime(m.createdAt)}</div>
                        {!m.deleted ? (
                          <div className="chat-actions">
                            {user ? (
                              <button className="mini-btn" onClick={() => { setReplyTo(m); textareaRef.current?.focus(); }}>
                                Responder
                              </button>
                            ) : null}
                            {own || isStaff ? (
                              <button className="mini-btn" onClick={() => void removeMessage(m.id)}>Apagar</button>
                            ) : null}
                            {!own && user ? (
                              <button className="mini-btn" onClick={() => { setReportTarget(m); setReportReason(''); }}>
                                Denunciar
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {enabled ? (
              user ? (
                <div className="chat-composer">
                  {error ? <ErrorNote>{error}</ErrorNote> : null}
                  {showEmojis ? (
                    <div className="emoji-bar">
                      {EMOJIS.map((e) => (
                        <button key={e} onClick={() => setInput((v) => v + e)}>{e}</button>
                      ))}
                    </div>
                  ) : null}
                  {replyTo ? (
                    <div className="reply-preview">
                      <span style={{ flex: 1 }}>Respondendo {replyTo.author.name || replyTo.author.username}</span>
                      <button className="mini-btn" onClick={() => setReplyTo(null)}>cancelar</button>
                    </div>
                  ) : null}
                  <div className="chat-composer-row">
                    <textarea
                      ref={textareaRef}
                      className="textarea"
                      rows={1}
                      maxLength={800}
                      placeholder="Escreva sua mensagem…"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void send();
                        }
                      }}
                    />
                    <button className="btn btn-primary" onClick={() => void send()} disabled={sending || !input.trim()}>
                      {sending ? '…' : 'Enviar'}
                    </button>
                  </div>
                  <p className="tiny text-muted" style={{ marginTop: 8 }}>
                    Respeite as regras de convivência. Spam e links maliciosos são bloqueados automaticamente.
                  </p>
                </div>
              ) : (
                <div className="chat-locked">
                  <strong>Entre para participar da comunidade</strong>
                  <p className="tiny text-muted">Apenas membros autenticados podem enviar mensagens.</p>
                  <div className="row" style={{ gap: 10 }}>
                    <Link className="btn btn-primary btn-sm" to="/entrar?next=%2Fcomunidade">Entrar</Link>
                    <Link className="btn btn-ghost btn-sm" to="/criar-conta">Criar conta</Link>
                  </div>
                </div>
              )
            ) : (
              <div className="chat-locked">
                <strong>Chat temporariamente desativado</strong>
                <p className="tiny text-muted">A administração pausou o envio de mensagens.</p>
              </div>
            )}
          </div>

          <aside className="members-panel glass-panel">
            <div className="row between">
              <strong className="small">Membros online</strong>
              <span className="badge">{online.length}</span>
            </div>
            <div className="members-list">
              {online.length ? (
                online.map((m) => (
                  <div key={m.id} className="member-item">
                    <Avatar name={m.name || m.displayName || m.username} src={m.avatar} size="xs" />
                    <span className="nm" style={{ flex: 1 }}>{m.name || m.displayName || m.username}</span>
                    {user && user.id !== m.id ? (
                      <button
                        className="mini-btn"
                        title={blocked.includes(m.id) ? 'Desbloquear' : 'Bloquear'}
                        onClick={() => void toggleBlock(m)}
                      >
                        {blocked.includes(m.id) ? 'desbloquear' : 'bloquear'}
                      </button>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="tiny text-muted" style={{ padding: 8 }}>Ninguém online agora.</p>
              )}
            </div>
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 12 }}>
              <strong className="tiny text-muted">REGRAS DE CONVIVÊNCIA</strong>
              <p className="tiny text-muted" style={{ marginTop: 6, whiteSpace: 'pre-wrap', maxHeight: 150, overflowY: 'auto' }}>
                {rules || 'Respeite os demais membros, não compartilhe conteúdo ilegal e evite spam.'}
              </p>
            </div>
          </aside>
        </div>
      </div>

      <Modal
        open={Boolean(reportTarget)}
        title="Denunciar mensagem"
        onClose={() => setReportTarget(null)}
        footer={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setReportTarget(null)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={() => void submitReport()}>Enviar denúncia</button>
          </>
        }
      >
        <p className="small text-muted">
          Descreva o problema. A moderação analisará a denúncia e tomará as medidas necessárias.
        </p>
        <div className="field">
          <label>Motivo</label>
          <textarea
            className="textarea"
            rows={4}
            maxLength={300}
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Ex.: linguagem ofensiva, spam, link suspeito…"
          />
        </div>
      </Modal>
    </section>
  );
}
