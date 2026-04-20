import {
  Anchor,
  Download,
  LogIn,
  LogOut,
  type LucideIcon,
  Repeat,
  RotateCcw,
  Sailboat,
  ShieldAlert,
  ShieldCheck,
  Truck,
  Upload,
} from 'lucide-solid'

export function timelineEventIcon(eventType: string): LucideIcon | undefined {
  switch (eventType) {
    case 'GATE_IN':
      return LogIn
    case 'GATE_OUT':
      return LogOut
    case 'LOAD':
      return Upload
    case 'DEPARTURE':
      return Sailboat
    case 'ARRIVAL':
      return Anchor
    case 'DISCHARGE':
      return Download
    case 'DELIVERY':
      return Truck
    case 'EMPTY_RETURN':
      return RotateCcw
    case 'TRANSSHIPMENT_INTENDED':
    case 'TRANSSHIPMENT_POSITIONED_IN':
    case 'TRANSSHIPMENT_POSITIONED_OUT':
      return Repeat
    case 'CUSTOMS_HOLD':
      return ShieldAlert
    case 'CUSTOMS_RELEASE':
      return ShieldCheck
    default:
      return undefined
  }
}
