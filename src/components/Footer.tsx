import { Link } from 'react-router-dom';
import { useApp } from '../state/AppContext';

export function DiscordButton({ block, small }: { block?: boolean; small?: boolean }) {
  const { settings } = useApp();
  return (
    <a
      className={`btn btn-discord${block ? ' btn-block' : ''}${small ? ' btn-sm' : ''}`}
      href={settings.discordUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20.32 4.37a19.8 19.8 0 0 0-4.93-1.52.07.07 0 0 0-.08.04c-.21.38-.45.87-.61 1.25a18.3 18.3 0 0 0-5.4 0 12.6 12.6 0 0 0-.62-1.25.08.08 0 0 0-.08-.04c-1.71.3-3.37.81-4.93 1.52a.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.05 19.9 19.9 0 0 0 6.05 3.06.08.08 0 0 0 .08-.03c.47-.64.88-1.31 1.24-2.02a.08.08 0 0 0-.04-.11 13.1 13.1 0 0 1-1.87-.9.08.08 0 0 1-.01-.13l.37-.29a.07.07 0 0 1 .08-.01c3.93 1.79 8.18 1.79 12.06 0a.07.07 0 0 1 .08.01l.37.29a.08.08 0 0 1-.01.13c-.6.35-1.22.65-1.87.9a.08.08 0 0 0-.04.11c.37.71.78 1.38 1.24 2.02a.08.08 0 0 0 .08.03 19.8 19.8 0 0 0 6.06-3.06.08.08 0 0 0 .03-.05c.5-5.18-.84-9.68-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.96 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42Z" />
      </svg>
      Entrar no servidor
    </a>
  );
}

export default function Footer() {
  const { settings, user } = useApp();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link to="/" className="brand">
              <span className="brand-mark" aria-hidden>N</span>
              <span className="brand-text">
                <strong>22M</strong>
                <span>VAZAMENTOS</span>
              </span>
            </Link>
            <p className="text-muted small" style={{ maxWidth: 340 }}>
              Plataforma digital premium de conteúdos, comunidade em tempo real e inteligência artificial.
              Conteúdo autorizado, legal e que respeita a privacidade de terceiros.
            </p>
            <DiscordButton small />
          </div>

          <div className="footer-col">
            <h5>Plataforma</h5>
            <Link to="/">Início</Link>
            <Link to="/conteudos">Conteúdos</Link>
            <Link to="/ia">22M AI</Link>
            <Link to="/comunidade">Comunidade</Link>
            <Link to="/informacoes">Informações</Link>
            <Link to="/app">Baixar o app</Link>
          </div>

          <div className="footer-col">
            <h5>Conta</h5>
            {user ? (
              <>
                <Link to="/painel">Painel do membro</Link>
                <Link to="/perfil">Meu perfil</Link>
                <Link to="/configuracoes">Configurações</Link>
                <Link to="/perfil">Alterar senha</Link>
              </>
            ) : (
              <>
                <Link to="/criar-conta">Criar conta</Link>
                <Link to="/entrar">Entrar</Link>
                <Link to="/recuperar-senha">Recuperar senha</Link>
              </>
            )}
          </div>

          <div className="footer-col">
            <h5>Comunidade</h5>
            <a href={settings.discordUrl} target="_blank" rel="noopener noreferrer">Servidor do Discord</a>
            <Link to="/comunidade">Chat 22M Community</Link>
            <Link to="/informacoes">Regras de convivência</Link>
            <Link to="/informacoes">Política de conteúdo</Link>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} 22m Vazamentos. Todos os direitos reservados.</span>
          <span className="signature">DESENVOLVIDO POR SILVA</span>
          <button
            className="link-btn"
            onClick={() => window.dispatchEvent(new Event('nexus:intro'))}
            type="button"
          >
            Assistir introdução
          </button>
        </div>
      </div>
    </footer>
  );
}
