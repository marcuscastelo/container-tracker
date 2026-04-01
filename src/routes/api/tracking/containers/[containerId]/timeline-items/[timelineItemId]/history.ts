import { bootstrapTrackingControllers } from '~/modules/tracking/interface/http/tracking.controllers.bootstrap'

const trackingControllers = bootstrapTrackingControllers()

export const GET = trackingControllers.detail.getTimelineItemSeriesHistory
