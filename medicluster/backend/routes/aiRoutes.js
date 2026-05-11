/**
 * backend/routes/aiRoutes.js
 * AI-assisted cohort insights and medication reminder extraction.
 */

const express = require("express");

const router = express.Router();

const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
const RISK_ORDER = { Critical: 4, High: 3, Moderate: 2, Low: 1, Noise: 0, Unknown: 0 };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function aiConfigured() {
  const key = process.env.ANTHROPIC_API_KEY;
  return Boolean(key && !key.startsWith("sk-ant-placeholder") && key.length > 20);
}

function extractJson(raw) {
  const text = String(raw || "").trim();
  const match = text.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : text);
}

function clampString(value, fallback = "", max = 300) {
  const text = typeof value === "string" ? value.trim() : fallback;
  return text.slice(0, max);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeRiskDistribution(result) {
  const dist = result.riskDistribution || result.risk_distribution || {};
  return {
    Low: Number(dist.Low || 0),
    Moderate: Number(dist.Moderate || 0),
    High: Number(dist.High || 0),
    Critical: Number(dist.Critical || 0),
    Noise: Number(dist.Noise || 0),
    Unknown: Number(dist.Unknown || 0),
  };
}

function normalizeClusterProfiles(result) {
  const profiles = result.clusterProfiles || result.cluster_profiles || [];
  return asArray(profiles).map((profile) => ({
    cluster_id: asNumber(profile.cluster_id),
    risk_tier: clampString(profile.risk_tier || "Unknown", "Unknown", 40),
    size: Number(profile.size || 0),
    centroid_features: profile.centroid_features || profile.centroidFeatures || {},
  }));
}

function normalizePatients(result) {
  return asArray(result.patients).map((patient) => ({
    patient_id: clampString(patient.patient_id || patient.id || "Unknown", "Unknown", 80),
    risk_tier: clampString(patient.risk_tier || "Unknown", "Unknown", 40),
    cluster_id: asNumber(patient.cluster_id),
    age: asNumber(patient.age),
    bmi: asNumber(patient.bmi),
    systolic_bp: asNumber(patient.systolic_bp),
    diastolic_bp: asNumber(patient.diastolic_bp),
    glucose: asNumber(patient.glucose),
    hba1c: asNumber(patient.hba1c),
    cholesterol: asNumber(patient.cholesterol),
    ldl: asNumber(patient.ldl),
    triglycerides: asNumber(patient.triglycerides),
    spo2: asNumber(patient.spo2),
    num_medications: asNumber(patient.num_medications),
  }));
}

function compactClusterContext(input) {
  const result = input.result || input;
  const patients = normalizePatients(result);
  const severePatients = patients
    .filter((p) => ["Critical", "High"].includes(p.risk_tier))
    .sort((a, b) => (RISK_ORDER[b.risk_tier] || 0) - (RISK_ORDER[a.risk_tier] || 0))
    .slice(0, 40);

  return {
    algorithm: clampString(result.algorithm || "unknown", "unknown", 80),
    metrics: result.metrics || {},
    risk_distribution: normalizeRiskDistribution(result),
    cluster_profiles: normalizeClusterProfiles(result).slice(0, 12),
    feature_names: asArray(result.featureNames || result.feature_names).slice(0, 30),
    warnings: asArray(result.warnings).slice(0, 10),
    patient_count: patients.length,
    severe_patient_sample: severePatients,
  };
}

function featureSpread(profiles) {
  const valuesByFeature = new Map();
  for (const profile of profiles) {
    for (const [feature, raw] of Object.entries(profile.centroid_features || {})) {
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;
      if (!valuesByFeature.has(feature)) valuesByFeature.set(feature, []);
      valuesByFeature.get(feature).push(value);
    }
  }

  return [...valuesByFeature.entries()]
    .map(([feature, values]) => ({
      feature,
      spread: Math.max(...values) - Math.min(...values),
      high: Math.max(...values),
      low: Math.min(...values),
    }))
    .filter((item) => Number.isFinite(item.spread))
    .sort((a, b) => b.spread - a.spread)
    .slice(0, 5);
}

function pathwayForFeature(feature) {
  const f = feature.toLowerCase();
  if (f.includes("glucose") || f.includes("hba1c")) return "Diabetes review";
  if (f.includes("bp") || f.includes("pressure")) return "Blood pressure management";
  if (f.includes("cholesterol") || f.includes("ldl") || f.includes("triglyceride")) return "Lipid management";
  if (f.includes("spo2")) return "Respiratory review";
  if (f.includes("bmi")) return "Weight and nutrition counseling";
  if (f.includes("medication")) return "Medication reconciliation";
  return "Clinical follow-up";
}

function buildLocalClusterInsights(context, source = "local") {
  const riskEntries = Object.entries(context.risk_distribution)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  const topRisk = riskEntries[0] || ["Unknown", 0];
  const highAcuity = (context.risk_distribution.Critical || 0) + (context.risk_distribution.High || 0);
  const drivers = featureSpread(context.cluster_profiles);

  const clusterActions = [...context.cluster_profiles]
    .sort((a, b) => (RISK_ORDER[b.risk_tier] || 0) - (RISK_ORDER[a.risk_tier] || 0))
    .slice(0, 6)
    .map((profile) => {
      const driver = featureSpread([profile])[0]?.feature || drivers[0]?.feature || "risk markers";
      const priority = profile.risk_tier === "Critical" ? "Immediate" :
        profile.risk_tier === "High" ? "High" :
        profile.risk_tier === "Moderate" ? "Routine" : "Monitor";
      return {
        cluster_id: profile.cluster_id,
        risk_tier: profile.risk_tier,
        priority,
        action: `${priority} review for ${profile.size || 0} patient(s); prioritize ${pathwayForFeature(driver).toLowerCase()}.`,
      };
    });

  const watchlist = context.severe_patient_sample.slice(0, 8).map((patient) => {
    const reasons = [];
    if (patient.glucose >= 180 || patient.hba1c >= 8) reasons.push("elevated glucose markers");
    if (patient.systolic_bp >= 150 || patient.diastolic_bp >= 95) reasons.push("elevated blood pressure");
    if (patient.spo2 !== null && patient.spo2 < 94) reasons.push("low oxygen saturation");
    if (patient.num_medications >= 6) reasons.push("polypharmacy signal");
    return {
      patient_id: patient.patient_id,
      risk_tier: patient.risk_tier,
      reason: reasons.length ? reasons.join(", ") : `${patient.risk_tier} tier in cluster ${patient.cluster_id}`,
    };
  });

  return {
    source,
    generatedAt: new Date().toISOString(),
    headline: `${highAcuity} high-acuity patient(s); ${topRisk[0]} is the largest risk tier.`,
    cohort_summary: `The ${context.algorithm} run contains ${context.patient_count} patient(s). ${topRisk[1]} patient(s) fall in the ${topRisk[0]} tier, with ${highAcuity} marked High or Critical.`,
    risk_drivers: drivers.map((driver) => ({
      feature: driver.feature,
      signal: `${driver.low.toFixed(1)} to ${driver.high.toFixed(1)} across cluster centroids`,
      rationale: `${driver.feature} varies strongly between clusters and is likely contributing to separation.`,
    })),
    cluster_actions: clusterActions,
    patient_watchlist: watchlist,
    care_pathways: [...new Set(drivers.map((driver) => pathwayForFeature(driver.feature)))].slice(0, 5),
    safety_note: "Decision support only. Confirm findings with a licensed clinician before changing care.",
  };
}

function normalizeClusterInsights(parsed, fallback, source = "ai") {
  return {
    source,
    generatedAt: new Date().toISOString(),
    headline: clampString(parsed.headline, fallback.headline, 180),
    cohort_summary: clampString(parsed.cohort_summary, fallback.cohort_summary, 700),
    risk_drivers: asArray(parsed.risk_drivers).slice(0, 6).map((item, index) => ({
      feature: clampString(item.feature, fallback.risk_drivers[index]?.feature || "risk marker", 80),
      signal: clampString(item.signal, fallback.risk_drivers[index]?.signal || "", 180),
      rationale: clampString(item.rationale, fallback.risk_drivers[index]?.rationale || "", 260),
    })),
    cluster_actions: asArray(parsed.cluster_actions).slice(0, 8).map((item, index) => ({
      cluster_id: asNumber(item.cluster_id),
      risk_tier: clampString(item.risk_tier, fallback.cluster_actions[index]?.risk_tier || "Unknown", 40),
      priority: clampString(item.priority, fallback.cluster_actions[index]?.priority || "Review", 40),
      action: clampString(item.action, fallback.cluster_actions[index]?.action || "", 300),
    })),
    patient_watchlist: asArray(parsed.patient_watchlist).slice(0, 8).map((item, index) => ({
      patient_id: clampString(item.patient_id, fallback.patient_watchlist[index]?.patient_id || "Unknown", 80),
      risk_tier: clampString(item.risk_tier, fallback.patient_watchlist[index]?.risk_tier || "Unknown", 40),
      reason: clampString(item.reason, fallback.patient_watchlist[index]?.reason || "", 220),
    })),
    care_pathways: asArray(parsed.care_pathways).slice(0, 6).map((item) => clampString(item, "", 120)).filter(Boolean),
    safety_note: clampString(parsed.safety_note, fallback.safety_note, 220),
  };
}

async function callAnthropic(prompt, system, maxTokens = 1200) {
  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: AI_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  return message.content?.[0]?.text || "";
}

router.post("/cluster-insights", async (req, res) => {
  const context = compactClusterContext(req.body || {});
  if (!context.patient_count && context.cluster_profiles.length === 0) {
    return res.status(400).json({ error: "Cluster result data is required" });
  }

  const fallback = buildLocalClusterInsights(context);
  if (!aiConfigured()) return res.json(fallback);

  const system = "You are a clinical analytics assistant. Provide concise decision-support summaries. Do not diagnose. Return JSON only.";
  const prompt = `Analyze this patient clustering result and return JSON only with:
{
  "headline": "one sentence",
  "cohort_summary": "3-5 concise sentences",
  "risk_drivers": [{"feature":"", "signal":"", "rationale":""}],
  "cluster_actions": [{"cluster_id":0, "risk_tier":"", "priority":"Immediate|High|Routine|Monitor", "action":""}],
  "patient_watchlist": [{"patient_id":"", "risk_tier":"", "reason":""}],
  "care_pathways": ["short pathway names"],
  "safety_note": "brief safety note"
}

Use conservative clinical language, mention patterns not diagnoses, and prioritize practical follow-up actions.

Cluster context:
${JSON.stringify(context, null, 2)}`;

  try {
    const raw = await callAnthropic(prompt, system, 1400);
    const parsed = extractJson(raw);
    return res.json(normalizeClusterInsights(parsed, fallback, "ai"));
  } catch (err) {
    console.error("AI cluster insight error:", err.message);
    return res.json({ ...fallback, error: "AI insight temporarily unavailable; showing local decision support." });
  }
});

function normalizeTime(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function inferTimes(text) {
  const lower = text.toLowerCase();
  const explicit = [...text.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)]
    .map((m) => normalizeTime(`${m[1]}:${m[2]}`))
    .filter(Boolean);
  if (explicit.length) return [...new Set(explicit)];
  if (/\b(qid|four times|4 times)\b/.test(lower)) return ["08:00", "12:00", "16:00", "20:00"];
  if (/\b(tid|three times|thrice|3 times)\b/.test(lower)) return ["08:00", "14:00", "20:00"];
  if (/\b(bid|twice|two times|2 times)\b/.test(lower)) return ["08:00", "20:00"];
  if (/\b(night|bedtime|hs|qhs)\b/.test(lower)) return ["21:00"];
  if (/\b(noon|lunch|afternoon)\b/.test(lower)) return ["13:00"];
  if (/\b(evening|dinner)\b/.test(lower)) return ["18:00"];
  return ["08:00"];
}

function inferFrequency(text) {
  const lower = text.toLowerCase();
  if (/\b(prn|as needed|when needed|if needed)\b/.test(lower)) return "as-needed";
  if (/\b(weekly|every week|once a week)\b/.test(lower)) return "weekly";
  return "daily";
}

function inferDays(text) {
  const lower = text.toLowerCase();
  const map = {
    Mon: /\b(mon|monday)\b/,
    Tue: /\b(tue|tues|tuesday)\b/,
    Wed: /\b(wed|wednesday)\b/,
    Thu: /\b(thu|thur|thurs|thursday)\b/,
    Fri: /\b(fri|friday)\b/,
    Sat: /\b(sat|saturday)\b/,
    Sun: /\b(sun|sunday)\b/,
  };
  return DAYS.filter((day) => map[day].test(lower));
}

function localMedicationPlan(text, source = "local") {
  const lines = text
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter((line) => line.length > 2)
    .slice(0, 8);

  const reminders = lines.map((line) => {
    const dosageMatch = line.match(/\b(\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|units?|tabs?|tablets?|caps?|capsules?))\b/i);
    const dosage = dosageMatch?.[1] || "";
    const beforeDose = dosageMatch ? line.slice(0, dosageMatch.index).trim() : line;
    const medicationName = beforeDose
      .replace(/^take\s+/i, "")
      .replace(/^(tab|tablet|cap|capsule)\s+/i, "")
      .replace(/[-:,.]+$/g, "")
      .trim()
      .slice(0, 80) || line.split(/\s+/).slice(0, 3).join(" ");
    const frequency = inferFrequency(line);
    return {
      medicationName,
      dosage,
      times: inferTimes(line),
      frequency,
      days: frequency === "weekly" ? inferDays(line) : [],
      notes: line,
      confidence: dosage || /\b(daily|bid|tid|qid|morning|night|weekly|prn)\b/i.test(line) ? 0.72 : 0.48,
    };
  });

  return {
    source,
    generatedAt: new Date().toISOString(),
    reminders,
    counseling: [
      "Review the extracted schedule before saving.",
      "Confirm unclear dose timing with the prescriber or pharmacist.",
    ],
    warnings: reminders.length === 0 ? ["No medications were detected in the text."] : [],
  };
}

