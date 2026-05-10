# PDF Report Export — Design

**Date:** 2026-05-10
**Feature:** Export clustering results and patient imaging analysis as a downloadable PDF report

---

## Overview

Add "Export PDF" buttons to the Dashboard (clustering results) and Imaging page. Uses `jspdf` + `html2canvas` on the frontend to capture the relevant UI sections and generate a styled PDF. No backend changes needed.

---

## Architecture

```
User clicks "Export PDF" on Dashboard or Imaging page
        │
        ▼
frontend/src/utils/exportPdf.js
  → html2canvas captures target DOM element
  → jspdf creates PDF with title, timestamp, captured image
  → browser triggers download as medicluster-report-<date>.pdf
```

---

## Frontend Changes

### New utility: `frontend/src/utils/exportPdf.js`

```js
export async function exportToPdf(elementId, filename) {
  // 1. html2canvas captures the element
  // 2. jspdf creates A4 PDF
  // 3. adds MediCluster header with title + timestamp
  // 4. fits the canvas image to page width
  // 5. triggers browser download
}
```

### Dashboard page (`DashboardPage.jsx`)

Add "Export PDF" button in the tab bar area (top right), visible only when results exist (`hasResults`). Captures the main results area (scatter plot + risk donut + metrics + patient table).

### Imaging page (`ImagingPage.jsx`)

Add "Export PDF" button in the page header, visible only when at least one image has been analyzed. Captures the full results area (all ImageCards with their disease cards).

### New npm dependencies (frontend):
- `jspdf`
- `html2canvas`

---

## PDF Content

**Dashboard PDF:**
- Header: "MediCluster — Clustering Report" + algorithm name + date
- Captures: full results panel (scatter plot, risk distribution, metrics, patient table)

**Imaging PDF:**
- Header: "MediCluster — Imaging Analysis Report" + date
- Captures: all analyzed image cards with their findings

---

## Error States

| Scenario | Behaviour |
|---|---|
| html2canvas fails (CORS) | Alert: "Export failed — try scrolling to top first" |
| No results to export | Button is hidden (not shown until results exist) |

---

## Out of Scope
- Server-side PDF generation
- Custom PDF templates or branding beyond header
- Emailing the PDF
