import type { Post } from './types';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function postDate(post: Post): string {
  return post.created_at || post.createdAt || new Date().toISOString();
}

export function postImage(post: Post): string | null {
  return post.image_url || post.imageUrl || null;
}

export function postAccessUrl(post: Post): string | null {
  return post.access_url || post.accessUrl || null;
}

export function categoryName(post: Post): string {
  return post.category_name || post.categoryName || 'Conteúdo';
}

export function categorySlug(post: Post): string {
  return post.category_slug || post.categorySlug || '';
}

export function initials(name?: string | null): string {
  if (!name) return 'N';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || 'N';
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d`;
  return formatDate(iso);
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function numberFmt(n?: number): string {
  return new Intl.NumberFormat('pt-BR').format(n ?? 0);
}

export function normalizeSettings(raw: Record<string, string> | undefined | null) {
  const s = raw || {};
  return {
    siteName: s.site_name || s.siteName || 'NEXUS VAZAMENTOS',
    description: s.site_description || s.siteDescription || '',
    tagline: s.site_tagline || s.siteTagline || '',
    logoText: s.logo_text || s.logoText || 'NEXUS',
    discordUrl: s.discord_url || s.discordUrl || 'https://discord.gg/YKcYA7g2v',
    communityEnabled: (s.community_enabled ?? s.communityEnabled ?? '1') !== '0',
    aiEnabled: (s.ai_enabled ?? s.aiEnabled ?? '1') !== '0',
    rules: s.community_rules || s.communityRules || '',
  };
}

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}
