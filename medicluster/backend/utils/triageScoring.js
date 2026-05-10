/**
 * backend/utils/triageScoring.js
 * Vitals-based triage scoring → RED / YELLOW / GREEN / BLACK
 *
 * Scoring model: modified START + vitals severity weights
 * Sources: START triage, SALT triage, NEWS2 score concepts
 */

const PATHWAY_RULES = {
  stemi:    { keywords: ["stemi", "mi", "myocardial infarction", "heart attack", "chest pain"], specialty: ["Cardiac"] },
  stroke:   { keywords: ["stroke", "cva", "tia", "facial droop", "slurred speech", "arm weakness"], specialty: ["Neuro"] },
  pediatric:{ keywords: ["child", "infant", "baby", "neonate", "toddler"], ageMax: 16, specialty: ["Pediatric"] },
  burn:     { keywords: ["burn", "fire", "scald", "chemical burn", "inhalation"], specialty: ["Burns"] },
  trauma:   { keywords: ["trauma", "crash", "accident", "gunshot", "stabbing", "fall", "mvc", "mva", "blunt", "penetrating"], specialty: ["Trauma"] },
  psychiatric: { keywords: ["psychiatric", "psych", "suicidal", "overdose", "self-harm", "mental"], specialty: [] },
  hazmat:   { keywords: ["hazmat", "chemical", "toxic", "poisoning", "radiation", "decon"], specialty: [] },
  maternity:{ keywords: ["pregnant", "labour", "labor", "obstetric", "delivery", "contractions", "ob"], specialty: [] },
  infectious:{ keywords: ["infectious", "fever", "covid", "isolation", "quarantine", "contagious"], specialty: [] },
  cardiac:  { keywords: ["cardiac arrest", "vf", "vt", "arrhythmia", "pacemaker", "afib", "af "], specialty: ["Cardiac"] },
};

/**
 * Detect pathway flags from condition text and age.
 * @param {string} conditionText
 * @param {number|null} age
 * @returns {string[]}
 */
function detectPathways(conditionText = "", age = null) {
  const text = conditionText.toLowerCase();
  const flags = new Set();

  for (const [flag, rule] of Object.entries(PATHWAY_RULES)) {
    if (rule.keywords.some((kw) => text.includes(kw))) {
      flags.add(flag);
    }
    if (rule.ageMax && age !== null && age <= rule.ageMax) {
      flags.add("pediatric");
    }
  }

  return [...flags];
}

/**
 * Compute triage score and category from vitals object.
 * @param {object} vitals
 * @param {number|null} age
 * @returns {{ score: number, category: string, issues: string[] }}
 */
