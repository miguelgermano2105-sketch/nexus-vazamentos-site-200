import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Avatar, RoleBadge } from './ui';
import { cn } from '../lib/format';

const NAV = [
  { to: '/', label: 'Início', end: true },
  { to: '/conteudos', label: 'Conteúdos' },
  { to: '/ia', label: '22M AI' },
  { to: '/comunidade', label: 'Comunidade' },
];

export default function Header() {
  const { user, logout, isStaff, isAdmin, toast } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMenuOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    toast('Sessão encerrada com segurança.', 'success');
    navigate('/');
  };

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand" aria-label="22m Vazamentos — início">
          <span className="brand-mark" aria-hidden>22</span>
          <span className="brand-text">
            <strong>22M</strong>
            <span>VAZAMENTOS</span>
          </span>
        </Link>

        <nav className="nav" aria-label="Navegação principal">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn('nav-link', isActive && 'active')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="header-actions">
          {user ? (
            <>
              <Link to="/painel" className="btn btn-ghost btn-sm hide-sm">Meu painel</Link>
              <div className="user-menu">
                <button
                  className="user-trigger"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <Avatar name={user.displayName} src={user.avatar} size="sm" />
                  <span className="hide-sm">{user.displayName}</span>
                  <span className="caret" aria-hidden>▾</span>
                </button>
                {menuOpen ? (
                  <>
                    <div className="menu-overlay" onClick={() => setMenuOpen(false)} />
                    <div className="user-menu-panel" role="menu">
                      <div className="user-menu-head">
                        <strong>{user.displayName}</strong>
                        <span className="tiny text-muted">@{user.username}</span>
                        <RoleBadge role={user.role} />
                      </div>
                      <Link to="/perfil" role="menuitem">Meu perfil</Link>
                      <Link to="/painel" role="menuitem">Painel do membro</Link>
                      <Link to="/configuracoes" role="menuitem">Configurações</Link>
                      {isStaff ? <Link to="/admin" role="menuitem">Painel administrativo</Link> : null}
                      {isAdmin ? <Link to="/admin/moderacao" role="menuitem">Moderação</Link> : null}
                      <button className="danger" role="menuitem" onClick={handleLogout}>Sair</button>
                    </div>
                  </>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <Link to="/entrar" className="btn btn-ghost btn-sm">Entrar</Link>
              <Link to="/criar-conta" className="btn btn-primary btn-sm">Criar conta</Link>
            </>
          )}
          <button
            className="mobile-toggle"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Abrir menu"
            aria-expanded={mobileOpen}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="mobile-nav">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="mobile-link">
              {item.label}
            </NavLink>
          ))}
          {user ? (
            <>
              <NavLink to="/painel" className="mobile-link">Meu painel</NavLink>
              <NavLink to="/perfil" className="mobile-link">Meu perfil</NavLink>
              <NavLink to="/configuracoes" className="mobile-link">Configurações</NavLink>
              {isStaff ? <NavLink to="/admin" className="mobile-link">Painel administrativo</NavLink> : null}
              <button className="btn btn-ghost btn-block" onClick={handleLogout}>Sair</button>
            </>
          ) : (
            <div className="row gap-10" style={{ marginTop: 8 }}>
              <Link to="/entrar" className="btn btn-ghost" style={{ flex: 1 }}>Entrar</Link>
              <Link to="/criar-conta" className="btn btn-primary" style={{ flex: 1 }}>Criar conta</Link>
            </div>
          )}
        </div>
      ) : null}
    </header>
  );
}
