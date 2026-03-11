Canonical companion references:
- Architecture/UI guardrails: `docs/UI_PHILOSOPHY.md`
- Domain-truth ownership: `docs/adr/0007-domain-truth-ownership.md`

Create a professional enterprise dashboard UI for an internal logistics tracking system called:

"Castro Aduaneira — Container Tracker"

This software is used by customs brokers to monitor container shipments, import processes, and operational exceptions.

The system must prioritize operational awareness and high information density.

LANGUAGE

Interface language default: English

Include a language toggle in the top navigation bar:

EN | PT-BR

The interface should be designed so that labels can be translated easily.

DESIGN STYLE

Internal enterprise software

Clean but dense operational interface

Focus on clarity, scanning speed, and anomaly detection

Visually disciplined (low noise), never visually sparse; keep high information density

Light theme (white / very light gray background)

Primary colors based on Castro Aduaneira brand:

Navy blue
Gray

Accent colors used for operational status:

Blue → In Transit
Orange → Discharged
Green → Cleared
Red → Delayed / Risk

Use subtle logistics visual elements:

container icons
ship icons
port icons

Optional subtle world map watermark in the background.

TOP NAVIGATION BAR

Left:

Castro Aduaneira logo

Title:

Castro Aduaneira — Container Tracker

Menu:

Dashboard
Agents

Right side:

Global search bar
Placeholder:

"Search process, container, BL, importer..."

Sync button

Primary button:

Create Process

Language toggle:

🌐 EN | PT-BR

DASHBOARD PAGE

Section: Operational Alerts

Card showing number of active alerts.

If zero:

"No active alerts at the moment"

Filters:

Severity
Provider
Status
Importer

MAIN COMPONENT: PROCESS TABLE

Create a modern logistics data table.

Columns:

Process
Importer
Exporter
Route
Status
ETA
Sync
Alerts

Status badges:

In Transit (blue)
Discharged (orange)
Cleared (green)
Delayed (red)

Table behavior:

Sticky header
Compact dense rows
Hover highlight
Inline sync button
Alert icons

SHIPMENT / PROCESS VIEW (IMPORTANT)

Design a detailed shipment tracking page optimized for operational monitoring.

Layout must follow a timeline-first structure.

Main layout:

Two-column layout.

Left column (primary):

Container selector
Container timeline

Right column (sidebar):

Shipment information
Current status

CONTAINER SELECTOR

Card listing containers in the process.

Each container shows:

Container number
ETA
Internal reference
Last update time

TIMELINE (PRIMARY COMPONENT)

The timeline is the central artifact of the interface.

It must display:

Logistics events in chronological order.

Examples of events:

Gate In
Loaded on Vessel
Vessel Departure
Arrival at Port
Discharged
Transshipment
Terminal Exit
Delivery

Each event should show:

Event icon
Event name
Location
Date
Vessel name (when applicable)

Visual grouping by voyage.

Preserve grouped operational blocks instead of flattening into a generic flat list.

Example:

Vessel Section:

ADELINA — Voyage 604S
Port Said → Barcelona

Event markers:

Green icon for completed events
Muted icon for historical events

TRANS-SHIPMENT BLOCK

Use a highlighted card between voyage segments:

Transshipment
PORT SAID

ADELINA → SINE A

OPERATIONAL GAPS

Display inactivity periods between events.

Example:

"17 days without new events"

These gaps should be visually subtle but readable.

SIDEBAR

Shipment information:

Carrier
BL
Importer
Exporter
Product
Redestination

Status card:

Container number
Current status
ETA
Current location
Current vessel
Last update

VISUAL STYLE

Rounded cards
Soft shadows
Clean typography
Readable spacing
Compact layout optimized for daily operational use.

GOAL

Design a professional internal logistics tracking system that allows customs brokers to quickly understand the operational state of container shipments and detect issues early.
