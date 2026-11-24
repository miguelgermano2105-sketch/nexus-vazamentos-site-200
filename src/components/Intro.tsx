import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/AppContext';

/**
 * Introdução cinematográfica — reproduz uma vez por sessão.
 * Respeita a preferência de movimento reduzido.
 */
export default function Intro({ onDone }: { onDone: () => void }) {
  const { prefs } = useApp();
  const reduced = prefs.reduceMotion || !prefs.animations;
  const [exiting, setExiting] = useState(false);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setExiting(true);
    window.setTimeout(() => {
      try {
        sessionStorage.setItem('nexus_intro_seen', '1');
      } catch {
        /* sessão indisponível */
      }
      onDone();
    }, reduced ? 220 : 900);
  };

  useEffect(() => {
    const total = reduced ? 1800 : 6400;
    const timer = window.setTimeout(finish, total);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`intro${exiting ? ' exit' : ''}`} aria-label="Introdução NEXUS VAZAMENTOS">
      <div className="intro-line" />
      <div className="intro-stage">
        <div className="intro-logo">NEXUS</div>
        <div className="intro-sub">VAZAMENTOS</div>
        <div className="intro-sig">Desenvolvido por Silva</div>
      </div>
      <button className="intro-skip" onClick={finish}>
        Pular introdução
      </button>
      <div className="intro-progress" />
    </div>
  );
}
