// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";
// Diagnostic logging to ensure client bundle is running and to capture clicks
try {
	console.debug('entry-client: running')
	if (typeof document !== 'undefined') {
		document.addEventListener('click', (e) => {
			try {
				const t = e.target as HTMLElement | null
				console.debug('entry-client: global click on', t && (t.id || t.tagName || t.className))
				// Delegated handler for refresh buttons (works even if Solid onClick isn't attached)
				const btn = (e.target as HTMLElement | null)?.closest?.('button.refresh-button') as HTMLElement | null
				if (btn) {
					// mark as handled so component handler can skip duplicate
					try { btn.dataset.delegateHandled = '1' } catch (err) {}
					const container = btn.getAttribute('data-container') || ''
					console.debug('entry-client: delegated refresh click for', container)
					try { alert(`delegated handler: refreshing ${container}...`) } catch (err) {}
					fetch('/api/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ container }) })
						.then(async (res) => {
							let j = null
							try { j = await res.json() } catch (e) { }
							if (!res.ok) {
								try { alert(`Refresh failed: ${res.status} ${res.statusText}\n${j?.error ?? ''}`) } catch (err) {}
							} else {
								try { alert(`Refresh OK — updated: ${j?.updatedPath ?? 'unknown'}`) } catch (err) {}
							}
						})
						.catch((err) => { console.error('delegated refresh error', err); try { alert(`Refresh error: ${String(err)}`) } catch (e) {} })
				}
			} catch (err) {}
		}, { capture: true })
	}
} catch (err) {
	// ignore
}

mount(() => <StartClient />, document.getElementById("app")!);
