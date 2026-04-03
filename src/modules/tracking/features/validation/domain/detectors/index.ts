import type { TrackingValidationDetector } from '~/modules/tracking/features/validation/domain/model/trackingValidationDetector'

// Fase 1 expõe o registry pluginável completo, mas mantém a produção sem
// detectores reais ativos para não acoplar heurísticas prematuras.
export const TRACKING_VALIDATION_DETECTORS: readonly TrackingValidationDetector[] = []
