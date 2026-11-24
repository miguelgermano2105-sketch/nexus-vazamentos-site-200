import { Link } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { DiscordButton } from '../components/Footer';

export default function Info() {
  const { settings } = useApp();

  return (
    <section className="section">
      <div className="container container-narrow">
        <div className="eyebrow"><span className="dot" /> Informações</div>
        <h1 className="section-title">Sobre a plataforma</h1>
        <p className="section-sub">{settings.description}</p>

        <div className="glass-panel card-pad stack" style={{ marginTop: 26 }}>
          <h2 className="card-title" style={{ fontSize: 20 }}>O que é o 22m Vazamentos</h2>
          <p className="small text-muted">
            O 22m Vazamentos é uma plataforma digital premium que reúne conteúdos organizados por categoria,
            uma inteligência artificial própria — a 22M AI — e a 22M COMMUNITY, um chat público em tempo real
            para membros da comunidade.
          </p>
          <p className="small text-muted">
            Todo o conteúdo publicado é revisado pela equipe. A plataforma hospeda apenas materiais autorizados,
            legais e que respeitam a privacidade e os direitos de terceiros.
          </p>

          <div className="divider" />

          <h2 className="card-title" style={{ fontSize: 20 }}>Compromissos</h2>
          <ul className="stack small text-muted" style={{ listStyle: 'none' }}>
            <li>✦ Conteúdo legal, autorizado e com crédito à fonte original.</li>
            <li>✦ Nenhuma senha, conta roubada ou dado pessoal vazado é disponibilizado.</li>
            <li>✦ Senhas protegidas por hash e sessões verificadas no servidor.</li>
            <li>✦ Moderação ativa com denúncias, silenciamentos e registros de auditoria.</li>
          </ul>

          <div className="divider" />

          <h2 className="card-title" style={{ fontSize: 20 }}>Comunidade oficial</h2>
          <p className="small text-muted">
            Faça parte da comunidade oficial do 22m Vazamentos, acompanhe novidades, atualizações e
            comunicados da plataforma.
          </p>
          <div><DiscordButton /></div>

          <div className="divider" />

          <h2 className="card-title" style={{ fontSize: 20 }}>Regras de convivência</h2>
          <div className="small text-muted" style={{ whiteSpace: 'pre-wrap' }}>{settings.rules}</div>
        </div>

        <div className="row between" style={{ marginTop: 22 }}>
          <Link to="/conteudos" className="btn btn-ghost btn-sm">Explorar conteúdos</Link>
          <span className="signature">DESENVOLVIDO POR SILVA</span>
        </div>
      </div>
    </section>
  );
}