function normalizeMedicationPlan(parsed, fallback, source = "ai") {
  const reminders = asArray(parsed.reminders).slice(0, 8).map((item, index) => {
    const fallbackItem = fallback.reminders[index] || {};
    const frequency = ["daily", "weekly", "as-needed"].includes(item.frequency)
      ? item.frequency
      : (fallbackItem.frequency || "daily");
    const times = asArray(item.times).map(normalizeTime).filter(Boolean);
    return {
      medicationName: clampString(item.medicationName, fallbackItem.medicationName || "Medication", 80),
      dosage: clampString(item.dosage, fallbackItem.dosage || "", 80),
      times: times.length ? [...new Set(times)] : (fallbackItem.times || ["08:00"]),
      frequency,
      days: frequency === "weekly"
        ? asArray(item.days).filter((day) => DAYS.includes(day))
        : [],
      notes: clampString(item.notes, fallbackItem.notes || "", 220),
      confidence: Math.max(0, Math.min(1, Number(item.confidence ?? fallbackItem.confidence ?? 0.7))),
    };
  });

  return {
    source,
    generatedAt: new Date().toISOString(),
    reminders,
    counseling: asArray(parsed.counseling).slice(0, 5).map((item) => clampString(item, "", 180)).filter(Boolean),
    warnings: asArray(parsed.warnings).slice(0, 5).map((item) => clampString(item, "", 180)).filter(Boolean),
  };
}

