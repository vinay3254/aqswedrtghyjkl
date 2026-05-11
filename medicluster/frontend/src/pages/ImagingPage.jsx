import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  analyzePatientMedia, deletePatientMedia, getMediaFileUrl,
  listModels, listPatientMedia, uploadPatientMedia, explainFindings,
  aiAssistant,
} from "../api/apiClient";
import { exportToPdf } from "../utils/exportPdf";

const ACCEPT = "image/jpeg,image/png,image/gif,image/webp,.dcm,.dicom";

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const SEVERITY_STYLES = {
  high:     { border: "border-red-300",    badge: "bg-red-100 text-red-700",     title: "text-red-700"     },
  moderate: { border: "border-amber-300",  badge: "bg-amber-100 text-amber-700", title: "text-amber-700"   },
  low:      { border: "border-slate-200",  badge: "bg-slate-100 text-slate-500", title: "text-slate-600"   },
};

function DiseaseCard({ finding, allFindings, fileId, modelName, isFirst }) {
  const [expanded, setExpanded]         = useState(isFirst);
  const [explanation, setExplanation]   = useState(null);
  const [loadingAI, setLoadingAI]       = useState(false);
  const [aiError, setAiError]           = useState(null);

  const style     = SEVERITY_STYLES[finding.severity] ?? SEVERITY_STYLES.low;
  const pct       = Math.round((finding.confidence ?? 0) * 100);

  const handleAIExplain = async () => {
    if (explanation) return;
    setLoadingAI(true);
    setAiError(null);
    try {
      const data = await explainFindings(fileId, allFindings, modelName);
      if (data.explanation) {
        setExplanation(data.explanation);
      } else {
        setAiError(data.error ?? "Explanation unavailable");
      }
    } catch {
      setAiError("AI explanation temporarily unavailable");
    } finally {
      setLoadingAI(false);
    }
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${style.border}`}>
      <button
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`font-semibold text-sm truncate ${style.title}`}>{finding.label}</span>
          <span className="text-xs text-slate-400 font-mono shrink-0">{pct}%</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.badge}`}>
            {finding.severity?.toUpperCase()}
          </span>
          <svg
            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-100">
          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="bg-amber-50 rounded-md p-2">
              <p className="text-xs font-bold text-amber-800 mb-1 uppercase tracking-wide">Cause</p>
              <p className="text-xs text-amber-900 leading-relaxed">{finding.cause || "—"}</p>
            </div>
            <div className="bg-blue-50 rounded-md p-2">
              <p className="text-xs font-bold text-blue-800 mb-1 uppercase tracking-wide">Medications</p>
              {(finding.medications ?? []).length > 0 ? (
                <ul className="space-y-0.5">
                  {finding.medications.map((m) => (
                    <li key={m} className="text-xs text-blue-900">• {m}</li>
                  ))}
                </ul>
              ) : <p className="text-xs text-blue-400">—</p>}
            </div>
            <div className="bg-emerald-50 rounded-md p-2">
              <p className="text-xs font-bold text-emerald-800 mb-1 uppercase tracking-wide">Prevention</p>
              {(finding.prevention ?? []).length > 0 ? (
                <ul className="space-y-0.5">
                  {finding.prevention.map((p) => (
                    <li key={p} className="text-xs text-emerald-900">• {p}</li>
                  ))}
                </ul>
              ) : <p className="text-xs text-emerald-400">—</p>}
            </div>
          </div>

          {!explanation && !aiError && (
            <button
              onClick={handleAIExplain}
              disabled={loadingAI}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md py-1.5 transition-colors disabled:opacity-60"
            >
              {loadingAI ? (
                <><div className="spinner w-3 h-3" />Generating AI explanation…</>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI Deep Explanation
                </>
              )}
            </button>
          )}

          {aiError && (
            <p className="text-xs text-slate-400 italic">{aiError}</p>
          )}

          {explanation && (
            <div className="bg-blue-50 border border-blue-100 rounded-md p-2.5">
              <p className="text-xs font-semibold text-blue-800 mb-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI Explanation
              </p>
              <p className="text-xs text-blue-900 leading-relaxed whitespace-pre-wrap">{explanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function renderMarkdown(text) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/);
    return (
      <span key={i}>
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**")
            ? <strong key={j} className="font-semibold text-slate-800">{part.slice(2, -2)}</strong>
            : part
        )}
        <br />
      </span>
    );
  });
}

