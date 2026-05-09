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
 */
export async function runClustering(datasetId, algorithm, params = {}) {
  const res = await api.post("/cluster", { datasetId, algorithm, params });
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
export async function listDatasets() {
  const res = await api.get("/data");
  return res.data;
}

export default api;
