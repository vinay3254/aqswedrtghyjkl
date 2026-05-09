import React, { useCallback, useRef, useState } from "react";
import sampleData from "../data/sample_patients.json";
import { uploadDataset } from "../api/apiClient";

export default function UploadPanel({ onDatasetLoaded }) {
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [dataset, setDataset]     = useState(null);
  const inputRef = useRef();

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    setProgress(20);

    try {
      const result = await uploadDataset(file);
      setProgress(100);
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
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleSampleLoad = async () => {
    setError(null);
    setLoading(true);
    setProgress(50);
    try {
      // Simulate upload via creating a Blob from sample JSON
      const csv = jsonToCSV(sampleData);
      const file = new File([csv], "sample_patients.csv", { type: "text/csv" });
      const result = await uploadDataset(file);
      setProgress(100);
      setDataset(result);
      onDatasetLoaded?.(result);
    } catch (err) {
      // Fallback: use sample data directly (offline mode)
      const fakeResult = {
        datasetId: "__sample__",
        name: "Sample Pima Diabetes Dataset",
        rowCount: sampleData.length,
        featureNames: Object.keys(sampleData[0]).filter((k) => k !== "patient_id"),
        rawData: sampleData,
      };
      setDataset(fakeResult);
      onDatasetLoaded?.(fakeResult);
    } finally {
      setProgress(0);
      setLoading(false);
    }
  };

  return (
    <div className="panel space-y-3">
      <p className="section-label">Dataset</p>

      {/* Drop zone */}
      {!dataset && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
            dragging
              ? "border-blue-500 bg-blue-50"
              : "border-blue-100 hover:border-blue-300 hover:bg-blue-50"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
          <div className="text-2xl mb-2">📁</div>
          <p className="text-sm text-slate-400">
            Drag & drop a <span className="text-blue-600 font-mono">.csv</span> file
          </p>
          <p className="text-xs text-slate-600 mt-1">or click to browse</p>
        </div>
      )}

      {/* Progress bar */}
      {loading && (
        <div className="w-full bg-navy-700 rounded-full h-1.5">
          <div
            className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-xs text-blue-800 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Sample button */}
      {!dataset && (
        <button
          onClick={handleSampleLoad}
          disabled={loading}
          className="btn-secondary w-full text-sm"
        >
          <span>Use Sample Dataset</span>
        </button>
      )}

      {/* Dataset info */}
      {dataset && (
        <div className="space-y-2 fade-in">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-900 truncate">{dataset.name}</span>
            <span className="font-mono text-xs text-blue-600">{dataset.rowCount} rows</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {dataset.featureNames?.map((f) => (
              <span key={f} className="text-xs font-mono bg-blue-50 border border-blue-100 px-2 py-0.5 rounded text-slate-600">
                {f}
              </span>
            ))}
          </div>
          <button
            onClick={() => { setDataset(null); setProgress(0); }}
            className="text-xs text-slate-500 hover:text-blue-700 transition-colors"
          >
            ✕ Remove dataset
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
  for (const row of rows) {
    lines.push(headers.map((h) => row[h] ?? "").join(","));
  }
  return lines.join("\n");
}
