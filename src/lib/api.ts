import type {
  AdminUser,
  AiMessage,
  AiStatus,
  Announcement,
  Category,
  ChatMessage,
  Conversation,
  DashboardData,
  HomeData,
  ModerationData,
  OnlineMember,
  Overview,
  Paginated,
  Post,
  SiteSettings,
  User,
} from './types';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.slice(0, 300) };
    }
  }

  if (!res.ok) {
    const payload = data as { error?: string; message?: string } | null;
    throw new ApiError(payload?.error || payload?.message || `Falha na requisição (${res.status})`, res.status);
  }

  return data as T;
}

const get = <T,>(p: string) => request<T>(p);
const post = <T,>(p: string, body?: unknown) =>
  request<T>(p, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
const patch = <T,>(p: string, body?: unknown) =>
  request<T>(p, { method: 'PATCH', body: JSON.stringify(body ?? {}) });
const put = <T,>(p: string, body?: unknown) =>
  request<T>(p, { method: 'PUT', body: JSON.stringify(body ?? {}) });
const del = <T,>(p: string) => request<T>(p, { method: 'DELETE' });

/* ------------------------------- Autenticação ------------------------------- */

export const authApi = {
  setupStatus: () => get<{ needsAdmin: boolean; signedIn: boolean }>('/auth/setup-status'),
  claimAdmin: (body: { email: string; username: string; password: string; displayName: string }) =>
    post<{ user: User }>('/auth/claim-admin', body),
  register: (body: { email: string; username: string; password: string; displayName: string }) =>
    post<{ user: User }>('/auth/register', body),
  login: (body: { identifier: string; password: string }) => post<{ user: User }>('/auth/login', body),
  logout: () => post<{ ok: true }>('/auth/logout'),
  me: () => get<{ user: User | null }>('/auth/me'),
  updateProfile: (body: { displayName?: string; bio?: string; avatar?: string | null }) =>
    patch<{ user: User }>('/auth/profile', body),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    post<{ ok: true }>('/auth/change-password', body),
  forgotPassword: (body: { identifier: string }) =>
    post<{ ok: boolean; token?: string; message: string }>('/auth/forgot-password', body),
  resetPassword: (body: { token: string; password: string }) => post<{ ok: true }>('/auth/reset-password', body),
  overview: () => get<Overview>('/auth/overview'),
  readNotifications: () => post<{ ok: true }>('/auth/notifications/read'),
  sessions: () =>
    get<{ sessions: { id: string; createdAt: string; expiresAt: string; ip: string; userAgent: string }[] }>(
      '/auth/sessions',
    ),
};

/* --------------------------------- Conteúdo -------------------------------- */

export const contentApi = {
  publicSettings: () => get<{ settings: Record<string, string> }>('/settings/public'),
  categories: () => get<{ categories: Category[] }>('/categories'),
  posts: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v));
    });
    return get<Paginated<Post>>(`/posts?${qs.toString()}`);
  },
  post: (slug: string) => get<{ post: Post; favorited: boolean; related: Post[] }>(`/posts/${slug}`),
  toggleFavorite: (id: number) => post<{ favorited: boolean }>(`/posts/${id}/favorite`),
  favorites: () => get<{ favorites: Post[] }>('/favorites'),
  announcements: () => get<{ announcements: Announcement[] }>('/announcements'),
  home: () => get<HomeData>('/home'),
  reportContent: (postId: number, reason: string) => post<{ ok: true }>('/reports/content', { postId, reason }),
};

/* --------------------------------- NEXUS AI -------------------------------- */

export const aiApi = {
  status: () => get<AiStatus>('/ai/status'),
  conversations: () => get<{ conversations: Conversation[] }>('/ai/conversations'),
  createConversation: (title?: string) => post<{ conversation: Conversation }>('/ai/conversations', { title }),
  conversation: (id: number) => get<{ conversation: Conversation; messages: AiMessage[] }>(`/ai/conversations/${id}`),
  remove: (id: number) => del<{ ok: true }>(`/ai/conversations/${id}`),
  send: (id: number, content: string) =>
    post<{ reply: string; remaining: number; conversationId: number; model: string }>(
      `/ai/conversations/${id}/messages`,
      { content },
    ),
};

/* ------------------------------ NEXUS Community ---------------------------- */

