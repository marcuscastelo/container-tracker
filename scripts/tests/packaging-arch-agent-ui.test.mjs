import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

describe('Arch packaging for agent UI and tray', () => {
  it('declares the Linux tray/UI assets in PKGBUILD', () => {
    const pkgbuild = read('packaging/arch/PKGBUILD')

    expect(pkgbuild).toContain("depends=('nodejs' 'systemd' 'electron')")
    expect(pkgbuild).toContain('container-tracker-agent-ui.launcher')
    expect(pkgbuild).toContain('container-tracker-agent-tray.launcher')
    expect(pkgbuild).toContain('container-tracker-agent-admin.launcher')
    expect(pkgbuild).toContain('container-tracker-agent-ui.desktop')
    expect(pkgbuild).toContain('container-tracker-agent-tray.desktop')
    expect(pkgbuild).toContain('run_pnpm run agent-control-ui:build')
    expect(pkgbuild).toContain('ct-agent-ui')
    expect(pkgbuild).toContain('ct-agent-tray')
    expect(pkgbuild).toContain('ct-agent-admin')
    expect(pkgbuild).toContain('dist/apps/agent/control-ui')
    expect(pkgbuild).toContain('register-alias-loader.js')
    expect(pkgbuild).toContain('--import="$register_path"')
  })

  it('installs desktop launchers and tray autostart descriptors', () => {
    const uiDesktop = read('packaging/arch/container-tracker-agent-ui.desktop')
    const trayDesktop = read('packaging/arch/container-tracker-agent-tray.desktop')
    const agentLauncher = read('packaging/arch/container-tracker-agent.launcher')
    const uiLauncher = read('packaging/arch/container-tracker-agent-ui.launcher')
    const trayLauncher = read('packaging/arch/container-tracker-agent-tray.launcher')
    const adminLauncher = read('packaging/arch/container-tracker-agent-admin.launcher')

    expect(uiDesktop).toContain('Exec=/usr/bin/ct-agent-ui')
    expect(uiDesktop).toContain('Icon=container-tracker-agent')
    expect(trayDesktop).toContain('Exec=/usr/bin/ct-agent-tray')
    expect(trayDesktop).toContain('NoDisplay=true')
    expect(uiLauncher).toContain('app_dir="$install_root/dist/apps/agent/control-ui"')
    expect(trayLauncher).toContain('app_dir="$install_root/dist/apps/agent/control-ui"')
    expect(uiLauncher).not.toContain('NODE_OPTIONS')
    expect(trayLauncher).not.toContain('NODE_OPTIONS')
    expect(uiLauncher).toContain('CT_AGENT_UI_LOGS_ON_DEMAND=0')
    expect(trayLauncher).toContain('CT_AGENT_UI_LOGS_ON_DEMAND=0')
    expect(agentLauncher).toContain('register-alias-loader.js')
    expect(agentLauncher).toContain('--import="$register_path"')
    expect(adminLauncher).toContain('register-alias-loader.js')
    expect(adminLauncher).toContain('--import="$register_path"')
  })
})
