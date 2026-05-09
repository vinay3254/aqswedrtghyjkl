const COMMON_TEXT_FIELDS = new Set(["patient_id", "gender"]);

const COMMON_NUMERIC_FIELDS = new Set([
  "age",
  "bmi",
  "systolic_bp",
  "diastolic_bp",
  "glucose",
  "hba1c",
  "cholesterol",
  "hdl",
  "ldl",
  "triglycerides",
  "heart_rate",
  "spo2",
  "num_medications",
]);

const RESULT_NUMERIC_FIELDS = new Set([
  "cluster_id",
  "pca_x",
  "pca_y",
]);

const RESULT_TEXT_FIELDS = new Set(["risk_tier"]);

function toPlainMap(value) {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value.entries());
  return value;
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizePatientRow(row = {}) {
  const normalized = {
    numericFeatures: {},
    textFeatures: {},
  };

  for (const [key, value] of Object.entries(row)) {
    if (!hasValue(value)) continue;

    if (COMMON_TEXT_FIELDS.has(key)) {
      normalized[key] = String(value);
      continue;
    }

    if (COMMON_NUMERIC_FIELDS.has(key)) {
      const number = toFiniteNumber(value);
      if (number === null) normalized.textFeatures[`${key}_raw`] = String(value);
      else normalized[key] = number;
      continue;
    }

    const number = toFiniteNumber(value);
    if (number === null) normalized.textFeatures[key] = String(value);
    else normalized.numericFeatures[key] = number;
  }

  return normalized;
}

function normalizeResultPatient(row = {}) {
  const patientFields = { ...row };
  for (const field of RESULT_NUMERIC_FIELDS) delete patientFields[field];
  for (const field of RESULT_TEXT_FIELDS) delete patientFields[field];
  delete patientFields.gmm_probabilities;

  const normalized = normalizePatientRow(patientFields);

  for (const field of RESULT_NUMERIC_FIELDS) {
    if (!hasValue(row[field])) continue;
    const number = toFiniteNumber(row[field]);
    if (number !== null) normalized[field] = number;
  }

  for (const field of RESULT_TEXT_FIELDS) {
    if (hasValue(row[field])) normalized[field] = String(row[field]);
  }

  if (Array.isArray(row.gmm_probabilities)) {
    normalized.gmm_probabilities = row.gmm_probabilities
      .map(toFiniteNumber)
      .filter((value) => value !== null);
  }

  return normalized;
}

function denormalizePatientRow(row = {}) {
  const flat = {};

  for (const field of COMMON_TEXT_FIELDS) {
    if (hasValue(row[field])) flat[field] = row[field];
  }

  for (const field of COMMON_NUMERIC_FIELDS) {
    if (hasValue(row[field])) flat[field] = row[field];
  }

  for (const field of RESULT_NUMERIC_FIELDS) {
    if (hasValue(row[field])) flat[field] = row[field];
  }

  for (const field of RESULT_TEXT_FIELDS) {
    if (hasValue(row[field])) flat[field] = row[field];
  }

  if (Array.isArray(row.gmm_probabilities)) {
    flat.gmm_probabilities = row.gmm_probabilities;
  }

  return {
    ...flat,
    ...toPlainMap(row.numericFeatures),
    ...toPlainMap(row.textFeatures),
  };
}

function normalizePatientRows(rows = []) {
  return rows.map(normalizePatientRow);
}

function normalizeResultPatients(rows = []) {
  return rows.map(normalizeResultPatient);
}

function denormalizePatientRows(rows = []) {
  return rows.map(denormalizePatientRow);
}

function normalizeClusterProfiles(profiles = []) {
  return profiles.map((profile) => ({
    cluster_id: profile.cluster_id,
    risk_tier: profile.risk_tier,
    size: profile.size,
    centroidFeatures: profile.centroid_features || profile.centroidFeatures || {},
  }));
}

function denormalizeClusterProfiles(profiles = []) {
  return profiles.map((profile) => ({
    cluster_id: profile.cluster_id,
    risk_tier: profile.risk_tier,
    size: profile.size,
    centroid_features: toPlainMap(profile.centroidFeatures),
  }));
}

module.exports = {
  normalizePatientRows,
  normalizeResultPatients,
  denormalizePatientRows,
  normalizeClusterProfiles,
  denormalizeClusterProfiles,
};
