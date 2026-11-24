import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { aiApi, ApiError } from '../lib/api';
import { useApp } from '../state/AppContext';
import type { AiStatus } from '../lib/types';

type Turn = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'Como funciona a NEXUS VAZAMENTOS?',
  'Onde encontro tutoriais?',
  'Me ajude a escrever um texto profissional',
  'O que é a NEXUS Community?',
];

/** Rotas onde a bolinha não aparece (página cheia da IA, admin e acesso). */
function hiddenHere(path: string): boolean {
  if (path === '/nexus-ai') return true;
  if (path.startsWith('/admin')) return true;
  return ['/entrar', '/criar-conta', '/recuperar-senha', '/redefinir-senha', '/primeiro-acesso'].includes(path);
}

export default function AiBubble() {
  const { user } = useApp();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [convId, setConvId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Consulta o estado da IA apenas quando a janela abre e existe sessão.
  useEffect(() => {
    if (!open || !user || status) return;
    let alive = true;
    aiApi
      .status()
      .then((s) => {
        if (alive) setStatus(s);
      })
      .catch((e) => {
        if (alive) setStatusError(e instanceof ApiError ? e.message : 'Não foi possível consultar a NEXUS AI.');
      });
    return () => {
      alive = false;
    };
  }, [open, user, status]);

  // Foco no campo ao abrir e fechamento com ESC.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 140);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Fecha ao trocar de página.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Rolagem automática para a última mensagem.
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, sending, open]);

  if (hiddenHere(location.pathname)) return null;

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || sending) return;
    setError('');
    setDraft('');
    setTurns((prev) => [...prev, { role: 'user', content: text }]);
    setSending(true);
    try {
      let id = convId;
      if (!id) {
        const created = await aiApi.createConversation(text.slice(0, 60));
        id = created.conversation.id;
        setConvId(id);
      }
      const res = await aiApi.send(id, text);
      setTurns((prev) => [...prev, { role: 'assistant', content: res.reply }]);
      setStatus((s) => (s ? { ...s, used: s.dailyLimit - res.remaining, remaining: res.remaining } : s));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao falar com a NEXUS AI. Tente novamente.');
    } finally {
      setSending(false);
    }
  }

  const blocked = !!status && !status.configured;

  return (
    <div className="ai-fab-root">
      {open ? (
        <div className="ai-fab-panel" role="dialog" aria-label="NEXUS AI">
          <div className="ai-fab-head">
            <span className="ai-fab-mark" aria-hidden="true">
              N
            </span>
            <div className="ai-fab-title">
              <strong>NEXUS AI</strong>
              <span>{blocked ? 'Integração pendente' : 'Assistente oficial da plataforma'}</span>
            </div>
            <div className="ai-fab-head-actions">
              {turns.length ? (
                <button
                  type="button"
                  className="ai-fab-icon-btn"
                  title="Nova conversa"
                  aria-label="Nova conversa"
                  onClick={() => {
                    setTurns([]);
                    setConvId(null);
                    setError('');
                  }}
                >
                  +
                </button>
              ) : null}
              <Link className="ai-fab-icon-btn" to="/nexus-ai" title="Abrir em página cheia" aria-label="Abrir em página cheia">
                ⤢
              </Link>
              <button type="button" className="ai-fab-icon-btn" title="Fechar" aria-label="Fechar" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
          </div>

          <div className="ai-fab-body" ref={bodyRef} aria-live="polite">
            {!user ? (
              <div className="ai-fab-cta">
                <span className="ai-fab-cta-icon" aria-hidden="true">
                  ✦
                </span>
                <h4>Entre para conversar</h4>
                <p>A NEXUS AI guarda seu histórico e responde com contexto. Crie sua conta gratuita para começar.</p>
                <div className="ai-fab-cta-actions">
                  <Link className="btn btn-primary btn-sm" to="/entrar?next=%2Fnexus-ai">
                    Entrar
                  </Link>
                  <Link className="btn btn-ghost btn-sm" to="/criar-conta">
                    Criar conta
                  </Link>
                </div>
              </div>
            ) : null}

            {user && statusError ? <div className="note note-error">{statusError}</div> : null}

            {user && blocked ? (
              <div className="ai-fab-cta">
                <span className="ai-fab-cta-icon" aria-hidden="true">
                  ⚠
                </span>
                <h4>IA aguardando configuração</h4>
                <p>A chave do provedor de IA ainda não foi configurada. Assim que for ativada, eu passo a responder aqui mesmo.</p>
                <div className="ai-fab-cta-actions">
                  <Link className="btn btn-primary btn-sm" to="/nexus-ai">
                    Ver detalhes
                  </Link>
                </div>
              </div>
            ) : null}

            {user && !blocked && turns.length === 0 && !sending ? (
              <div className="ai-fab-hello">
                <span className="ai-fab-hello-mark" aria-hidden="true">
                  N
                </span>
                <h4>Olá{user.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}.</h4>
                <p>Sou a NEXUS AI. Posso explicar a plataforma, encontrar conteúdos e ajudar com textos.</p>
                <div className="ai-fab-suggest">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" className="ai-fab-chip" onClick={() => void send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {turns.map((turn, i) => (
              <div key={`${i}-${turn.role}`} className={`ai-fab-msg ${turn.role}`}>
                {turn.content}
              </div>
            ))}

            {sending ? (
              <div className="ai-fab-msg assistant ai-fab-typing" aria-label="NEXUS AI está digitando">
                <span />
                <span />
                <span />
              </div>
            ) : null}

            {error ? <div className="note note-error">{error}</div> : null}
          </div>

          <div className="ai-fab-foot">
            <textarea
              ref={inputRef}
              className="input ai-fab-input"
              rows={1}
              placeholder={blocked ? 'IA não configurada' : 'Escreva sua pergunta…'}
              value={draft}
              disabled={!user || blocked}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send(draft);
                }
              }}
            />
            <button
              type="button"
              className="btn btn-primary ai-fab-send"
              disabled={!user || blocked || sending || !draft.trim()}
              onClick={() => void send(draft)}
              aria-label="Enviar mensagem"
            >
              ➤
            </button>
          </div>
          <div className="ai-fab-foot-note">
            {status && status.configured
              ? `Modelo ${status.model} · ${status.remaining} de ${status.dailyLimit} mensagens hoje`
              : 'DESENVOLVIDO POR SILVA'}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className={`ai-fab ${open ? 'is-open' : ''}`}
        aria-label={open ? 'Fechar NEXUS AI' : 'Abrir NEXUS AI'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ai-fab-glow" aria-hidden="true" />
        <span className="ai-fab-glyph" aria-hidden="true">
          {open ? '×' : 'N'}
        </span>
        {!open ? <span className="ai-fab-ping" aria-hidden="true" /> : null}
      </button>
    </div>
  );
}
