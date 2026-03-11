# Container Tracker Agent no Arch Linux

Este diretório contém o pacote Arch/AUR-compatible do runtime Linux do agent.

## Pré-requisitos

- Arch Linux (ou derivado com `makepkg`)
- `base-devel`
- `nodejs`
- `pnpm`
- Dependências do projeto já instaladas no repositório (modo lean do PKGBUILD)

No root do projeto:

```bash
pnpm install
```

## Como instalar

No root do projeto:

```bash
cd packaging/arch
makepkg -si
```

## Pós-instalação (systemd)

O pacote **não habilita** o serviço automaticamente.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now container-tracker-agent.service
sudo systemctl status container-tracker-agent.service
```

## Paths instalados

- Runtime: `/usr/lib/container-tracker-agent`
- CLI: `/usr/bin/ct-agent`
- Service file: `/usr/lib/systemd/system/container-tracker-agent.service`
- Config dir: `/etc/container-tracker-agent`
- Data dir: `/var/lib/container-tracker-agent`

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

Reinicia o serviço systemd:

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
