import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import Effects from './Effects';
import Intro from './Intro';
import AiBubble from './AiBubble';
import { Toasts } from './ui';

function introSeen(): boolean {
  try {
    return sessionStorage.getItem('nexus_intro_seen') === '1';
  } catch {
    return true;
  }
}

export default function Layout() {
  const location = useLocation();
  // A introdução abre automaticamente apenas na página inicial: em páginas de acesso
  // direto (entrar, criar conta, conteúdos) o usuário interage imediatamente.
  const [intro, setIntro] = useState(() => !introSeen() && location.pathname === '/');

  useEffect(() => {
    const replay = () => setIntro(true);
    window.addEventListener('nexus:intro', replay);
    return () => window.removeEventListener('nexus:intro', replay);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  return (
    <>
      {intro ? <Intro onDone={() => setIntro(false)} /> : null}
      <Effects />
      <div className="app-shell">
        <Header />
        <main className="main">
          <div key={location.pathname} className="page-transition">
            <Outlet />
          </div>
        </main>
        <Footer />
      </div>
      <AiBubble />
      <Toasts />
    </>
  );
}