function scoreVitals(vitals = {}, age = null) {
  let score = 0;
  const issues = [];

  // ── Respiratory Rate ─────────────────────────────────────────────
  const rr = vitals.respiratory_rate;
  if (rr !== undefined && rr !== null) {
    if (rr === 0) {
      // No respirations — check AVPU before deciding BLACK
      issues.push("No respirations detected");
      score += 5;
    } else if (rr < 8 || rr > 30) {
      score += 3;
      issues.push(`RR ${rr}/min — danger range (<8 or >30)`);
    } else if (rr >= 25) {
      score += 1;
      issues.push(`RR ${rr}/min — elevated`);
    }
  }

  // ── SpO2 ──────────────────────────────────────────────────────────
  const spo2 = vitals.spo2;
  if (spo2 !== undefined && spo2 !== null) {
    if (spo2 < 85) {
      score += 5;
      issues.push(`SpO2 ${spo2}% — critical hypoxia`);
    } else if (spo2 < 90) {
      score += 4;
      issues.push(`SpO2 ${spo2}% — severe hypoxia`);
    } else if (spo2 < 94) {
      score += 2;
      issues.push(`SpO2 ${spo2}% — low`);
    }
  }

  // ── Systolic BP ───────────────────────────────────────────────────
  const sbp = vitals.systolic_bp;
  if (sbp !== undefined && sbp !== null) {
    if (sbp < 80) {
      score += 4;
      issues.push(`SBP ${sbp} mmHg — severe hypotension`);
    } else if (sbp < 90) {
      score += 3;
      issues.push(`SBP ${sbp} mmHg — hypotension`);
    } else if (sbp > 200) {
      score += 2;
      issues.push(`SBP ${sbp} mmHg — hypertensive crisis`);
    } else if (sbp > 180) {
      score += 1;
      issues.push(`SBP ${sbp} mmHg — hypertensive`);
    }
  }

  // ── Heart Rate ────────────────────────────────────────────────────
  const hr = vitals.heart_rate;
  if (hr !== undefined && hr !== null) {
    if (hr > 140 || hr < 40) {
      score += 3;
      issues.push(`HR ${hr} bpm — critical arrhythmia range`);
    } else if (hr > 120 || hr < 50) {
      score += 2;
      issues.push(`HR ${hr} bpm — abnormal`);
    } else if (hr > 100) {
      score += 1;
      issues.push(`HR ${hr} bpm — tachycardic`);
    }
  }

  // ── AVPU ──────────────────────────────────────────────────────────
  const avpu = vitals.avpu?.toUpperCase();
  if (avpu) {
    if (avpu === "U") {
      score += 5;
      issues.push("AVPU: Unresponsive");
    } else if (avpu === "P") {
      score += 3;
      issues.push("AVPU: Responds to pain only");
    } else if (avpu === "V") {
      score += 1;
      issues.push("AVPU: Responds to voice only");
    }
  }

  // ── GCS ───────────────────────────────────────────────────────────
  const gcs = vitals.gcs;
  if (gcs !== undefined && gcs !== null) {
    if (gcs < 9) {
      score += 4;
      issues.push(`GCS ${gcs} — severe impairment`);
    } else if (gcs < 13) {
      score += 2;
      issues.push(`GCS ${gcs} — moderate impairment`);
    }
  }

  // ── Age modifier ─────────────────────────────────────────────────
  const effectiveAge = age ?? vitals.age;
  if (effectiveAge !== undefined && effectiveAge !== null) {
    if (effectiveAge < 2 || effectiveAge > 80) {
      score += 2;
      issues.push(`Age ${effectiveAge} — high vulnerability`);
    } else if (effectiveAge < 5 || effectiveAge > 70) {
      score += 1;
      issues.push(`Age ${effectiveAge} — elevated vulnerability`);
    }
  }

  // ── Category ─────────────────────────────────────────────────────
  let category;
  const rrIsZero = rr === 0 || rr === undefined;
  const avpuUnresponsive = avpu === "U";

  if (rrIsZero && avpuUnresponsive) {
    // No breathing + unresponsive = Expectant (after repositioning airway)
    category = "BLACK";
  } else if (score >= 8) {
    category = "RED";
  } else if (score >= 4) {
    category = "YELLOW";
  } else {
    category = "GREEN";
  }

  return { score, category, issues };
}

/**
 * Suggest bed type from triage category and pathway flags.
 */
function suggestBedType(category, pathwayFlags = []) {
  if (category === "BLACK") return null;
  if (pathwayFlags.includes("burn")) return "burn";
  if (pathwayFlags.includes("pediatric")) return "pediatric";
  if (pathwayFlags.includes("psychiatric")) return "psychiatric";
  if (category === "RED") return pathwayFlags.includes("trauma") ? "trauma" : "ICU";
  return "general";
}

/**
 * Suggest hospital specialty requirements from pathway flags.
 */
function requiredSpecialties(pathwayFlags = []) {
  const specs = new Set();
  for (const flag of pathwayFlags) {
    const rule = PATHWAY_RULES[flag];
    if (rule) rule.specialty.forEach((s) => specs.add(s));
  }
  return [...specs];
}

module.exports = { scoreVitals, detectPathways, suggestBedType, requiredSpecialties };
