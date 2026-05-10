# PDF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Export PDF" buttons to the Dashboard and Imaging pages. Clicking captures the results area as a styled PDF and triggers a browser download.

**Architecture:** A single `exportPdf.js` utility (html2canvas + jspdf) shared between both pages. Dashboard button captures the main results div when `hasResults`. Imaging button captures the results div when at least one image has been analyzed. No backend changes.

**Tech Stack:** `jspdf`, `html2canvas` (new npm deps), React (frontend)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `medicluster/frontend/package.json` | Modify | Add jspdf + html2canvas dependencies |
| `medicluster/frontend/src/utils/exportPdf.js` | Create | html2canvas + jspdf capture utility |
| `medicluster/frontend/src/pages/DashboardPage.jsx` | Modify | Add Export PDF button + ref on results area |
| `medicluster/frontend/src/pages/ImagingPage.jsx` | Modify | Add Export PDF button + ref on results area |

---

### Task 1: Install npm dependencies

**Files:**
- Modify: `medicluster/frontend/package.json`

- [ ] **Step 1: Install jspdf and html2canvas**

Run from `medicluster/frontend/`:

```bash
npm install jspdf html2canvas
```

Expected output: packages added, `package.json` updated with `"jspdf"` and `"html2canvas"` in `dependencies`.

- [ ] **Step 2: Verify installation**

```bash
ls node_modules/jspdf && ls node_modules/html2canvas
```

Expected: both directories exist.

- [ ] **Step 3: Commit**

```bash
git add medicluster/frontend/package.json medicluster/frontend/package-lock.json
git commit -m "feat: add jspdf and html2canvas dependencies for PDF export"
```

---

### Task 2: Create exportPdf.js utility

**Files:**
- Create: `medicluster/frontend/src/utils/exportPdf.js`

- [ ] **Step 1: Create the utility**

Create `medicluster/frontend/src/utils/exportPdf.js`:

```js
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * Captures a DOM element and downloads it as an A4 PDF.
 * @param {string} elementId  id attribute of the element to capture
 * @param {string} title      PDF header title text
 * @param {string} filename   output filename (without .pdf extension)
 */
export async function exportToPdf(elementId, title, filename) {
  const element = document.getElementById(elementId);
  if (!element) {
    alert("Export failed — results panel not found.");
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const pageW = pdf.internal.pageSize.getWidth();
    const margin = 12;
    const contentW = pageW - margin * 2;

    // Header
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("MediCluster", margin, 14);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(`— ${title}`, margin + 30, 14);
    pdf.setFontSize(8);
    pdf.setTextColor(140, 140, 140);
    pdf.text(dateStr, pageW - margin, 14, { align: "right" });
    pdf.setTextColor(0, 0, 0);

    // Divider
    pdf.setDrawColor(220, 220, 220);
    pdf.line(margin, 17, pageW - margin, 17);

    // Captured image
    const imgW = contentW;
    const imgH = (canvas.height / canvas.width) * imgW;
    const startY = 21;

    if (imgH <= pdf.internal.pageSize.getHeight() - startY - margin) {
      pdf.addImage(imgData, "PNG", margin, startY, imgW, imgH);
    } else {
      // Multi-page: slice the image across pages
      const pageH = pdf.internal.pageSize.getHeight() - startY - margin;
      const sliceH = Math.floor((pageH / imgH) * canvas.height);
      let yOffset = 0;
      let pageNum = 0;

      while (yOffset < canvas.height) {
        if (pageNum > 0) {
          pdf.addPage();
        }
        const slice = document.createElement("canvas");
        const remaining = canvas.height - yOffset;
        slice.width = canvas.width;
        slice.height = Math.min(sliceH, remaining);
        const ctx = slice.getContext("2d");
        ctx.drawImage(canvas, 0, yOffset, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
        const sliceData = slice.toDataURL("image/png");
        const renderedH = (slice.height / canvas.width) * imgW;
        pdf.addImage(sliceData, "PNG", margin, pageNum === 0 ? startY : margin, imgW, renderedH);
        yOffset += sliceH;
        pageNum++;
      }
    }

    pdf.save(`${filename}-${now.toISOString().slice(0, 10)}.pdf`);
  } catch (err) {
    console.error("PDF export failed:", err);
    alert("Export failed — try scrolling to top first and retrying.");
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add medicluster/frontend/src/utils/exportPdf.js
git commit -m "feat: add exportToPdf utility (html2canvas + jspdf)"
```

