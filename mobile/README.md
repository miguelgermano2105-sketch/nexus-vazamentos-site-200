# App do 22M Vazamentos (Android / iOS)

> Desenvolvido por SILVA

Existem **dois caminhos** para ter o 22M como aplicativo no celular. O primeiro já está pronto e funcionando; o segundo gera um APK de verdade, mas precisa ser compilado no seu computador (o ambiente do AppJet não compila apps nativos).

---

## 1. App instalável pelo navegador (PWA) — pronto e funcionando ✅

Não precisa de loja, APK nem computador. O próprio site se instala no celular.

**Android (Chrome):**
1. Abra https://hnme93ioik.dev.onappjet.com
2. Toque no aviso **"Instalar o app 22M"** (ou no menu ⋮ → *Instalar aplicativo*)
3. Confirme: o ícone **22M** aparece na tela inicial e o app abre em tela cheia

**iPhone (Safari):**
1. Abra o site no **Safari** (precisa ser o Safari, não o Chrome do iPhone)
2. Toque em **Compartilhar** (quadrado com a seta)
3. Escolha **"Adicionar à Tela de Início"** → *Adicionar*

O que o app instalado já tem:

- Ícone próprio (192/512 px + versão *maskable* para Android)
- Abertura em tela cheia, sem barra do navegador, fundo preto
- Atalhos rápidos no ícone: **22M AI**, **Comunidade**, **Conteúdos**, **Meu painel**
- Service worker (`/sw.js`): o app abre mesmo com internet instável, com página "SEM CONEXÃO" quando offline
- Nada de `/api` é cacheado — login, IA e chat sempre trazem dados atuais

Arquivos responsáveis: `public/manifest.webmanifest`, `public/sw.js`, `public/icons/`, `src/components/InstallApp.tsx`, registro em `src/main.tsx`.

---

## 2. APK de verdade (Android) — projeto Capacitor

O projeto nativo já está configurado nesta pasta (`mobile/`). Ele carrega a plataforma publicada, então login, 22M AI e comunidade funcionam sem alterar código.

### Pré-requisitos (no seu computador)

- **Node.js 20+**
- **JDK 21** (Android Studio já traz)
- **Android Studio** (com SDK Platform 34+ e Build Tools)

### Passo a passo

```bash
cd mobile
npm install                 # instala o Capacitor
npx cap add android         # cria o projeto Android (só na primeira vez)

cd .. && npm run build      # gera o build web (dist/)
cd mobile
npx cap sync android        # copia o build + configuração para o Android
npx cap open android        # abre no Android Studio
```

No Android Studio:

1. Aguarde o *Gradle Sync* terminar
2. Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. O APK fica em `mobile/android/app/build/outputs/apk/debug/app-debug.apk`
4. Envie esse arquivo para o celular e instale (é preciso permitir "instalar de fontes desconhecidas")

Para a versão de loja (Play Store), use **Build → Generate Signed Bundle / APK** com sua chave de assinatura.

### Modo offline (conteúdo embutido)

O `capacitor.config.ts` vem com `server.url` apontando para o site publicado (modo *app online*). Se quiser o app funcionando sem internet:

1. Remova o bloco `server` do `capacitor.config.ts`
2. Rode `npm run build` e `npx cap sync android`
3. Configure a URL da API no build do cliente (variável `VITE_API_BASE`), porque login/IA/chat deixam de ser relativos ao site

### iOS (iPhone)

Só é possível compilar no **macOS** com **Xcode**:

```bash
cd mobile
npx cap add ios
npx cap open ios
```

Depois: *Product → Archive* no Xcode. Publicar na App Store exige conta Apple Developer (US$ 99/ano).

---

## Limites honestos

- **APK/IPA não são compilados no AppJet**: o ambiente aqui é de desenvolvimento web. O código e as instruções estão prontos, mas a compilação e o teste em aparelho são feitos por você (ou por alguém com Android Studio/Xcode).
- **Play Store** exige conta de desenvolvedor Google (taxa única de US$ 25) e revisão do app.
- O modo *app online* depende da hospedagem no plano Free do AppJet: cada nova publicação recria o servidor e zera o banco (contas incluídas). Para dados permanentes, o plano Starter (US$ 5/mês) com disco persistente resolve.
