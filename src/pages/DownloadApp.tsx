import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  canPromptInstall,
  detectPlatform,
  isInstalled,
  promptInstall,
  subscribeInstall,
  type Platform,
} from '../lib/install';

type Guide = {
  id: Platform;
  label: string;
  hint: string;
  steps: string[];
};

const GUIDES: Guide[] = [
  {
    id: 'android',
    label: 'Android',
    hint: 'Chrome, Edge ou Samsung Internet',
    steps: [
      'Abra este link no navegador do celular.',
      'Toque em “Instalar agora” — ou no menu ⋮ e depois em “Instalar aplicativo”.',
      'Confirme: o ícone 22M aparece na tela inicial.',
    ],
  },
  {
    id: 'ios',
    label: 'iPhone e iPad',
    hint: 'precisa ser o Safari',
    steps: [
      'Abra este link no Safari.',
      'Toque no botão Compartilhar (quadrado com a flecha).',
      'Escolha “Adicionar à Tela de Início” e confirme em “Adicionar”.',
    ],
  },
  {
    id: 'desktop',
    label: 'Computador',
    hint: 'Chrome, Edge, Brave ou Opera',
    steps: [
      'Clique no ícone de instalação na barra de endereço.',
      'Ou abra o menu ⋮ e escolha “Instalar 22m Vazamentos”.',
      'O app abre em janela própria, com atalho na área de trabalho.',
    ],
  },
];

export default function DownloadApp() {
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [installed, setInstalled] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isInstalled());
    setCanPrompt(canPromptInstall());
    return subscribeInstall(() => {
      setInstalled(isInstalled());
      setCanPrompt(canPromptInstall());
    });
  }, []);

  async function install() {
    setBusy(true);
    setMessage('');
    const result = await promptInstall();
    setBusy(false);
    if (result === 'accepted') {
      setInstalled(true);
      setMessage('App instalado! Procure o ícone 22M na tela inicial.');
    } else if (result === 'dismissed') {
      setMessage('Instalação cancelada. Toque em “Instalar agora” quando quiser.');
    } else {
      setMessage('Seu navegador não abriu o instalador — siga o passo a passo do seu aparelho.');
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/app`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      setMessage(`Copie o link manualmente: ${url}`);
    }
  }

  return (
    <section className="section download-page">
      <div className="container container-narrow">
        <div className="eyebrow">
          <span className="dot" /> Aplicativo oficial
        </div>
        <h1 className="section-title">Baixar o app 22M</h1>
        <p className="section-sub">
          Instale a plataforma no seu celular ou computador e abra com um toque: ícone próprio, tela
          cheia, 22M AI e comunidade em tempo real. A instalação é gratuita e feita pelo próprio
          navegador — não precisa de loja de aplicativos.
        </p>

        <div className="glass-panel card-pad download-hero">
          <div className="download-hero__preview" aria-hidden="true">
            <span className="download-hero__icon">22</span>
            <span className="download-hero__name">22M Vazamentos</span>
            <span className="download-hero__meta">app · versão web instalável</span>
          </div>

          <div className="download-hero__body">
            {installed ? (
              <p className="download-status download-status--ok">
                ✓ O app já está instalado neste aparelho. Abra pelo ícone 22M.
              </p>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={install}
                disabled={busy}
              >
                {busy ? 'Abrindo instalador…' : canPrompt ? 'Instalar agora' : 'Instalar o app'}
              </button>
            )}

            <button type="button" className="btn btn-ghost btn-block btn-sm" onClick={copyLink}>
              {copied ? '✓ Link copiado' : 'Copiar link do app'}
            </button>

            {message ? <p className="download-note">{message}</p> : null}

            <p className="download-note">
              Não existe arquivo .apk para baixar: o navegador instala o app direto deste link e
              mantém as atualizações automáticas.
            </p>
          </div>
        </div>

        <div className="download-grid">
          {GUIDES.map((guide) => (
            <div
              key={guide.id}
              className={`download-card${guide.id === platform ? ' download-card--active' : ''}`}
            >
              <div className="row between">
                <h2 className="card-title" style={{ fontSize: 17 }}>
                  {guide.label}
                </h2>
                {guide.id === platform ? <span className="download-badge">seu aparelho</span> : null}
              </div>
              <p className="small text-muted">{guide.hint}</p>
              <ol className="download-steps">
                {guide.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        <div className="glass-panel card-pad stack" style={{ marginTop: 22 }}>
          <h2 className="card-title" style={{ fontSize: 19 }}>
            O que você ganha instalando
          </h2>
          <ul className="stack small text-muted" style={{ listStyle: 'none' }}>
            <li>✦ Abertura em tela cheia, sem barra do navegador.</li>
            <li>✦ Atalhos rápidos para 22M AI, Comunidade, Conteúdos e seu painel.</li>
            <li>✦ Aviso de “sem conexão” em vez de tela branca quando a internet cai.</li>
            <li>✦ Atualizações automáticas: o app sempre abre na versão mais recente.</li>
          </ul>
        </div>

        <div className="row between" style={{ marginTop: 22 }}>
          <Link to="/" className="btn btn-ghost btn-sm">
            Voltar ao início
          </Link>
          <span className="signature">DESENVOLVIDO POR SILVA</span>
        </div>
      </div>
    </section>
  );
}