function AIAssistantPanel({ img }) {
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const bottomRef                 = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(async (question = "") => {
    setLoading(true);
    setError(null);
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const data = await aiAssistant(img.gridfs_id, history, question);
      const next = [...messages];
      if (question) next.push({ role: "user", content: question });
      next.push({ role: "assistant", content: data.reply });
      setMessages(next);
      setInput("");
    } catch {
      setError("AI Assistant temporarily unavailable. Try again.");
    } finally {
      setLoading(false);
    }
  }, [img.gridfs_id, messages]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && input.trim() && !loading) {
      e.preventDefault();
      send(input.trim());
    }
  };

  return (
    <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
      <div className="flex items-center gap-1.5 mb-1">
        <svg className="w-3.5 h-3.5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span className="text-xs font-bold text-violet-700 uppercase tracking-wide">AI Assistant</span>
      </div>

      {messages.length === 0 && !loading && (
        <button
          onClick={() => send()}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Analyze with AI Assistant
        </button>
      )}

      {(messages.length > 0 || loading) && (
        <div className="bg-slate-50 rounded-lg border border-slate-100 max-h-72 overflow-y-auto p-2 space-y-2">
          {messages.map((msg, i) => (
            msg.role === "assistant" ? (
              <div key={i} className="flex gap-2">
                <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="bg-white border border-slate-100 rounded-lg px-2.5 py-2 text-xs text-slate-700 leading-relaxed flex-1 shadow-sm">
                  {renderMarkdown(msg.content)}
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-end">
                <div className="bg-violet-600 text-white rounded-lg px-2.5 py-1.5 text-xs max-w-[80%]">
                  {msg.content}
                </div>
              </div>
            )
          ))}
          {loading && (
            <div className="flex gap-2">
              <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                <div className="spinner w-2.5 h-2.5" />
              </div>
              <div className="bg-white border border-slate-100 rounded-lg px-2.5 py-2 text-xs text-slate-400 italic">
                Analyzing…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {messages.length > 0 && (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a follow-up question…"
            disabled={loading}
            className="input-field text-xs flex-1 disabled:opacity-50"
          />
          <button
            onClick={() => input.trim() && send(input.trim())}
            disabled={loading || !input.trim()}
            className="btn-primary text-xs py-1.5 px-3 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}

function ImageCard({ img, onAnalyze, onDelete, onLightbox, analyzing, selectedModel }) {
  const isDicom = img.original_name?.toLowerCase().endsWith(".dcm");
  const [showAssistant, setShowAssistant] = useState(false);

  return (
    <div className="panel flex flex-col gap-4 fade-in">
    <div className="flex flex-col sm:flex-row gap-4">
      {/* Thumbnail */}
      <div
        className="shrink-0 relative w-full sm:w-48 h-48 rounded-lg overflow-hidden bg-slate-900 cursor-zoom-in"
        onClick={() => !isDicom && onLightbox(img.gridfs_id)}
      >
        {isDicom ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <svg className="w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-blue-300 text-xs font-mono">DICOM</span>
          </div>
        ) : (
          <img
            src={getMediaFileUrl(img.gridfs_id)}
            alt={img.original_name}
            className="w-full h-full object-cover"
          />
        )}
        {img.analysis && (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs rounded px-1.5 py-0.5 font-semibold shadow">
            AI ✓
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
          <p className="text-white text-xs truncate font-medium">{img.original_name}</p>
          {img.size && <p className="text-white/60 text-xs">{formatBytes(img.size)}</p>}
        </div>
      </div>

      {/* Right: controls + findings */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => onAnalyze(img, selectedModel)}
            disabled={analyzing}
            className="btn-primary text-xs py-1.5 px-3"
          >
            {analyzing ? (
              <><div className="spinner w-3 h-3" />Analyzing…</>
            ) : img.analysis ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Re-analyze
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Run AI Analysis
              </>
            )}
          </button>
          <button
            onClick={() => onDelete(img)}
            className="text-slate-300 hover:text-red-500 transition-colors p-1"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {analyzing && (
          <p className="text-xs text-blue-600 flex items-center gap-1.5">
            <div className="spinner w-3 h-3" />
            Running model… first load takes ~10s
          </p>
        )}

        {!analyzing && !img.analysis && (
          <p className="text-xs text-slate-400">No analysis yet. Click "Run AI Analysis" above.</p>
        )}

        {img.analysis && (
          <div className="space-y-2 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">AI Findings</p>
              <span className="text-xs font-mono text-slate-300 truncate max-w-[160px]" title={img.analysis.model_label || img.analysis.model}>
                {img.analysis.model_label || img.analysis.model}
              </span>
            </div>

            {img.analysis.scan_warning && (
              <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                <svg className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-amber-700">{img.analysis.scan_warning}</p>
              </div>
            )}

            {img.analysis.findings?.length > 0 ? (
              <div className="space-y-1.5">
                {img.analysis.findings.map((f, i) => (
                  <DiseaseCard
                    key={f.label}
                    finding={f}
                    allFindings={img.analysis.findings}
                    fileId={img.gridfs_id}
                    modelName={selectedModel}
                    isFirst={i === 0}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                No significant findings detected above threshold
              </p>
            )}

            <p className="text-xs text-slate-300 pt-1 border-t border-slate-100">
              ⚠️ Educational purposes only — not a clinical diagnosis. Consult a qualified physician.
            </p>
          </div>
        )}
      </div>
    </div>

    {!isDicom && (
      <div>
        <button
          onClick={() => setShowAssistant((v) => !v)}
          className={`w-full flex items-center justify-center gap-2 py-1.5 px-3 text-xs font-semibold rounded-lg border transition-colors ${
            showAssistant
              ? "bg-violet-100 text-violet-700 border-violet-200"
              : "bg-slate-50 text-slate-500 hover:text-violet-700 hover:bg-violet-50 hover:border-violet-200 border-slate-200"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          {showAssistant ? "Hide AI Assistant" : "Ask AI Assistant"}
          <svg
            className={`w-3 h-3 transition-transform ${showAssistant ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showAssistant && <AIAssistantPanel img={img} />}
      </div>
    )}
  </div>
  );
}

export default function ImagingPage() {
  const [patientId, setPatientId]   = useState("");
  const [images, setImages]         = useState([]);
  const [models, setModels]         = useState([]);
  const [selectedModel, setSelectedModel] = useState("densenet121-res224-all");
  const [dragOver, setDragOver]     = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [analyzingIds, setAnalyzingIds] = useState(new Set());
  const [error, setError]           = useState(null);
  const [lightbox, setLightbox]     = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    listModels()
      .then((data) => {
        setModels(data.models ?? []);
        setSelectedModel(data.default ?? "densenet121-res224-all");
      })
      .catch(() => {});
  }, []);

  const effectivePatientId = patientId.trim() || "imaging-session";

  const BASELINE = 0.60;
  const analyzedImages = images.filter((img) => img.analysis?.findings?.length);
  const aggregateFindings = useMemo(() => {
    if (!analyzedImages.length) return [];
    const sums = {}, counts = {};
    for (const img of analyzedImages) {
      for (const f of img.analysis.findings) {
        sums[f.label]   = (sums[f.label]   || 0) + f.confidence;
        counts[f.label] = (counts[f.label] || 0) + 1;
      }
    }
    return Object.entries(sums)
      .map(([label, sum]) => ({ label, avg: sum / counts[label] }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 6);
  }, [analyzedImages]);

  const handleFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList);
    if (!files.length) return;
    const invalid = files.filter(
      (f) => !f.type.startsWith("image/") && !f.name.toLowerCase().endsWith(".dcm") && !f.name.toLowerCase().endsWith(".dicom")
    );
    if (invalid.length) { setError("Only image files and DICOM (.dcm) files are accepted."); return; }
    setError(null);
    setUploading(true);
    try {
      const results = await Promise.all(files.map((f) => uploadPatientMedia(effectivePatientId, f)));
      setImages((prev) => [...results, ...prev]);
    } catch (e) {
      setError(e?.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [effectivePatientId]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleAnalyze = useCallback(async (img, modelName) => {
    setAnalyzingIds((prev) => new Set(prev).add(img.gridfs_id));
    setError(null);
    try {
      const analysis = await analyzePatientMedia(img.gridfs_id, modelName);
      setImages((prev) => prev.map((i) => i.gridfs_id === img.gridfs_id ? { ...i, analysis } : i));
    } catch (e) {
      setError(e?.response?.data?.error || "Analysis failed. Make sure the ML engine is running.");
    } finally {
      setAnalyzingIds((prev) => { const n = new Set(prev); n.delete(img.gridfs_id); return n; });
    }
  }, []);

  const handleDelete = useCallback(async (img) => {
    try {
      await deletePatientMedia(img.gridfs_id);
      setImages((prev) => prev.filter((i) => i.gridfs_id !== img.gridfs_id));
    } catch {
      setError("Delete failed");
    }
  }, []);

  const handleLoad = useCallback(async () => {
    const pid = patientId.trim();
    if (!pid) { setError("Enter a Patient ID to load existing images."); return; }
    setError(null);
    setLoadingList(true);
    try {
      const result = await listPatientMedia(pid);
      setImages(result.filter((f) => f.file_type === "image"));
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to load images");
    } finally {
      setLoadingList(false);
    }
  }, [patientId]);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Medical Imaging</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Upload chest X-rays or DICOM files. Choose a model and run AI pathology analysis per image.
            </p>
          </div>
          {analyzedImages.length > 0 && (
            <button
              onClick={() => exportToPdf("imaging-results", "Imaging Analysis Report", "medicluster-imaging")}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-white border border-slate-200 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export PDF
            </button>
          )}
        </div>

        {/* Controls row */}
        <div className="panel flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[180px]">
            <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">Patient ID</label>
            <input
              type="text"
              value={patientId}
              onChange={(e) => { setPatientId(e.target.value); setImages([]); }}
              placeholder="e.g. P001 (optional)"
              className="input-field text-sm"
            />
          </div>

          {/* Model selector */}
          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
            <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="input-field text-sm"
            >
              {models.length === 0 && (
                <option value="densenet121-res224-all">DenseNet121 · All datasets</option>
              )}
              {models.map((m) => (
                <option key={m.id} value={m.id} title={m.desc}>{m.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleLoad}
            disabled={loadingList || !patientId.trim()}
            className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
          >
            {loadingList ? <><div className="spinner w-3 h-3" />Loading…</> : "Load existing"}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-2.5 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="hover:text-red-900 ml-4">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            dragOver ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-400 hover:bg-slate-50"
          }`}
        >
          <input ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden"
            onChange={(e) => handleFiles(e.target.files)} />
          {uploading ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="spinner w-7 h-7" />
              <p className="text-sm text-blue-600 font-medium">Uploading…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <svg className="w-10 h-10 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-slate-600">
                <span className="text-blue-600 font-medium">Click to upload</span> or drag & drop
              </p>
              <p className="text-xs text-slate-400">
                JPEG · PNG · GIF · WebP · DICOM (.dcm) · Multiple files · Max 50 MB each
              </p>
            </div>
          )}
        </div>

        {/* Summary panel */}
        {analyzedImages.length > 0 && (
          <div className="panel fade-in">
            <div className="flex items-center justify-between mb-3">
              <p className="section-label mb-0">Analysis Summary</p>
              <span className="text-xs text-slate-400">{analyzedImages.length} of {images.length} analyzed</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 mb-2">Top Findings (avg confidence)</p>
                <div className="space-y-1.5">
                  {aggregateFindings.map(({ label, avg }) => {
                    const pct = (avg * 100).toFixed(1);
                    const barWidth = Math.max(0, ((avg - BASELINE) / (1 - BASELINE)) * 100);
                    const isElevated = avg >= 0.72;
                    return (
                      <div key={label} className="space-y-0.5">
                        <div className="flex justify-between text-xs">
                          <span className={`font-medium ${isElevated ? "text-red-600" : "text-slate-500"}`}>{label}</span>
                          <span className="text-slate-400 font-mono">{pct}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1">
                          <div className={`h-1 rounded-full ${isElevated ? "bg-red-500" : "bg-slate-300"}`}
                            style={{ width: `${barWidth}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-slate-400">Breakdown</p>
                {[
                  { label: "Elevated findings (≥72%)", count: analyzedImages.filter(img => img.analysis.findings.some(f => f.confidence >= 0.72)).length, color: "text-red-600" },
                  { label: "No significant findings", count: analyzedImages.filter(img => img.analysis.findings.every(f => f.confidence < 0.72)).length, color: "text-emerald-600" },
                ].map(({ label, count, color }) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">{label}</span>
                    <span className={`font-mono font-bold ${color}`}>{count}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <span className="text-slate-400">Total images</span>
                  <span className="font-mono text-slate-600">{images.length}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Image cards */}
        {images.length > 0 && (
          <div id="imaging-results" className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              {images.length} File{images.length !== 1 ? "s" : ""}
            </p>
            {images.map((img) => (
              <ImageCard
                key={img._id}
                img={img}
                onAnalyze={handleAnalyze}
                onDelete={handleDelete}
                onLightbox={setLightbox}
                analyzing={analyzingIds.has(img.gridfs_id)}
                selectedModel={selectedModel}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6"
          onClick={() => setLightbox(null)}>
          <img
            src={getMediaFileUrl(lightbox)}
            alt="Full size"
            className="max-w-full max-h-full object-contain rounded shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
