import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function readPromoteStableWorkflow(): string {
  return fs.readFileSync(path.resolve('.github/workflows/promote-stable.yml'), 'utf8')
}

const VERSION_INPUT_TOKEN = ['${{ inputs.version ', '}}'].join('')

describe('promote-stable workflow', () => {
  it('promotes the existing GitHub release out of prerelease mode', () => {
    const workflow = readPromoteStableWorkflow()

    expect(workflow).toContain('uses: softprops/action-gh-release@v2')
    expect(workflow).toContain(`name: Agent v${VERSION_INPUT_TOKEN}`)
    expect(workflow).toContain('prerelease: false')
    expect(workflow).toContain('make_latest: true')
  })

  it('removes legacy root download/checksum fields during stable normalization', () => {
    const workflow = readPromoteStableWorkflow()

    expect(workflow).toContain('| del(.download_url, .checksum)')
  })

  it('keeps platforms as canonical source for release url/checksum', () => {
    const workflow = readPromoteStableWorkflow()

    expect(workflow).toContain('"linux-x64": {')
    expect(workflow).toContain('"windows-x64": {')
    expect(workflow).toContain('"url": $linux_download_url')
    expect(workflow).toContain('"checksum": $linux_checksum')
    expect(workflow).toContain('"url": $windows_download_url')
    expect(workflow).toContain('"checksum": $windows_checksum')
  })
})