router.post("/medication-plan", async (req, res) => {
  const { text, patientId, currentReminders = [] } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Prescription or medication text is required" });
  }

  const fallback = localMedicationPlan(text);
  if (!aiConfigured()) return res.json(fallback);

  const system = "You are a medication reminder extraction assistant. Extract structured reminder schedules from clinician text. Return JSON only.";
  const prompt = `Extract medication reminders from this prescription text.

Rules:
- Return JSON only.
- Use 24-hour HH:MM times.
- frequency must be one of: daily, weekly, as-needed.
- days must use Mon, Tue, Wed, Thu, Fri, Sat, Sun and only for weekly reminders.
- Do not invent medications that are not in the text.
- Include a confidence score from 0 to 1 for each reminder.
- Put uncertainties in warnings.

Return:
{
  "reminders": [{
    "medicationName": "",
    "dosage": "",
    "times": ["08:00"],
    "frequency": "daily",
    "days": [],
    "notes": "",
    "confidence": 0.0
  }],
  "counseling": ["short review points"],
  "warnings": ["short warnings"]
}

Patient ID: ${clampString(patientId, "unknown", 80)}
Existing reminders: ${JSON.stringify(asArray(currentReminders).slice(0, 12))}
Prescription text:
${text.trim()}`;

  try {
    const raw = await callAnthropic(prompt, system, 1000);
    const parsed = extractJson(raw);
    return res.json(normalizeMedicationPlan(parsed, fallback, "ai"));
  } catch (err) {
    console.error("AI medication plan error:", err.message);
    return res.json({ ...fallback, error: "AI extraction temporarily unavailable; showing local parser output." });
  }
});

module.exports = router;
