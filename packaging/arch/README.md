# Container Tracker Agent no Arch Linux

Este diretório contém pacote Arch/AUR-compatible do runtime Linux do agent.

## Pré-requisitos

- Arch Linux (ou derivado com `makepkg`)
- `base-devel`
- `nodejs`
- `pnpm` disponível no PATH (das opções abaixo):
  - `pacman -S pnpm`
  - `npm i -g pnpm`
  - `corepack enable` (com `nodejs` recente)
- Dependências do projeto já instaladas no repositório (modo lean do PKGBUILD)

No root do projeto:

```bash
pnpm install
```

## Como instalar

No root do projeto:

```bash
pnpm --version
cd packaging/arch
makepkg -si
```

Se você já tiver `pnpm` instalado por `npm`, `PKGBUILD` atual funciona sem forçar instalação do pacote `pnpm` via pacman.

Se já estiver dentro de `packaging/arch`, rode:

```bash
makepkg -si -f
```

## Pós-instalação (systemd)

pacote **não habilita** serviço automaticamente.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now container-tracker-agent.service
sudo systemctl status container-tracker-agent.service
```

### Rebuild/restart Linux a partir do `.env` do repositório

Use script abaixo no root do repositório para:

- rebuild do pacote Arch
- reinstalação do serviço
- limpeza completa de `/var/lib/container-tracker-agent`
- geração de `bootstrap.env` partir de `./.env`
- restart + logs finais do serviço

```bash
pnpm run rebuild-restart:linux
```

## Paths instalados

- Runtime: `/usr/lib/container-tracker-agent`
- CLI: `/usr/bin/ct-agent`
- Admin helper: `/usr/bin/ct-agent-admin`
- Electron UI launcher: `/usr/bin/ct-agent-ui`
- Tray launcher: `/usr/bin/ct-agent-tray`
- Service file: `/usr/lib/systemd/system/container-tracker-agent.service`
- Config dir: `/etc/container-tracker-agent`
- Data dir: `/var/lib/container-tracker-agent`
- Public tray/UI state: `/run/container-tracker-agent/control-ui-state.json`
- Desktop launcher: `/usr/share/applications/container-tracker-agent-ui.desktop`
- Autostart tray file: `/etc/xdg/autostart/container-tracker-agent-tray.desktop`
- Icon: `/usr/share/icons/hicolor/256x256/apps/container-tracker-agent.png`

## UI Electron + tray

- pacote instala tray autostart global para sessoes graficas locais via `/etc/xdg/autostart`.
- tray abre Electron UI e UI conversa com servico systemd sem rodar como root.
- Leituras iniciais usam estado publico em `/run/container-tracker-agent/control-ui-state.json`.
- Acoes privilegiadas e refresh de logs usam elevacao local sob demanda.

Launchers manuais:

```bash
ct-agent-ui
ct-agent-tray
```

## Uso do CLI (`ct-agent`)

### `ct-agent status`

Lê e imprime `runtime-health.json`:

```bash
ct-agent status
```

### `ct-agent logs`

Tenta `journalctl` primeiro e, se necessário, faz fallback para log local:

```bash
ct-agent logs
```

### `ct-agent restart`

Reinicia serviço systemd:

```bash
sudo ct-agent restart
```

### `ct-agent update-status`

Lê e imprime `release-state.json` (somente leitura):

```bash
ct-agent update-status
```

### `ct-agent enroll`

Executa enrollment one-shot via API, persiste `config.env` e consome `bootstrap.env`:

```bash
ct-agent enroll
```

## Códigos de saída do CLI

- `0`: sucesso
- `1`: falha operacional
- `50`: erro de configuração/entrada inválida

## Troubleshooting rápido

- Ver logs do serviço:

```bash
journalctl -u container-tracker-agent -n 200 -f --no-pager
```

- Se `ct-agent enroll` falhar por configuração, valide:
  - `/var/lib/container-tracker-agent/bootstrap.env`
  - conectividade com `BACKEND_URL`
  - validade de `INSTALLER_TOKEN`
