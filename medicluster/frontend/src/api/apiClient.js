import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  timeout: 180_000, // 3 minutes for large clustering runs
  headers: { "Content-Type": "application/json" },
});

/**
 * Upload a CSV file and return { datasetId, featureNames, rowCount, preview }
 */
export async function uploadDataset(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post("/data/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

/**
 * Run clustering on a stored dataset.
 * @param {string} datasetId
 * @param {string} algorithm  kmeans | dbscan | hierarchical | gmm | all
 * @param {object} params     algorithm-specific params
 * @param {Array<object>} data optional inline rows for sample/offline datasets
 */
export async function runClustering(datasetId, algorithm, params = {}, data) {
  const body = { datasetId, algorithm, params };
  if (Array.isArray(data)) body.data = data;
  const res = await api.post("/cluster", body);
  return res.data;
}

/**
 * Get a previously saved cluster result by ID.
 */
export async function getClusterResult(id) {
  const res = await api.get(`/cluster/${id}`);
  return res.data;
}

/**
 * Get all clustering runs for a dataset.
 */
export async function getHistory(datasetId) {
  const res = await api.get(`/cluster/history/${datasetId}`);
  return res.data;
}

/**
 * List all stored datasets.
 */
export async function listDatasets({ page = 1, limit = 20 } = {}) {
  const res = await api.get("/data", { params: { page, limit } });
  return res.data;
}

/**
 * Upload a media file (image or document) for a patient.
 */
export async function uploadPatientMedia(patientId, file) {
  const form = new FormData();
  form.append("file", file);
  form.append("patient_id", patientId);
  const res = await api.post("/media/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

/**
 * List all media files for a patient.
 */
export async function listPatientMedia(patientId) {
  const res = await api.get(`/media/${patientId}`);
  return res.data;
}

/**
 * Delete a media file by its GridFS file ID.
 */
export async function deletePatientMedia(fileId) {
  const res = await api.delete(`/media/file/${fileId}`);
  return res.data;
}

/**
 * Returns the URL to stream/view a media file inline.
 */
export function getMediaFileUrl(fileId) {
  return `/api/media/file/${fileId}`;
}

/**
 * Run deep learning analysis on an uploaded image (CT scan / chest X-ray).
 * Returns { findings: [{label, confidence}], model, model_label, analyzedAt }
 */
export async function analyzePatientMedia(fileId, modelName = "densenet121-res224-all") {
  const res = await api.post(`/media/analyze/${fileId}`, { model_name: modelName }, { timeout: 120_000 });
  return res.data;
}

/**
 * Request an AI plain-English explanation for a set of findings.
 * Returns { explanation: string | null, error?: string }
 */
export async function explainFindings(fileId, findings, modelName = "densenet121-res224-chex") {
  const res = await api.post(
    `/media/explain/${fileId}`,
    { findings, model_name: modelName },
    { timeout: 30_000 }
  );
  return res.data;
}

/**
 * List available AI models from the ML engine.
 */
export async function listModels() {
  const res = await api.get("/media/models");
  return res.data;
}

/**
 * List all saved ClusterResults (id, algorithm, createdAt, riskDistribution).
 */
export async function listClusterResults() {
  const res = await api.get("/cluster/results");
  return res.data;
}

/**
 * Predict risk tier for new patient vitals against a saved cluster result.
 * @param {string} resultId  MongoDB ObjectId of the ClusterResult
 * @param {object} vitals    { age, bmi, glucose, ... }
 */
export async function predictRisk(resultId, vitals) {
  const res = await api.post("/cluster/predict", { resultId, vitals });
  return res.data;
}

/**
 * Get clustering history for a specific patient (up to 5 most recent results).
 * Returns [{ resultId, algorithm, createdAt, cluster_id, risk_tier, pca_x, pca_y }]
 */
export async function getPatientClusterHistory(patientId) {
  const res = await api.get(`/cluster/patient/${encodeURIComponent(patientId)}`);
  return res.data;
}

// ── Medication Reminders ──────────────────────────────────────────────────────

/** List all medication reminders for a patient. */
export async function listReminders(patientId) {
  const res = await api.get(`/reminders/${encodeURIComponent(patientId)}`);
  return res.data;
}

/** Create a new medication reminder. */
export async function createReminder(data) {
  const res = await api.post("/reminders", data);
  return res.data;
}

/** Toggle active state or update fields on a reminder. */
export async function updateReminder(id, patch) {
  const res = await api.patch(`/reminders/${id}`, patch);
  return res.data;
}

/** Delete a reminder permanently. */
export async function deleteReminder(id) {
  const res = await api.delete(`/reminders/${id}`);
  return res.data;
}

// ── ARIA Ambulance Dispatch ───────────────────────────────────────────────────

/** Seed demo ambulances and hospitals (call once). */
export async function seedDispatch() {
  const res = await api.post("/dispatch/seed");
  return res.data;
}

/** List all ambulances with current status. */
export async function listAmbulances() {
  const res = await api.get("/dispatch/ambulances");
  return res.data;
}

/** Update ambulance status (available | en_route | at_scene). */
export async function updateAmbulanceStatus(ambulanceId, status) {
  const res = await api.patch(`/dispatch/ambulances/${ambulanceId}`, { status });
  return res.data;
}

/** List all hospitals with bed availability. */
export async function listHospitals() {
  const res = await api.get("/dispatch/hospitals");
  return res.data;
}

/** Update hospital bed count. */
export async function updateHospitalBeds(hospitalId, available_beds) {
  const res = await api.patch(`/dispatch/hospitals/${hospitalId}`, { available_beds });
  return res.data;
}

/** Submit emergency to ARIA and get dispatch decision. */
export async function dispatchEmergency(data) {
  const res = await api.post("/dispatch/emergency", data, { timeout: 30_000 });
  return res.data;
}

/** Get recent dispatch history. */
export async function getDispatchHistory() {
  const res = await api.get("/dispatch/history");
  return res.data;
}

/** Update dispatch status (resolved | cancelled). */
export async function updateDispatchStatus(dispatchId, status) {
  const res = await api.patch(`/dispatch/history/${dispatchId}/status`, { status });
  return res.data;
}

// ── Patient Triage (MCI board) ────────────────────────────────────────────────

/** Get all patients for a dispatch incident. */
export async function getIncidentPatients(incidentId) {
  const res = await api.get(`/triage/incidents/${encodeURIComponent(incidentId)}`);
  return res.data;
}

/** Add a patient to an incident (with optional vitals). */
export async function addIncidentPatient(incidentId, data) {
  const res = await api.post(`/triage/incidents/${encodeURIComponent(incidentId)}/patients`, data);
  return res.data;
}

/** Update patient allocation, transport status, or triage category. */
export async function updatePatient(patientId, patch) {
  const res = await api.patch(`/triage/patients/${patientId}`, patch);
  return res.data;
}

/** Append vitals reading + re-score triage. */
export async function addPatientVitals(patientId, vitals) {
  const res = await api.post(`/triage/patients/${patientId}/vitals`, vitals);
  return res.data;
}

/** Stateless triage score from vitals (no DB write). */
export async function scoreTriage(vitals, age, conditionText) {
  const res = await api.post("/triage/score", { vitals, age, condition_text: conditionText });
  return res.data;
}

/** Voice/text-to-triage: Claude extracts vitals + category from free text. */
export async function voiceToTriage(text, incidentId) {
  const res = await api.post("/triage/voice", { text, incidentId }, { timeout: 30_000 });
  return res.data;
}

/** Suggest best hospital for a patient given triage category + pathway flags. */
export async function allocateHospital(triage_category, pathway_flags, exclude_hospital_ids) {
  const res = await api.post("/triage/allocate", { triage_category, pathway_flags, exclude_hospital_ids });
  return res.data;
}

export default api;
