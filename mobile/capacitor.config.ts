import type { CapacitorConfig } from '@capacitor/cli';

/**
 * App nativo do 22M Vazamentos (Capacitor).
 *
 * Modo padrão (recomendado): "app online" — carrega a plataforma já publicada.
 * Assim login, 22M AI e o chat da comunidade funcionam sem nenhuma alteração de código,
 * porque o app roda na mesma origem do site.
 *
 * Para gerar um APK 100% offline (conteúdo embutido), remova o bloco `server`
 * e o app passará a usar o build em `webDir`. Nesse modo é necessário configurar
 * a URL da API no cliente (VITE_API_BASE) para login/IA/chat continuarem funcionando.
 */
const config: CapacitorConfig = {
  appId: 'com.silva.vazamentos22m',
  appName: '22M Vazamentos',
  webDir: '../dist',
  backgroundColor: '#050505',
  server: {
    url: 'https://hnme93ioik.dev.onappjet.com',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
