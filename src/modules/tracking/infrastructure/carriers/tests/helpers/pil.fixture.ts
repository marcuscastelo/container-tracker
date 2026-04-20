import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'

export const PIL_SAMPLE_CONTAINER_NUMBER = 'PCIU8712104'
const PIL_SNAPSHOT_ID = '00000000-0000-0000-0000-000000000091'
const PIL_CONTAINER_ID = '00000000-0000-0000-0000-000000000092'

export const PIL_VALID_HTML = `
<div class="button-wrapper">
  <p>Container # <b>${PIL_SAMPLE_CONTAINER_NUMBER}</b></p>
  <button class="printButton">Print</button>
</div>
<div class="mypil-table">
  <table>
    <tr class="table-header">
      <th>Arrival/Delivery</th>
      <th>Location</th>
      <th>Vessel/Voyage</th>
      <th>Next Location</th>
    </tr>
    <tr class="resultrow">
      <td class="arrival-delivery"><br />13-Mar-2026<br />14-Mar-2026</td>
      <td class="location">Load Port<br />QINGDAO<br />CNTAO</td>
      <td class="vessel-voyage"><br />CMA CGM KRYPTON<br />VCGK0001W</td>
      <td class="next-location"><br />BRSSZ<br />23-Apr-2026</td>
    </tr>
  </table>
</div>
<div class="mypil-table">
  <table class="table">
    <thead>
      <tr><td colspan="5">Container # <b>${PIL_SAMPLE_CONTAINER_NUMBER}</b></td></tr>
    </thead>
    <tbody class="bg-darkblue text-20px text-fc-white text-fw-bold">
      <tr>
        <td class="tb-sub-header">Vessel</td>
        <td class="tb-sub-header">Voyage</td>
        <td class="tb-sub-header">Event Date</td>
        <td class="tb-sub-header">Event Name</td>
        <td class="tb-sub-header">Event Place</td>
      </tr>
    </tbody>
    <tbody id="container_info_sub_${PIL_SAMPLE_CONTAINER_NUMBER}">
      <tr class="text-fc-black">
        <td class="mypil-tbody-no-top-border"></td>
        <td class="mypil-tbody-no-top-border"></td>
        <td class="mypil-tbody-no-top-border">02-Mar-2026 14:04:00</td>
        <td class="mypil-tbody-no-top-border">O/B Empty Container Released</td>
        <td class="mypil-tbody-no-top-border">QINGDAO</td>
      </tr>
      <tr class="text-fc-black">
        <td class="mypil-tbody-no-top-border"></td>
        <td class="mypil-tbody-no-top-border"></td>
        <td class="mypil-tbody-no-top-border">12-Mar-2026 04:06:00</td>
        <td class="mypil-tbody-no-top-border">Truck Gate In to O/B Terminal</td>
        <td class="mypil-tbody-no-top-border">QINGDAO</td>
      </tr>
      <tr class="text-fc-black">
        <td class="mypil-tbody-no-top-border">CMA CGM KRYPTON</td>
        <td class="mypil-tbody-no-top-border">VCGK0001W</td>
        <td class="mypil-tbody-no-top-border">14-Mar-2026 04:10:00</td>
        <td class="mypil-tbody-no-top-border">Vessel Loading</td>
        <td class="mypil-tbody-no-top-border">QINGDAO</td>
      </tr>
      <tr class="text-fc-black">
        <td class="mypil-tbody-no-top-border">CMA CGM KRYPTON</td>
        <td class="mypil-tbody-no-top-border">VCGK0001W</td>
        <td class="mypil-tbody-no-top-border">* 23-Apr-2026 19:00:00</td>
        <td class="mypil-tbody-no-top-border">Vessel Discharge</td>
        <td class="mypil-tbody-no-top-border">SANTOS</td>
      </tr>
      <tr class="text-fc-black">
        <td class="mypil-tbody-no-top-border"></td>
        <td class="mypil-tbody-no-top-border"></td>
        <td class="mypil-tbody-no-top-border">Information Not Available</td>
        <td class="mypil-tbody-no-top-border">Truck Gate Out from I/B Terminal</td>
        <td class="mypil-tbody-no-top-border">SANTOS</td>
      </tr>
      <tr class="text-fc-black">
        <td class="mypil-tbody-no-top-border"></td>
        <td class="mypil-tbody-no-top-border"></td>
        <td class="mypil-tbody-no-top-border">Information Not Available</td>
        <td class="mypil-tbody-no-top-border">I/B Empty Container Returned</td>
        <td class="mypil-tbody-no-top-border">SANTOS</td>
      </tr>
    </tbody>
  </table>
</div>
`.trim()

export const PIL_VALID_PAYLOAD = {
  success: true,
  data: PIL_VALID_HTML,
}

export const PIL_UNSUCCESSFUL_PAYLOAD = {
  success: false,
  data: '<div class="button-wrapper"><p>Container not found</p></div>',
}

export const PIL_MISSING_TABLE_PAYLOAD = {
  success: true,
  data: `
    <div class="button-wrapper">
      <p>Container # <b>${PIL_SAMPLE_CONTAINER_NUMBER}</b></p>
    </div>
  `.trim(),
}

export function makePilSnapshot(payload: unknown): Snapshot {
  return {
    id: PIL_SNAPSHOT_ID,
    container_id: PIL_CONTAINER_ID,
    provider: 'pil',
    fetched_at: '2026-04-01T00:00:00.000Z',
    payload,
  }
}
