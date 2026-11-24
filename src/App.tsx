import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import Layout from './components/Layout';
import { LoadingBlock } from './components/ui';
import { useApp } from './state/AppContext';

import Home from './pages/Home';
import Library from './pages/Library';
import PostDetail from './pages/PostDetail';
import AiChat from './pages/AiChat';
import Community from './pages/Community';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Setup from './pages/Setup';
import Settings from './pages/Settings';
import Info from './pages/Info';
import Profile from './pages/Profile';
import MemberPanel from './pages/MemberPanel';
import Admin from './pages/Admin';
import NotFound from './pages/NotFound';

function Protected({ children, staff }: { children: ReactNode; staff?: boolean }) {
  const { user, booting, isStaff } = useApp();
  const location = useLocation();

  if (booting) return <LoadingBlock label="Validando sua sessão…" />;
  if (!user) return <Navigate to={`/entrar?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (staff && !isStaff) return <Navigate to="/painel" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="conteudos" element={<Library />} />
        <Route path="conteudos/:slug" element={<PostDetail />} />
        <Route path="ia" element={<AiChat />} />
        <Route path="comunidade" element={<Community />} />
        <Route path="entrar" element={<Login />} />
        <Route path="criar-conta" element={<Register />} />
        <Route path="recuperar-senha" element={<ForgotPassword />} />
        <Route path="redefinir-senha" element={<ResetPassword />} />
        <Route path="primeiro-acesso" element={<Setup />} />
        <Route path="configuracoes" element={<Settings />} />
        <Route path="informacoes" element={<Info />} />
        <Route
          path="perfil"
          element={
            <Protected>
              <Profile />
            </Protected>
          }
        />
        <Route
          path="painel"
          element={
            <Protected>
              <MemberPanel />
            </Protected>
          }
        />
        <Route
          path="admin/*"
          element={
            <Protected staff>
              <Admin />
            </Protected>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