export const communityApi = {
  rules: () => get<{ rules: string; enabled: boolean }>('/community/rules'),
  messages: (limit = 60) => get<{ messages: ChatMessage[] }>(`/community/messages?limit=${limit}`),
  online: () => get<{ online: OnlineMember[]; total: number; guests: number }>('/community/online'),
  send: (body: string, replyToId?: number | null) =>
    post<{ message: ChatMessage }>('/community/messages', { body, replyToId: replyToId ?? null }),
  remove: (id: number) => del<{ ok: true }>(`/community/messages/${id}`),
  report: (id: number, reason: string) => post<{ ok: true }>(`/community/messages/${id}/report`, { reason }),
  blocks: () => get<{ blocks: { id: number; user_id: number; display_name: string }[] }>('/community/blocks'),
  toggleBlock: (userId: number) => post<{ blocked: boolean }>(`/community/blocks/${userId}`),
  moderation: () => get<ModerationData>('/community/moderation'),
  mute: (userId: number, minutes: number, reason: string) =>
    post<{ ok: true; mutedUntil: string }>(`/community/moderation/mute/${userId}`, { minutes, reason }),
  unmute: (userId: number) => del<{ ok: true }>(`/community/moderation/mute/${userId}`),
  resolveReport: (id: number, status: string, note?: string) =>
    post<{ ok: true }>(`/community/moderation/reports/${id}`, { status, note }),
  setChatEnabled: (enabled: boolean) => post<{ ok: true; enabled: boolean }>('/community/moderation/chat-enabled', { enabled }),
};

/* ------------------------------ Administração ------------------------------ */

export const adminApi = {
  dashboard: () => get<DashboardData>('/admin/dashboard'),
  aiTest: () =>
    post<{ ok: boolean; model: string; provider: string; latencyMs: number; sample?: string }>(
      '/admin/ai/test',
      {},
    ),
  users: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v));
    });
    return get<{ users: AdminUser[]; total: number; page: number; perPage: number; totalPages: number }>(
      `/admin/users?${qs.toString()}`,
    );
  },
  updateUser: (id: number, body: Record<string, unknown>) =>
    patch<{ user: Record<string, unknown> }>(`/admin/users/${id}`, body),
  posts: (params: Record<string, string | undefined> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) qs.set(k, v);
    });
    return get<{ posts: Post[] }>(`/admin/posts?${qs.toString()}`);
  },
  createPost: (body: Record<string, unknown>) => post<{ post: Post }>('/admin/posts', body),
  updatePost: (id: number, body: Record<string, unknown>) => patch<{ post: Post }>(`/admin/posts/${id}`, body),
  deletePost: (id: number) => del<{ ok: true }>(`/admin/posts/${id}`),
  categories: () => get<{ categories: Category[] }>('/admin/categories'),
  createCategory: (body: Record<string, unknown>) => post<{ category: Category }>('/admin/categories', body),
  updateCategory: (id: number, body: Record<string, unknown>) => patch<{ ok: true }>(`/admin/categories/${id}`, body),
  deleteCategory: (id: number) => del<{ ok: true }>(`/admin/categories/${id}`),
  announcements: () => get<{ announcements: Announcement[] }>('/admin/announcements'),
  createAnnouncement: (body: Record<string, unknown>) => post<{ announcement: Announcement }>('/admin/announcements', body),
  updateAnnouncement: (id: number, body: Record<string, unknown>) =>
    patch<{ ok: true }>(`/admin/announcements/${id}`, body),
  deleteAnnouncement: (id: number) => del<{ ok: true }>(`/admin/announcements/${id}`),
  settings: () => get<{ settings: SiteSettings; aiConfigured: boolean }>('/admin/settings'),
  saveSettings: (body: Record<string, string>) => put<{ ok: true; applied: string[] }>('/admin/settings', body),
  reports: (status?: string) => get<{ reports: import('./types').Report[] }>(`/admin/reports${status ? `?status=${status}` : ''}`),
  deleteMessage: (id: number) => del<{ ok: true }>(`/admin/messages/${id}`),
  logs: () => get<{ logs: DashboardData['logs'] }>('/admin/logs'),
  passwordResets: () =>
    get<{ resets: { id: number; user_id: number; display_name: string; expires_at: string; used_at: string | null; created_at: string }[] }>(
      '/admin/password-resets',
    ),
  mutes: () => get<{ mutes: import('./types').Mute[] }>('/admin/mutes'),
};
