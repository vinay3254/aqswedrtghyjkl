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

export default api;
