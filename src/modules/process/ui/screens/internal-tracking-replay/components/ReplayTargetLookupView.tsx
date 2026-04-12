import type { JSX } from 'solid-js'

type ReplayTargetLookupViewProps = {
  readonly authToken: string
  readonly containerNumber: string
  readonly busy: boolean
  readonly onAuthTokenInput: (value: string) => void
  readonly onContainerNumberInput: (value: string) => void
  readonly onLookup: () => Promise<void>
}

export function ReplayTargetLookupView(props: ReplayTargetLookupViewProps): JSX.Element {
  const accessTokenInputId = 'tracking-replay-access-token'
  const containerNumberInputId = 'tracking-replay-container-number'

  return (
    <section class="rounded-xl border border-slate-200 bg-white p-4">
      <h2 class="text-sm-ui font-semibold text-slate-900">Container Lookup</h2>
      <p class="mt-1 text-xs-ui text-slate-600">
        Provide the replay access token, then find a container and load replay target metadata.
      </p>
      <div class="mt-3 grid gap-3">
        <div>
          <label
            class="mb-1 block text-micro font-semibold uppercase tracking-wide text-slate-700"
            for={accessTokenInputId}
          >
            Replay Access Token
          </label>
          <input
            id={accessTokenInputId}
            type="password"
            autocomplete="current-password"
            class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs-ui text-slate-900 outline-none ring-blue-500 focus:ring-2"
            placeholder="Paste bearer token"
            value={props.authToken}
            onInput={(event) => props.onAuthTokenInput(event.currentTarget.value)}
            spellcheck={false}
          />
        </div>

        <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div class="flex-1">
            <label
              class="mb-1 block text-micro font-semibold uppercase tracking-wide text-slate-700"
              for={containerNumberInputId}
            >
              Container Number
            </label>
            <input
              id={containerNumberInputId}
              class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs-ui uppercase text-slate-900 outline-none ring-blue-500 focus:ring-2"
              placeholder="TGBU7416510"
              value={props.containerNumber}
              onInput={(event) => props.onContainerNumberInput(event.currentTarget.value)}
              spellcheck={false}
            />
          </div>
          <button
            type="button"
            class="rounded-md bg-blue-600 px-3 py-2 text-xs-ui font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={props.busy}
            onClick={() => {
              void props.onLookup()
            }}
          >
            {props.busy ? 'Loading...' : 'Lookup'}
          </button>
        </div>
      </div>
    </section>
  )
}
