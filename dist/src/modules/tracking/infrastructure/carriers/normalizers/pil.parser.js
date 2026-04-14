import { CalendarDate } from '~/shared/time/calendar-date';
import { calendarDateValue } from '~/shared/time/temporal-value';
const MONTHS_BY_ABBREVIATION = new Map([
    ['JAN', 1],
    ['FEB', 2],
    ['MAR', 3],
    ['APR', 4],
    ['MAY', 5],
    ['JUN', 6],
    ['JUL', 7],
    ['AUG', 8],
    ['SEP', 9],
    ['OCT', 10],
    ['NOV', 11],
    ['DEC', 12],
]);
function normalizeWhitespace(value) {
    return value.replace(/\s+/gu, ' ').trim();
}
function decodeHtmlEntities(value) {
    return value
        .replace(/&nbsp;/giu, ' ')
        .replace(/&amp;/giu, '&')
        .replace(/&quot;/giu, '"')
        .replace(/&#39;|&apos;/giu, "'")
        .replace(/&lt;/giu, '<')
        .replace(/&gt;/giu, '>');
}
function htmlToText(value) {
    return decodeHtmlEntities(value
        .replace(/<br\s*\/?>/giu, '\n')
        .replace(/<\/?(div|p|table|tbody|thead|tr|td|th|b)[^>]*>/giu, ' ')
        .replace(/<[^>]+>/gu, ' '));
}
function toNormalizedTextOrNull(value) {
    const normalized = normalizeWhitespace(value);
    return normalized.length > 0 ? normalized : null;
}
function extractCellHtmlBlocks(rowHtml) {
    const blocks = [];
    const matches = rowHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/giu);
    for (const match of matches) {
        const block = match[1];
        if (block !== undefined) {
            blocks.push(block);
        }
    }
    return blocks;
}
function extractCellLines(cellHtml) {
    const text = htmlToText(cellHtml);
    const lines = [];
    for (const line of text.split(/\n+/u)) {
        const normalized = normalizeWhitespace(line);
        if (normalized.length > 0) {
            lines.push(normalized);
        }
    }
    return lines;
}
function extractFirstMatch(value, pattern) {
    const match = value.match(pattern);
    const capture = match?.[1];
    if (capture === undefined)
        return null;
    return capture;
}
function parsePilTemporalText(value) {
    if (value === null) {
        return { eventDate: null, eventLocalDateTime: null, eventTimeType: null };
    }
    const normalizedValue = normalizeWhitespace(value);
    if (normalizedValue.length === 0) {
        return { eventDate: null, eventLocalDateTime: null, eventTimeType: null };
    }
    if (normalizedValue.toLowerCase() === 'information not available') {
        return { eventDate: null, eventLocalDateTime: null, eventTimeType: null };
    }
    const eventTimeType = normalizedValue.startsWith('*') ? 'EXPECTED' : 'ACTUAL';
    const normalizedTimestamp = normalizeWhitespace(normalizedValue.startsWith('*') ? normalizedValue.slice(1) : normalizedValue);
    const match = normalizedTimestamp.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/u);
    if (!match) {
        return { eventDate: null, eventLocalDateTime: null, eventTimeType: null };
    }
    const dayPart = match[1];
    const monthPart = match[2];
    const yearPart = match[3];
    const hourPart = match[4];
    const minutePart = match[5];
    const secondPart = match[6];
    if (dayPart === undefined || monthPart === undefined || yearPart === undefined) {
        return { eventDate: null, eventLocalDateTime: null, eventTimeType: null };
    }
    const month = MONTHS_BY_ABBREVIATION.get(monthPart.toUpperCase());
    if (month === undefined) {
        return { eventDate: null, eventLocalDateTime: null, eventTimeType: null };
    }
    const day = Number(dayPart);
    const year = Number(yearPart);
    if (!Number.isInteger(day) || !Number.isInteger(year)) {
        return { eventDate: null, eventLocalDateTime: null, eventTimeType: null };
    }
    if (hourPart === undefined || minutePart === undefined || secondPart === undefined) {
        try {
            return {
                eventDate: CalendarDate.fromIsoDate(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`),
                eventLocalDateTime: null,
                eventTimeType,
            };
        }
        catch {
            return { eventDate: null, eventLocalDateTime: null, eventTimeType: null };
        }
    }
    const hour = Number(hourPart);
    const minute = Number(minutePart);
    const second = Number(secondPart);
    if (!Number.isInteger(hour) || !Number.isInteger(minute) || !Number.isInteger(second)) {
        return { eventDate: null, eventLocalDateTime: null, eventTimeType: null };
    }
    return {
        eventDate: null,
        eventLocalDateTime: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.000`,
        eventTimeType,
    };
}
function parseSummaryNextLocationDate(value) {
    const parsedTemporal = parsePilTemporalText(value);
    if (parsedTemporal.eventDate !== null) {
        return calendarDateValue(parsedTemporal.eventDate);
    }
    if (parsedTemporal.eventLocalDateTime === null) {
        return null;
    }
    try {
        return calendarDateValue(CalendarDate.fromIsoDate(parsedTemporal.eventLocalDateTime.slice(0, 10)));
    }
    catch {
        return null;
    }
}
function parseSummary(html) {
    const summaryRowHtml = extractFirstMatch(html, /<tr\b[^>]*class="resultrow"[^>]*>([\s\S]*?)<\/tr>/iu);
    if (summaryRowHtml === null)
        return null;
    const cells = extractCellHtmlBlocks(summaryRowHtml);
    if (cells.length < 4)
        return null;
    const locationLines = cells[1] === undefined ? [] : extractCellLines(cells[1]);
    const vesselLines = cells[2] === undefined ? [] : extractCellLines(cells[2]);
    const nextLocationLines = cells[3] === undefined ? [] : extractCellLines(cells[3]);
    return {
        rawLoadPortName: locationLines[1] ?? null,
        rawLoadPortCode: locationLines[2] ?? null,
        rawNextLocationCode: nextLocationLines[0] ?? null,
        rawNextLocationDateText: nextLocationLines[1] ?? null,
        nextLocationDate: parseSummaryNextLocationDate(nextLocationLines[1] ?? null),
        rawVessel: vesselLines[0] ?? null,
        rawVoyage: vesselLines[1] ?? null,
    };
}
function parseDetailedEvents(html) {
    const detailBodyHtml = extractFirstMatch(html, /<tbody\b[^>]*id="container_info_sub_[^"]+"[^>]*>([\s\S]*?)<\/tbody>/iu);
    if (detailBodyHtml === null) {
        return {
            ok: false,
            error: 'PIL payload missing detailed event table',
        };
    }
    const detailedEvents = [];
    const rows = detailBodyHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/giu);
    for (const row of rows) {
        const rowHtml = row[1];
        if (rowHtml === undefined)
            continue;
        const cells = extractCellHtmlBlocks(rowHtml);
        if (cells.length < 5)
            continue;
        const rawVessel = cells[0] === undefined ? null : toNormalizedTextOrNull(htmlToText(cells[0]));
        const rawVoyage = cells[1] === undefined ? null : toNormalizedTextOrNull(htmlToText(cells[1]));
        const rawEventTimeText = cells[2] === undefined ? null : toNormalizedTextOrNull(htmlToText(cells[2]));
        const rawEventName = cells[3] === undefined ? '' : normalizeWhitespace(htmlToText(cells[3]));
        const rawPlace = cells[4] === undefined ? null : toNormalizedTextOrNull(htmlToText(cells[4]));
        const parsedTemporal = parsePilTemporalText(rawEventTimeText);
        detailedEvents.push({
            rawEventName,
            rawEventTimeText,
            eventDate: parsedTemporal.eventDate,
            eventLocalDateTime: parsedTemporal.eventLocalDateTime,
            eventTimeType: parsedTemporal.eventTimeType,
            rawPlace,
            rawVessel,
            rawVoyage,
        });
    }
    if (detailedEvents.length === 0) {
        return {
            ok: false,
            error: 'PIL payload detailed event table contained no rows',
        };
    }
    return {
        ok: true,
        value: {
            containerNumber: extractFirstMatch(html, /Container\s*#\s*<b>\s*([^<]+?)\s*<\/b>/iu),
            summary: parseSummary(html),
            detailedEvents,
        },
    };
}
export function parsePilTrackingPayload(payload) {
    return parseDetailedEvents(payload.data);
}
