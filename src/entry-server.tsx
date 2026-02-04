// @refresh reload
import { createHandler, StartServer } from '@solidjs/start/server'
import { env } from '~/shared/config/env'

// TODO (SSR disabled): Quando habilitar SSR, implementar a inicialização server-side do i18n
// e evitar uso de APIs do navegador neste arquivo. Checklist mínima ao habilitar SSR:
// - Inicializar i18next no servidor (ex.: i18next + i18next-http-backend) ou carregar os JSONs
//   correspondentes no servidor antes de renderizar.
// - Detectar o idioma do request (Accept-Language, cookie, rota) e chamar i18next.changeLanguage.
// - Serializar o estado inicial de traduções para o cliente (ex.: injected into the document or
//   StartServer props) para evitar flash de conteúdo em outro idioma e permitir hydration.
// - Evitar usar createSignal/requires-browser apis no server entry; mantenha código SSR-safe.
// - Rever caching e headers de localizações para performance.

// Ensure environment is loaded early (fail fast on missing vars)
void env

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
))
