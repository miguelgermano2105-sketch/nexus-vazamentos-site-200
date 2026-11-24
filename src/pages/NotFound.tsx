import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="section">
      <div className="container container-narrow text-center">
        <div className="eyebrow" style={{ justifyContent: 'center' }}><span className="dot" /> Erro 404</div>
        <h1 className="section-title" style={{ fontSize: 'clamp(34px, 8vw, 64px)' }}>Página não encontrada</h1>
        <p className="section-desc">O endereço acessado não existe ou foi movido.</p>
        <div className="hero-actions" style={{ justifyContent: 'center', marginTop: 24 }}>
          <Link to="/" className="btn btn-primary">Voltar ao início</Link>
          <Link to="/conteudos" className="btn btn-ghost">Explorar conteúdos</Link>
        </div>
        <p className="signature" style={{ marginTop: 40 }}>NEXUS VAZAMENTOS — DESENVOLVIDO POR SILVA</p>
      </div>
    </section>
  );
}
