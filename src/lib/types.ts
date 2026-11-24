export type Role = 'member' | 'moderator' | 'admin';

export interface User {
  id: number;
  email: string;
  username: string;
  displayName: string;
  avatar: string | null;
  bio: string;
  role: Role;
  status: string;
  createdAt: string;
  lastSeenAt?: string | null;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  description: string;
  sort_order?: number;
  total?: number;
}

export interface Post {
  id: number;
  title: string;
  slug: string;
  description: string;
  body?: string;
  image_url?: string | null;
  imageUrl?: string | null;
  access_url?: string | null;
  accessUrl?: string | null;
  views: number;
  featured?: number | boolean;
  status?: string;
  category_id?: number;
  category_name?: string;
  categoryName?: string;
  category_slug?: string;
  categorySlug?: string;
  created_at?: string;
  createdAt?: string;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  level: string;
  created_at?: string;
  createdAt?: string;
}

export interface ChatReply {
  id: number;
  author: string;
  body: string | null;
}

export interface ChatMessage {
  id: number;
  body: string | null;
  createdAt: string;
  deleted: boolean;
  replyTo: ChatReply | null;
  author: {
    id: number;
    name: string;
    username: string;
    avatar: string | null;
    role: Role;
  };
}

export interface OnlineMember {
  id: number;
  name?: string;
  displayName?: string;
  username: string;
  avatar: string | null;
  role: Role;
}

export interface Conversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

export interface AiMessage {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface Notification {
  id: number;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Report {
  id: number;
  message_id: number | null;
  reporter_id: number;
  reason: string;
  status: string;
  created_at: string;
  reporter?: string;
  message_body?: string | null;
  message_author?: string | null;
}

export interface Mute {
  id: number;
  user_id: number;
  reason: string;
  muted_until: string;
  created_at: string;
  display_name?: string;
  username?: string;
}

export interface AdminUser {
  id: number;
  email: string;
  username: string;
  display_name: string;
  role: Role;
  status: string;
  created_at: string;
  last_seen_at?: string | null;
  message_count?: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface AiStatus {
  enabled: boolean;
  configured: boolean;
  model: string;
  dailyLimit: number;
  used: number;
  remaining: number;
  provider: string | null;
}

export interface Overview {
  user: User;
  counts: { favorites: number; history: number; unread: number; messages: number };
  favorites: Post[];
  history: Post[];
  notifications: Notification[];
  announcements: Announcement[];
  settings: { siteName: string; discordUrl: string };
}

export interface HomeData {
  featured: Post[];
  recent: Post[];
  categories: Category[];
  announcements: Announcement[];
  stats: { posts: number; members: number; categories: number; messages: number };
  favoriteIds: number[];
  settings: {
    siteName: string;
    description: string;
    tagline: string;
    discordUrl: string;
    communityEnabled: boolean;
    aiEnabled: boolean;
  };
}

export interface DashboardData {
  stats: Record<string, number>;
  recentUsers: AdminUser[];
  recentPosts: Post[];
  recentMessages: { id: number; body: string; created_at: string; author: string }[];
  logs: { id: number; action: string; target_type: string; target_id: number | null; details: string; created_at: string; actor: string | null }[];
  topPosts: { id: number; title: string; slug: string; views: number }[];
}

export interface SiteSettings {
  site_name: string;
  site_description: string;
  site_tagline: string;
  logo_text: string;
  discord_url: string;
  community_enabled: string;
  community_rules: string;
  ai_enabled: string;
  ai_model: string;
  ai_daily_limit: string;
  [key: string]: string;
}

export interface ModerationData {
  reports: Report[];
  mutes: Mute[];
  online: OnlineMember[];
  enabled: boolean;
  rules: string;
}
