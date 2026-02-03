import axios from 'axios';

// Provider: CMA-CGM
// Implements a POST fetch to the public CMA-CGM tracking endpoint and
// extracts the JSON payload embedded in the returned HTML (options.responseData).
export async function fetchStatus(container: string): Promise<{ parsedStatus?: Record<string, unknown>; raw?: string }> {
    const response = await axios.post(
        'https://www.cma-cgm.com/ebusiness/tracking/search',
        new URLSearchParams({
            '__RequestVerificationToken': 'LXDaegidzJ7-SGQfrRDUDGSyU7iz97NftbpPpk1gW7EniJHdlbPcnJjCn4ZguciOiXDTcCixp-t9U-ASsTrXVNCcvz4uyhtCmqqH3o0XkyE1',
            'SearchViewModel.SearchBy': 'Container',
            'SearchViewModel.Reference': container,
            'SearchViewModel.FromHome': 'true',
            'search': ''
        }),
        {
            responseType: 'text',
            decompress: true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Referer': 'https://www.cma-cgm.com/ebusiness/tracking/search',
                'Origin': 'https://www.cma-cgm.com',
                'Sec-GPC': '1',
                'Alt-Used': 'www.cma-cgm.com',
                'Connection': 'keep-alive',
                'Cookie': 'datadome=EadwYMX4V~SX3ED9Vqkvc6Jegenl9TPtyO9SpgN89aKt4wZvHIHBM3_AcwHWH2tJkIc41fABd8B1ye8xLF3aOvYCt1AlO0mucLmUVkZrGSAdFhlEUFAIah8N_gmqN3KY; MustRelease=22.0.4.0; __RequestVerificationToken=64dS2BI8rYboYSq-JMaZn8dlXYijOkaLdFJIT0yXutdjqNzUCLbsLr61l1KUejvvPx1wCOqIFdpoh3vDBPBgt1B2j80asuEgtNeRpz0H2lI1; dtCookie=v_4_srv_2_sn_786CC8D9A19CFA6CC105F857BA5985D7_perc_100000_ol_0_mul_1_app-3A0b422508580a7b79_0_rcs-3Acss_0; Human_Search=1',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-User': '?1',
                'Priority': 'u=0, i',
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache',
                'TE': 'trailers'
            }
        }
    );

    const html = response.data as string;
    console.debug('cmacgm: HTML: ', html);

    const regex = /options\.responseData\s*=\s*(['"])([\s\S]*?)\1/;
    const match = html.match(regex);    

    if (match && match[2]) {
        let inner = match[2];
        // Unescape common JS string escapes so JSON.parse can handle it
        inner = inner.replace(/\\\//g, '/')
                        .replace(/\\n/g, '')
                        .replace(/\\r/g, '')
                        .replace(/\\t/g, '')
                        .replace(/\\'/g, "'")
                        .replace(/\\\"/g, '"')
                        .replace(/\\\\/g, '\\');    

        try {
            const parsedJson = JSON.parse(inner);
            console.debug('cmacgm: Parsed JSON: ', parsedJson);
            return { parsedStatus: parsedJson };
        } catch (e) {
            console.error('cmacgm: Failed to parse CMA responseData after unescape', e);
            return { raw: html };
        }
    } else {
        console.error('cmacgm: No responseData found in HTML');
        return { raw: html };
    }
}

export default { fetchStatus }
