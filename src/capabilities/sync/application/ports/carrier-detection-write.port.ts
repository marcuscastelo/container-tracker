export type CarrierDetectionWritePort = {
  readonly persistDetectedCarrier: (command: {
    readonly processId: string | null
    readonly containerNumber: string
    readonly carrierCode: string
  }) => Promise<void>
}
