import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function readPublishCanaryWorkflow(): string {
  return fs.readFileSync(path.resolve('.github/workflows/publish-canary.yml'), 'utf8')
}

const VERSION_INPUT_TOKEN = ['${{ inputs.version ', '}}'].join('')

describe('publish-canary workflow', () => {
  it('builds Linux and Windows artifacts on separate runners', () => {
    const workflow = readPublishCanaryWorkflow()

    expect(workflow).toContain('build-linux-artifact:')
    expect(workflow).toContain('runs-on: ubuntu-latest')
    expect(workflow).toContain('AGENT_RELEASE_TARGET: linux-x64')
    expect(workflow).toContain('build-windows-artifact:')
    expect(workflow).toContain('runs-on: windows-latest')
    expect(workflow).toContain('AGENT_RELEASE_TARGET: windows-x64')
  })

  it('publishes canary releases without marking them as latest', () => {
    const workflow = readPublishCanaryWorkflow()

    expect(workflow).toContain(`name: Agent v${VERSION_INPUT_TOKEN} (canary)`)
    expect(workflow).toContain('prerelease: true')
    expect(workflow).toContain('make_latest: false')
  })

  it('packages the Windows updater from the full release directory', () => {
    const workflow = readPublishCanaryWorkflow()

    expect(workflow).toContain(
      "Copy-Item -Path 'release/*' -Destination $targetDir -Recurse -Force",
    )
    expect(workflow).toContain("if (!(Test-Path 'release/ct-agent-startup.exe')) {")
  })
})
