import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  analyzePatientMedia,
  deletePatientMedia,
  getMediaFileUrl,
  listPatientMedia,
  uploadPatientMedia,
} from "../api/apiClient";

const ACCEPT = "image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon() {
  return (
    <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function FindingsPanel({ findings, model }) {
  const TOP = 8;
  const top = findings.slice(0, TOP);
  return (
    <div className="mt-2 bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        AI Findings · <span className="font-mono normal-case">{model}</span>
      </p>
      {top.map((f) => (
        <div key={f.label} className="space-y-0.5">
          <div className="flex justify-between text-xs">
            <span className={`font-medium ${f.confidence > 0.5 ? "text-red-600" : "text-slate-600"}`}>
              {f.label}
            </span>
            <span className="text-slate-400 font-mono">{(f.confidence * 100).toFixed(1)}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${f.confidence > 0.5 ? "bg-red-500" : "bg-blue-400"}`}
              style={{ width: `${(f.confidence * 100).toFixed(1)}%` }}
            />
          </div>
        </div>
      ))}
      <p className="text-xs text-slate-400 pt-1">
        Confidence &gt;50% highlighted in red. For clinical reference only — not a diagnosis.
      </p>
    </div>
  );
}

export default function PatientMediaModal({ patientId, onClose }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [error, setError] = useState(null);
  const [analyzing, setAnalyzing] = useState(new Set());
  const [selectedFile, setSelectedFile] = useState(null);
  const inputRef = useRef();

  useEffect(() => {
    listPatientMedia(patientId)
      .then(setFiles)
      .catch(() => setError("Failed to load files"))
      .finally(() => setLoading(false));
  }, [patientId]);

  const handleUpload = useCallback(async (fileList) => {
    const selected = Array.from(fileList);
    if (!selected.length) return;
    setUploading(true);
    setError(null);
    try {
      const results = await Promise.all(
        selected.map((f) => uploadPatientMedia(patientId, f))
      );
      setFiles((prev) => [...results, ...prev]);
    } catch (e) {
      setError(e?.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [patientId]);

  const handleDelete = useCallback(async (fileId) => {
    try {
      await deletePatientMedia(fileId);
      setFiles((prev) => prev.filter((f) => f.gridfs_id !== fileId));
      if (lightbox === fileId) setLightbox(null);
      if (selectedFile?.gridfs_id === fileId) setSelectedFile(null);
    } catch {
      setError("Delete failed");
    }
  }, [lightbox, selectedFile]);

  const handleAnalyze = useCallback(async (file) => {
    setAnalyzing((prev) => new Set(prev).add(file.gridfs_id));
    setError(null);
    try {
      const analysis = await analyzePatientMedia(file.gridfs_id);
      const updated = { ...file, analysis };
      setFiles((prev) => prev.map((f) => f.gridfs_id === file.gridfs_id ? updated : f));
      setSelectedFile(updated);
    } catch (e) {
      setError(e?.response?.data?.error || "Analysis failed. Make sure the ML engine is running.");
    } finally {
      setAnalyzing((prev) => {
        const next = new Set(prev);
        next.delete(file.gridfs_id);
        return next;
      });
    }
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Patient Files</p>
            <h2 className="text-base font-bold text-blue-950 font-mono">{patientId}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Upload zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
              ${dragOver ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-400 hover:bg-slate-50"}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-blue-600 text-sm">
                <div className="spinner w-4 h-4" />
                <span>Uploading…</span>
              </div>
            ) : (
              <>
                <svg className="mx-auto w-8 h-8 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <p className="text-sm text-slate-500">
                  <span className="text-blue-600 font-medium">Click to upload</span> or drag & drop
                </p>
                <p className="text-xs text-slate-400 mt-1">Images (JPEG, PNG, GIF, WebP) · Documents (PDF, DOC, DOCX, TXT) · Max 50 MB</p>
              </>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">{error}</p>
          )}

          {/* File grid */}
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-slate-400 py-8 text-sm">
              <div className="spinner w-4 h-4" /> Loading…
            </div>
          ) : files.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">No files uploaded yet</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {files.map((f) => {
                const isAnalyzing = analyzing.has(f.gridfs_id);
                const isSelected = selectedFile?.gridfs_id === f.gridfs_id;
                return (
                  <div
                    key={f._id}
                    className={`group relative border rounded-lg overflow-hidden bg-slate-50 transition-colors
                      ${isSelected ? "border-blue-500 ring-1 ring-blue-300" : "border-slate-100 hover:border-blue-300"}`}
                  >
                    {f.file_type === "image" ? (
                      <button
                        onClick={() => { setLightbox(f.gridfs_id); setSelectedFile(f); }}
                        className="w-full aspect-square block"
                      >
                        <img
                          src={getMediaFileUrl(f.gridfs_id)}
                          alt={f.original_name}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ) : (
                      <a
                        href={getMediaFileUrl(f.gridfs_id)}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full aspect-square flex flex-col items-center justify-center gap-2"
                      >
                        <FileIcon />
                        <span className="text-xs text-blue-600 font-medium px-2 text-center leading-tight">
                          {f.original_name}
                        </span>
                      </a>
                    )}

                    {/* Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-white text-xs truncate flex-1">{f.original_name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(f.gridfs_id); }}
                          className="text-red-400 hover:text-red-300 transition-colors shrink-0"
                          aria-label="Delete"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      {f.file_type === "image" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAnalyze(f); }}
                          disabled={isAnalyzing}
                          className="w-full text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded px-2 py-0.5 transition-colors flex items-center justify-center gap-1"
                        >
                          {isAnalyzing ? (
                            <><div className="spinner w-3 h-3" /> Analyzing…</>
                          ) : f.analysis ? "Re-analyze" : "🔬 Analyze"}
                        </button>
                      )}
                    </div>

                    {/* Analysis badge */}
                    {f.analysis && (
                      <div className="absolute top-1 right-1 bg-green-500 text-white text-xs rounded px-1 py-0.5 font-medium">
                        AI ✓
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Findings panel for selected file */}
          {selectedFile?.analysis && (
            <FindingsPanel
              findings={selectedFile.analysis.findings}
              model={selectedFile.analysis.model}
            />
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={getMediaFileUrl(lightbox)}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white"
          >
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