---

### Task 3: Dashboard — Export PDF button

**Files:**
- Modify: `medicluster/frontend/src/pages/DashboardPage.jsx`

Add an `id="dashboard-results"` wrapper around the results area and an "Export PDF" button in the tab bar. The button is only visible when `hasResults` is true.

- [ ] **Step 1: Add import and button in DashboardPage.jsx**

Open `medicluster/frontend/src/pages/DashboardPage.jsx`.

**Add import** at the top (after existing imports):
```js
import { exportToPdf } from "../utils/exportPdf";
```

**Add the Export button** in the tab bar `<div>` (the `flex gap-0.5 px-4 pt-3 pb-0` div), after the existing `{TABS.map(...)}` block and before the closing `</div>`:

```jsx
{hasResults && (
  <button
    onClick={() => exportToPdf(
      "dashboard-results",
      `Clustering Report — ${result?.algorithm?.toUpperCase() ?? ""}`,
      "medicluster-clustering"
    )}
    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
  >
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
    Export PDF
  </button>
)}
```

**Wrap the results content div** — add `id="dashboard-results"` to the `<div className="flex-1 p-3 overflow-y-auto space-y-3">` element:

Change:
```jsx
<div className="flex-1 p-3 overflow-y-auto space-y-3">
```

To:
```jsx
<div id="dashboard-results" className="flex-1 p-3 overflow-y-auto space-y-3">
```

- [ ] **Step 2: Test in browser**

Open the Dashboard, upload a dataset, run clustering. Confirm:
- "Export PDF" button appears in tab bar after results load
- Clicking it triggers a browser download of a PDF named `medicluster-clustering-<date>.pdf`
- PDF contains MediCluster header, date, and the captured results
- Button is NOT visible before results load

- [ ] **Step 3: Commit**

```bash
git add medicluster/frontend/src/pages/DashboardPage.jsx
git commit -m "feat: add Export PDF button to Dashboard results area"
```

---

### Task 4: Imaging page — Export PDF button

**Files:**
- Modify: `medicluster/frontend/src/pages/ImagingPage.jsx`

Add an `id="imaging-results"` wrapper around the results section and an "Export PDF" button in the page header. Button only shows when at least one analysis has been completed (i.e., `analysisResult` state is set).

- [ ] **Step 1: Read the current ImagingPage.jsx structure**

Read `medicluster/frontend/src/pages/ImagingPage.jsx` to find:
- Where the results section starts (the div that should get `id="imaging-results"`)
- Where the page header / top section is (where to place the button)
- What state variable tracks whether an analysis has been done (`analysisResult` or similar)

- [ ] **Step 2: Add import and Export PDF button**

Add the import at the top of `ImagingPage.jsx`:
```js
import { exportToPdf } from "../utils/exportPdf";
```

Find the results section that contains the disease cards (the section rendered after analysis completes). Add `id="imaging-results"` to that wrapper div.

Find the page header area (near the top of the right column or the file/model selector area). Add the Export PDF button, visible only when `analysisResult` (or whatever state holds the analysis data) is non-null:

```jsx
{analysisResult && (
  <button
    onClick={() => exportToPdf(
      "imaging-results",
      "Imaging Analysis Report",
      "medicluster-imaging"
    )}
    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
  >
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
    Export PDF
  </button>
)}
```

Note: the exact state variable name depends on the current ImagingPage.jsx implementation. Read the file first to confirm the variable name.

- [ ] **Step 3: Test in browser**

Open the Imaging page, upload and analyze a chest X-ray. Confirm:
- "Export PDF" button appears after analysis completes
- Clicking downloads `medicluster-imaging-<date>.pdf`
- PDF contains MediCluster header and captured disease cards

- [ ] **Step 4: Commit**

```bash
git add medicluster/frontend/src/pages/ImagingPage.jsx
git commit -m "feat: add Export PDF button to Imaging results area"
```
