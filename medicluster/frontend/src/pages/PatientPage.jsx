import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { listPatientMedia, getMediaFileUrl, getPatientClusterHistory } from "../api/apiClient";

const TIER_BADGE = {
  Low:      "bg-emerald-100 text-emerald-800 border border-emerald-200",
  Moderate: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  High:     "bg-orange-100 text-orange-800 border border-orange-200",
  Critical: "bg-red-100 text-red-800 border border-red-200",
  Noise:    "bg-slate-100 text-slate-600 border border-slate-200",
};

function tierBadgeClass(tier) {
  return TIER_BADGE[tier] ?? TIER_BADGE.Noise;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function PatientSearch({ initialValue, onSearch }) {
  const [value, setValue] = useState(initialValue || "");
  function handleSubmit(e) {
    e.preventDefault();
    const id = value.trim();
    if (id) onSearch(id);
  }
  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter patient ID…"
        className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
      />
      <button type="submit" className="btn-primary text-sm py-1.5 px-4">
        View Patient
      </button>
    </form>
  );
}

function MediaCard({ file }) {
  const isImage = file.contentType?.startsWith("image/");
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {isImage ? (
        <img
          src={getMediaFileUrl(file.fileId)}
          alt={file.filename}
          className="w-full h-32 object-cover bg-slate-100"
          onError={(e) => { e.target.style.display = "none"; }}
        />
      ) : (
        <div className="w-full h-32 bg-slate-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      )}
      <div className="p-2">
        <p className="text-xs font-mono text-slate-600 truncate">{file.filename}</p>
        <p className="text-xs text-slate-400">{formatDate(file.uploadedAt)}</p>
        <a
          href={getMediaFileUrl(file.fileId)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:underline"
        >
          View
        </a>
      </div>
    </div>
  );
}

function ClusterHistoryTable({ history }) {
  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        Not found in any clustering run.
      </div>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-100">
          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Algorithm</th>
          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Risk Tier</th>
          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cluster ID</th>
          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
        </tr>
      </thead>
      <tbody>
        {history.map((row, i) => (
          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
            <td className="py-2 px-3 font-mono text-slate-700 uppercase text-xs">{row.algorithm}</td>
            <td className="py-2 px-3">
              {row.risk_tier ? (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tierBadgeClass(row.risk_tier)}`}>
                  {row.risk_tier}
                </span>
              ) : <span className="text-slate-300">—</span>}
            </td>
            <td className="py-2 px-3 font-mono text-slate-600">
              {row.cluster_id !== null ? `Cluster ${row.cluster_id}` : "—"}
            </td>
            <td className="py-2 px-3 text-slate-400 text-xs">{formatDate(row.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function PatientPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();

  const [media, setMedia] = useState([]);
  const [clusterHistory, setClusterHistory] = useState([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [loadingCluster, setLoadingCluster] = useState(false);

  const loadPatient = useCallback((id) => {
    if (!id) return;
    setLoadingMedia(true);
    setLoadingCluster(true);
    setMedia([]);
    setClusterHistory([]);

    listPatientMedia(id)
      .then(setMedia)
      .catch(() => setMedia([]))
      .finally(() => setLoadingMedia(false));

    getPatientClusterHistory(id)
      .then(setClusterHistory)
      .catch(() => setClusterHistory([]))
      .finally(() => setLoadingCluster(false));
  }, []);

  useEffect(() => {
    if (patientId) loadPatient(patientId);
  }, [patientId, loadPatient]);

  function handleSearch(id) {
    navigate(`/patient/${id}`);
  }

  const mostRecentCluster = clusterHistory[0];
  const overallRisk = mostRecentCluster?.risk_tier ?? null;

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 p-6">
      <div className="max-w-screen-xl mx-auto space-y-6">

        {/* Search bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold text-slate-900">Patient Overview</h1>
          <PatientSearch initialValue={patientId} onSearch={handleSearch} />
        </div>

        {!patientId ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium">Enter a patient ID above to view their profile.</p>
          </div>
        ) : (
          <>
            {/* Patient header */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-center gap-6 flex-wrap">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
                <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-2xl font-bold text-slate-900 truncate">{patientId}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {overallRisk ? (
                    <span className={`text-sm font-semibold px-3 py-1 rounded-full ${tierBadgeClass(overallRisk)}`}>
                      {overallRisk} Risk
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400">Unanalyzed</span>
                  )}
                  {mostRecentCluster && (
                    <span className="text-xs text-slate-400">
                      Last clustered {formatDate(mostRecentCluster.createdAt)}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-slate-400">{media.length} image{media.length !== 1 ? "s" : ""} uploaded</p>
                <p className="text-xs text-slate-400">{clusterHistory.length} clustering run{clusterHistory.length !== 1 ? "s" : ""}</p>
              </div>
            </div>

            {/* Imaging section */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-700 mb-4">Uploaded Images &amp; Documents</p>
              {loadingMedia ? (
                <p className="text-sm text-slate-400">Loading…</p>
              ) : media.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No images uploaded for this patient.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {media.map((file) => (
                    <MediaCard key={file.fileId} file={file} />
                  ))}
                </div>
              )}
            </div>

            {/* Clustering history section */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-700 mb-4">Clustering History</p>
              {loadingCluster ? (
                <p className="text-sm text-slate-400">Loading…</p>
              ) : (
                <ClusterHistoryTable history={clusterHistory} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
