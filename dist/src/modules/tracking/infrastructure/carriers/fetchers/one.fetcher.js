import axios from 'axios';
import { OneCopEventsResponseSchema, OneSearchResponseSchema, OneVoyageListResponseSchema, } from '~/modules/tracking/infrastructure/carriers/schemas/api/one.api.schema';
import { systemClock } from '~/shared/time/clock';
const ONE_BASE_URL = 'https://ecomm.one-line.com';
function toTrimmedOrNull(value) {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
function normalizeContainerNumber(value) {
    return value.replace(/\s+/g, '').toUpperCase();
}
function buildEndpointMeta(command) {
    return {
        ok: command.ok,
        statusCode: command.statusCode,
        error: command.error,
        receivedCount: command.receivedCount,
    };
}
function isSuccessfulCarrierEnvelope(envelope) {
    return envelope.status === 200 && envelope.code === 1;
}
async function postOneSearch(containerNumber) {
    const response = await axios.post(`${ONE_BASE_URL}/api/v1/edh/containers/track-and-trace/search`, {
        page: 1,
        page_length: 20,
        filters: {
            search_text: containerNumber,
            search_type: 'CNTR_NO',
        },
    }, {
        timeout: 30_000,
        validateStatus: () => true,
        headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
            Accept: 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Content-Type': 'application/json',
        },
    });
    console.info('[tracking:one] endpoint completed', {
        endpoint: 'search',
        containerNumber,
        statusCode: response.status,
    });
    return {
        payload: response.data,
        statusCode: response.status,
    };
}
async function getOneEndpoint(command) {
    const response = await axios.get(`${ONE_BASE_URL}/api/v1/edh/${command.endpoint === 'voyage-list' ? 'vessel' : 'containers'}/track-and-trace/${command.endpoint}`, {
        params: command.params,
        timeout: 30_000,
        validateStatus: () => true,
        headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
            Accept: 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
        },
    });
    console.info('[tracking:one] endpoint completed', {
        endpoint: command.endpoint,
        bookingNo: command.params.booking_no,
        containerNumber: command.params.container_no ?? null,
        statusCode: response.status,
    });
    return {
        payload: response.data,
        statusCode: response.status,
    };
}
function validateSearchResult(command) {
    const schemaResult = OneSearchResponseSchema.safeParse(command.payload);
    const receivedCount = schemaResult.success ? schemaResult.data.data.length : null;
    const errors = [];
    if (command.statusCode < 200 || command.statusCode >= 300) {
        errors.push(`ONE search request failed with status ${command.statusCode}`);
    }
    if (!schemaResult.success) {
        errors.push('ONE search response missing expected status/code/data shape');
        return {
            meta: buildEndpointMeta({
                ok: false,
                statusCode: command.statusCode,
                error: errors.join(': '),
                receivedCount,
            }),
            parseError: errors.join(': '),
            searchPayload: null,
            searchItem: null,
        };
    }
    const payload = schemaResult.data;
    if (!isSuccessfulCarrierEnvelope(payload)) {
        errors.push(`ONE search returned unsuccessful carrier envelope status=${payload.status} code=${payload.code}`);
    }
    const searchItem = payload.data[0] ?? null;
    if (searchItem === null) {
        errors.push('ONE search returned no container match');
    }
    const returnedContainerNumber = searchItem?.containerNo ?? null;
    if (returnedContainerNumber !== null &&
        normalizeContainerNumber(returnedContainerNumber) !==
            normalizeContainerNumber(command.containerNumber)) {
        errors.push(`ONE search returned mismatched container ${normalizeContainerNumber(returnedContainerNumber)}`);
    }
    if (toTrimmedOrNull(searchItem?.bookingNo) === null) {
        errors.push('ONE search response missing bookingNo');
    }
    const parseError = errors.length > 0 ? errors.join(' | ') : null;
    return {
        meta: buildEndpointMeta({
            ok: parseError === null,
            statusCode: command.statusCode,
            error: parseError,
            receivedCount,
        }),
        parseError,
        searchPayload: payload,
        searchItem,
    };
}
function validateVoyageListResult(command) {
    const schemaResult = OneVoyageListResponseSchema.safeParse(command.payload);
    const receivedCount = schemaResult.success ? schemaResult.data.data.length : null;
    const errors = [];
    if (command.statusCode < 200 || command.statusCode >= 300) {
        errors.push(`ONE voyage-list request failed with status ${command.statusCode}`);
    }
    if (!schemaResult.success) {
        errors.push('ONE voyage-list response missing expected status/code/data shape');
        return {
            meta: buildEndpointMeta({
                ok: false,
                statusCode: command.statusCode,
                error: errors.join(': '),
                receivedCount,
            }),
            parseError: errors.join(': '),
            parsed: null,
        };
    }
    if (!isSuccessfulCarrierEnvelope(schemaResult.data)) {
        errors.push(`ONE voyage-list returned unsuccessful carrier envelope status=${schemaResult.data.status} code=${schemaResult.data.code}`);
    }
    const parseError = errors.length > 0 ? errors.join(' | ') : null;
    return {
        meta: buildEndpointMeta({
            ok: parseError === null,
            statusCode: command.statusCode,
            error: parseError,
            receivedCount,
        }),
        parseError,
        parsed: schemaResult.data,
    };
}
function validateCopEventsResult(command) {
    const schemaResult = OneCopEventsResponseSchema.safeParse(command.payload);
    const receivedCount = schemaResult.success ? schemaResult.data.data.length : null;
    const errors = [];
    if (command.statusCode < 200 || command.statusCode >= 300) {
        errors.push(`ONE cop-events request failed with status ${command.statusCode}`);
    }
    if (!schemaResult.success) {
        errors.push('ONE cop-events response missing expected status/code/data shape');
        return {
            meta: buildEndpointMeta({
                ok: false,
                statusCode: command.statusCode,
                error: errors.join(': '),
                receivedCount,
            }),
            parseError: errors.join(': '),
            parsed: null,
        };
    }
    if (!isSuccessfulCarrierEnvelope(schemaResult.data)) {
        errors.push(`ONE cop-events returned unsuccessful carrier envelope status=${schemaResult.data.status} code=${schemaResult.data.code}`);
    }
    const parseError = errors.length > 0 ? errors.join(' | ') : null;
    return {
        meta: buildEndpointMeta({
            ok: parseError === null,
            statusCode: command.statusCode,
            error: parseError,
            receivedCount,
        }),
        parseError,
        parsed: schemaResult.data,
    };
}
function buildSkippedMeta(reason) {
    return buildEndpointMeta({
        ok: false,
        statusCode: null,
        error: reason,
        receivedCount: null,
    });
}
async function fetchVoyageListWithGracefulFailure(bookingNo) {
    try {
        const response = await getOneEndpoint({
            endpoint: 'voyage-list',
            params: { booking_no: bookingNo },
        });
        const validation = validateVoyageListResult(response);
        return {
            payload: response.payload,
            meta: validation.meta,
            parseError: validation.parseError,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[tracking:one] voyage-list transport failed', {
            bookingNo,
            error: message,
        });
        return {
            payload: null,
            meta: buildEndpointMeta({
                ok: false,
                statusCode: null,
                error: `ONE voyage-list transport failed: ${message}`,
                receivedCount: null,
            }),
            parseError: `ONE voyage-list transport failed: ${message}`,
        };
    }
}
async function fetchCopEventsWithGracefulFailure(command) {
    try {
        const response = await getOneEndpoint({
            endpoint: 'cop-events',
            params: {
                booking_no: command.bookingNo,
                container_no: command.containerNumber,
            },
        });
        const validation = validateCopEventsResult(response);
        return {
            payload: response.payload,
            meta: validation.meta,
            parseError: validation.parseError,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[tracking:one] cop-events transport failed', {
            bookingNo: command.bookingNo,
            containerNumber: command.containerNumber,
            error: message,
        });
        return {
            payload: null,
            meta: buildEndpointMeta({
                ok: false,
                statusCode: null,
                error: `ONE cop-events transport failed: ${message}`,
                receivedCount: null,
            }),
            parseError: `ONE cop-events transport failed: ${message}`,
        };
    }
}
function buildRawSnapshot(command) {
    return {
        provider: 'one',
        search: command.searchPayload,
        voyageList: command.voyageListPayload,
        copEvents: command.copEventsPayload,
        requestMeta: {
            containerNumber: normalizeContainerNumber(command.containerNumber),
            bookingNo: command.bookingNo,
        },
        endpointMeta: {
            search: command.searchMeta,
            voyageList: command.voyageListMeta,
            copEvents: command.copEventsMeta,
        },
    };
}
export async function fetchOneStatus(containerNumber) {
    const observedAt = systemClock.now().toIsoString();
    const normalizedContainerNumber = normalizeContainerNumber(containerNumber);
    const searchResponse = await postOneSearch(normalizedContainerNumber);
    const searchValidation = validateSearchResult({
        containerNumber: normalizedContainerNumber,
        statusCode: searchResponse.statusCode,
        payload: searchResponse.payload,
    });
    const searchBookingNo = toTrimmedOrNull(searchValidation.searchItem?.bookingNo);
    const searchParseError = searchValidation.parseError;
    if (searchParseError !== null || searchBookingNo === null) {
        const payload = buildRawSnapshot({
            containerNumber: normalizedContainerNumber,
            bookingNo: searchBookingNo,
            searchPayload: searchResponse.payload,
            voyageListPayload: null,
            copEventsPayload: null,
            searchMeta: searchValidation.meta,
            voyageListMeta: buildSkippedMeta('Skipped because ONE bookingNo could not be resolved'),
            copEventsMeta: buildSkippedMeta('Skipped because ONE bookingNo could not be resolved'),
        });
        return {
            provider: 'one',
            payload,
            fetchedAt: observedAt,
            parseError: searchParseError ?? 'ONE search response missing bookingNo',
        };
    }
    const [voyageListResult, copEventsResult] = await Promise.all([
        fetchVoyageListWithGracefulFailure(searchBookingNo),
        fetchCopEventsWithGracefulFailure({
            bookingNo: searchBookingNo,
            containerNumber: normalizedContainerNumber,
        }),
    ]);
    const payload = buildRawSnapshot({
        containerNumber: normalizedContainerNumber,
        bookingNo: searchBookingNo,
        searchPayload: searchResponse.payload,
        voyageListPayload: voyageListResult.payload,
        copEventsPayload: copEventsResult.payload,
        searchMeta: searchValidation.meta,
        voyageListMeta: voyageListResult.meta,
        copEventsMeta: copEventsResult.meta,
    });
    const parseError = [searchParseError, voyageListResult.parseError, copEventsResult.parseError]
        .filter((value) => value !== null && value.trim().length > 0)
        .join(' | ');
    return {
        provider: 'one',
        payload,
        fetchedAt: observedAt,
        parseError: parseError.length > 0 ? parseError : null,
    };
}
