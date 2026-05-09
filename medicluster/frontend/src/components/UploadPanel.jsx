import { useCallback, useRef, useState } from "react";
import sampleData from "../data/sample_patients.json";
import { uploadDataset } from "../api/apiClient";

function UploadIcon() {
  return (
    <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function UploadPanel({ onDatasetLoaded }) {
  const [dragging,  setDragging]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [dataset,   setDataset]   = useState(null);
  const inputRef = useRef();

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const result = await uploadDataset(file);
      setDataset(result);
      onDatasetLoaded?.(result);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }, [onDatasetLoaded]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handleSampleLoad = async () => {
    setError(null);
    setLoading(true);
    try {
      const csv = jsonToCSV(sampleData);
      const file = new File([csv], "sample_patients.csv", { type: "text/csv" });
      const result = await uploadDataset(file);
      setDataset(result);
      onDatasetLoaded?.(result);
    } catch {
      const fakeResult = {
        datasetId: "__sample__",
        name: "Sample Dataset (100 patients)",
        rowCount: sampleData.length,
        featureNames: Object.keys(sampleData[0]).filter((k) => k !== "patient_id"),
        rawData: sampleData,
      };
      setDataset(fakeResult);
      onDatasetLoaded?.(fakeResult);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel space-y-3">
      <p className="section-label">Dataset</p>

      {!dataset ? (
        <>
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200 ${
              dragging
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
            {loading ? (
              <div className="flex flex-col items-center gap-2 py-2">
                <div className="spinner w-6 h-6" />
                <p className="text-xs text-slate-400">Processing…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-1">
                <UploadIcon />
                <div>
                  <p className="text-sm text-slate-600 font-medium">
                    Drop a <span className="text-blue-600 font-mono">.csv</span> file
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">or click to browse</p>
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2 text-xs text-slate-300">
            <div className="flex-1 h-px bg-slate-100" />
            or
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          <button
            onClick={handleSampleLoad}
            disabled={loading}
            className="btn-secondary w-full text-xs py-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Use Sample Dataset
          </button>
        </>
      ) : (
        /* Dataset loaded state */
        <div className="space-y-3 fade-in">
          <div className="flex items-start gap-2">
            <CheckIcon />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{dataset.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                <span className="font-mono text-blue-600">{dataset.rowCount}</span> patients ·{" "}
                <span className="font-mono text-blue-600">{dataset.featureNames?.length ?? 0}</span> features
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {dataset.featureNames?.slice(0, 8).map((f) => (
              <span key={f} className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                {f}
              </span>
            ))}
            {(dataset.featureNames?.length ?? 0) > 8 && (
              <span className="text-xs text-slate-400 px-1">
                +{dataset.featureNames.length - 8} more
              </span>
            )}
          </div>

          <button
            onClick={() => setDataset(null)}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Remove dataset
          </button>
        </div>
      )}
    </div>
  );
}

function jsonToCSV(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows)
    lines.push(headers.map((h) => row[h] ?? "").join(","));
  return lines.join("\n");
}
