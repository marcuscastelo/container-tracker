import { describe, expect, it } from 'vitest'
import {
  toContainerEtaChipLabel,
  toSelectedEtaSubtitle,
  toSelectedEtaTitle,
} from '~/modules/process/ui/utils/eta-labels'
import type {
  ContainerEtaChipVM,
  ContainerEtaDetailVM,
} from '~/modules/process/ui/viewmodels/shipment.vm'

const headerTitleLabels = {
  arrived: 'Chegou',
  expectedPrefix: 'ETA',
  noEta: 'ETA —',
}

const headerSubtitleLabels = {
  actual: 'Confirmado',
  expected: 'Previsto',
  delayed: 'Atrasado',
}

const chipLabels = {
  arrived: 'Chegou',
  expectedPrefix: 'ETA',
  delayed: 'Atrasado',
  missing: 'ETA —',
}

describe('eta labels', () => {
  it('renders selected ETA title for ACTUAL', () => {
    const selectedEta: ContainerEtaDetailVM = {
      state: 'ACTUAL',
      tone: 'positive',
      date: '13/02',
      type: 'ARRIVAL',
    }

    expect(toSelectedEtaTitle(selectedEta, headerTitleLabels)).toBe('Chegou 13/02')
    expect(toSelectedEtaSubtitle(selectedEta, headerSubtitleLabels)).toBe('Confirmado')
  })

  it('renders selected ETA title/subtitle for ACTIVE_EXPECTED', () => {
    const selectedEta: ContainerEtaDetailVM = {
      state: 'ACTIVE_EXPECTED',
      tone: 'informative',
      date: '08/03',
      type: 'ARRIVAL',
    }

    expect(toSelectedEtaTitle(selectedEta, headerTitleLabels)).toBe('ETA 08/03')
    expect(toSelectedEtaSubtitle(selectedEta, headerSubtitleLabels)).toBe('Previsto')
  })

  it('renders selected ETA title/subtitle for EXPIRED_EXPECTED', () => {
    const selectedEta: ContainerEtaDetailVM = {
      state: 'EXPIRED_EXPECTED',
      tone: 'warning',
      date: '01/03',
      type: 'ARRIVAL',
    }

    expect(toSelectedEtaTitle(selectedEta, headerTitleLabels)).toBe('ETA 01/03')
    expect(toSelectedEtaSubtitle(selectedEta, headerSubtitleLabels)).toBe('Atrasado')
  })

  it('renders missing selected ETA as ETA dash', () => {
    const selectedEta: ContainerEtaDetailVM = null

    expect(toSelectedEtaTitle(selectedEta, headerTitleLabels)).toBe('ETA —')
    expect(toSelectedEtaSubtitle(selectedEta, headerSubtitleLabels)).toBeNull()
  })

  it('renders container chips for all ETA states', () => {
    const actualChip: ContainerEtaChipVM = {
      state: 'ACTUAL',
      tone: 'positive',
      date: '13/02',
    }
    const activeExpectedChip: ContainerEtaChipVM = {
      state: 'ACTIVE_EXPECTED',
      tone: 'informative',
      date: '08/03',
    }
    const expiredExpectedChip: ContainerEtaChipVM = {
      state: 'EXPIRED_EXPECTED',
      tone: 'warning',
      date: '05/03',
    }
    const missingChip: ContainerEtaChipVM = {
      state: 'UNAVAILABLE',
      tone: 'neutral',
      date: null,
    }

    expect(toContainerEtaChipLabel(actualChip, chipLabels)).toBe('Chegou 13/02')
    expect(toContainerEtaChipLabel(activeExpectedChip, chipLabels)).toBe('ETA 08/03')
    expect(toContainerEtaChipLabel(expiredExpectedChip, chipLabels)).toBe('ETA 05/03 · Atrasado')
    expect(toContainerEtaChipLabel(missingChip, chipLabels)).toBe('ETA —')
  })
})
