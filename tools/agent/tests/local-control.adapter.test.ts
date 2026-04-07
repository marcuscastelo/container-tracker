import {
  buildWindowsTaskEndCommand,
  buildWindowsTaskRunCommand,
  createWindowsLocalControlAdapter,
  parseWindowsTaskQueryOutput,
} from '@tools/agent/platform/local-control.adapter'
import { describe, expect, it } from 'vitest'

describe('windows local control adapter helpers', () => {
  it('builds the scheduled-task commands used for lifecycle control', () => {
    expect(buildWindowsTaskRunCommand('ContainerTrackerAgent')).toBe(
      'schtasks /Run /TN "ContainerTrackerAgent" >NUL 2>&1',
    )
    expect(buildWindowsTaskEndCommand('ContainerTrackerAgent')).toBe(
      'schtasks /End /TN "ContainerTrackerAgent" >NUL 2>&1 || exit /B 0',
    )
    expect(createWindowsLocalControlAdapter().key).toBe('windows')
  })

  it('parses running scheduled-task output as running', () => {
    expect(parseWindowsTaskQueryOutput('Status: Running')).toEqual({
      status: 'running',
      detail: 'Status: Running',
    })
  })

  it('parses ready scheduled-task output as stopped', () => {
    expect(parseWindowsTaskQueryOutput('Status: Ready')).toEqual({
      status: 'stopped',
      detail: 'Status: Ready',
    })
  })
})
