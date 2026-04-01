// @refresh reload
import { createHandler, StartServer } from '@solidjs/start/server'
import { BRANDING } from '~/shared/config/branding'
import { env } from '~/shared/config/env'

// TODO (SSR disabled): Quando habilitar SSR, implementar a inicialização server-side de
// localization e evitar uso de APIs do navegador neste arquivo. Checklist mínima ao habilitar SSR:
// - Carregar o dicionário correspondente ao locale resolvido antes de renderizar.
// - Detectar o locale do request (cookie, rota ou Accept-Language) sem acoplar isso ao app shell.
// - Serializar locale + dicionário inicial para evitar flash de conteúdo inconsistente e permitir hydration.
// - Evitar usar createSignal/requires-browser apis no server entry; mantenha código SSR-safe.
// - Rever caching e headers de localizações para performance.

// Ensure environment is loaded early (fail fast on missing vars)
void env

/** @public */
export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{BRANDING.displayTitle}</title>
          <link rel="icon" href={BRANDING.logoMark} type="image/png" />
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
