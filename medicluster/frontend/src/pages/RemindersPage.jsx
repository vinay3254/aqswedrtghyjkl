import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { listReminders, createReminder, updateReminder, deleteReminder } from "../api/apiClient";

const PRESET_TIMES = [
  { label: "Morning",   value: "08:00" },
  { label: "Afternoon", value: "13:00" },
  { label: "Evening",   value: "18:00" },
  { label: "Night",     value: "21:00" },
];

const FREQ_LABELS = { daily: "Daily", weekly: "Weekly", "as-needed": "As needed" };

function timeLabel(t) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function isDueNow(times) {
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  return times.some((t) => {
    const [h, m] = t.split(":").map(Number);
    const diff = Math.abs(h * 60 + m - currentMins);
    return diff <= 30;
  });
}

function isUpcoming(times) {
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  return times.some((t) => {
    const [h, m] = t.split(":").map(Number);
    const diff = h * 60 + m - currentMins;
    return diff > 0 && diff <= 120;
  });
}

function ReminderCard({ reminder, onToggle, onDelete }) {
  const due = isDueNow(reminder.times);
  const upcoming = !due && isUpcoming(reminder.times);

  return (
    <div
      className={`bg-white rounded-xl border p-4 transition-all ${
        !reminder.active
          ? "border-slate-100 opacity-60"
          : due
          ? "border-red-300 shadow-sm shadow-red-100"
          : upcoming
          ? "border-amber-300 shadow-sm shadow-amber-50"
          : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-800 text-sm">{reminder.medicationName}</p>
            {reminder.dosage && (
              <span className="text-xs text-slate-400 font-mono bg-slate-50 px-1.5 py-0.5 rounded">
                {reminder.dosage}
              </span>
            )}
            {due && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 animate-pulse">
                Due Now
              </span>
            )}
            {upcoming && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                Upcoming
              </span>
            )}
            {!reminder.active && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">Paused</span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 mt-2">
            {reminder.times.map((t) => (
              <span
                key={t}
                className={`text-xs font-semibold px-2 py-1 rounded-lg flex items-center gap-1 ${
                  isDueNow([t])
                    ? "bg-red-100 text-red-700"
                    : isUpcoming([t])
                    ? "bg-amber-100 text-amber-700"
                    : "bg-blue-50 text-blue-700"
                }`}
              >
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {timeLabel(t)}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
            <span>{FREQ_LABELS[reminder.frequency] ?? reminder.frequency}</span>
            {reminder.days?.length > 0 && (
              <span>{reminder.days.join(", ")}</span>
            )}
          </div>

          {reminder.notes && (
            <p className="text-xs text-slate-500 mt-1.5 italic">{reminder.notes}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onToggle(reminder)}
            title={reminder.active ? "Pause reminder" : "Resume reminder"}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            {reminder.active ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => onDelete(reminder._id)}
            title="Delete reminder"
            className="p-1.5 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function AddReminderForm({ patientId, onAdded }) {
  const [med,      setMed]      = useState("");
  const [dosage,   setDosage]   = useState("");
  const [times,    setTimes]    = useState([]);
  const [custom,   setCustom]   = useState("");
  const [freq,     setFreq]     = useState("daily");
  const [days,     setDays]     = useState([]);
  const [notes,    setNotes]    = useState("");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);

  function togglePreset(val) {
    setTimes((prev) => prev.includes(val) ? prev.filter((t) => t !== val) : [...prev, val]);
  }

  function toggleDay(d) {
    setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  }

  function addCustomTime() {
    const t = custom.trim();
    if (!t) return;
    if (!/^\d{2}:\d{2}$/.test(t)) { setError("Custom time must be HH:MM format"); return; }
    if (!times.includes(t)) setTimes((prev) => [...prev, t].sort());
    setCustom("");
    setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!med.trim()) { setError("Medication name is required"); return; }
    if (times.length === 0) { setError("Select at least one time"); return; }
    setSaving(true);
    setError(null);
    try {
      const created = await createReminder({
        patientId,
        medicationName: med.trim(),
        dosage: dosage.trim(),
        times: [...times].sort(),
        frequency: freq,
        days: freq === "weekly" ? days : [],
        notes: notes.trim(),
      });
      onAdded(created);
      setMed(""); setDosage(""); setTimes([]); setDays([]); setNotes(""); setFreq("daily");
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to save reminder");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <p className="text-sm font-semibold text-slate-700">Add Medication Reminder</p>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Medication Name *</label>
          <input
            type="text"
            value={med}
            onChange={(e) => setMed(e.target.value)}
            placeholder="e.g. Metformin"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Dosage</label>
          <input
            type="text"
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            placeholder="e.g. 500mg"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-500 block mb-2">Reminder Times *</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {PRESET_TIMES.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => togglePreset(value)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                times.includes(value)
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-500 border-slate-200 hover:border-blue-400 hover:text-blue-600"
              }`}
            >
              {label} · {timeLabel(value)}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="time"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={addCustomTime}
            className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
          >
            Add custom time
          </button>
        </div>
        {times.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {[...times].sort().map((t) => (
              <span key={t} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                {timeLabel(t)}
                <button type="button" onClick={() => setTimes((prev) => prev.filter((x) => x !== t))} className="hover:text-red-500">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="text-xs text-slate-500 block mb-2">Frequency</label>
        <div className="flex gap-2">
          {Object.entries(FREQ_LABELS).map(([val, lbl]) => (
            <button
              key={val}
              type="button"
              onClick={() => setFreq(val)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                freq === val
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-500 border-slate-200 hover:border-blue-400"
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
        {freq === "weekly" && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={`text-xs font-semibold w-10 py-1 rounded-lg border transition-colors ${
                  days.includes(d)
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-500 border-slate-200 hover:border-blue-400"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="text-xs text-slate-500 block mb-1">Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Take with food"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full btn-primary text-sm py-2 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Reminder"}
      </button>
    </form>
  );
}

function TodaySchedule({ reminders }) {
  const active = reminders.filter((r) => r.active);
  if (active.length === 0) return null;

  const slots = [];
  for (const r of active) {
    for (const t of r.times) {
      slots.push({ time: t, reminder: r });
    }
  }
  slots.sort((a, b) => a.time.localeCompare(b.time));

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm font-semibold text-slate-700">Today's Schedule</p>
        <span className="text-xs text-slate-400 ml-auto">
          {now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
        </span>
      </div>

      <div className="space-y-2">
        {slots.map(({ time, reminder }, i) => {
          const [h, m] = time.split(":").map(Number);
          const slotMins = h * 60 + m;
          const diff = slotMins - nowMins;
          const past = diff < -30;
          const dueNow = Math.abs(diff) <= 30;
          const upcoming = diff > 30 && diff <= 120;

          return (
            <div
              key={i}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${
                past ? "bg-slate-50 opacity-50" :
                dueNow ? "bg-red-50 border border-red-200" :
                upcoming ? "bg-amber-50 border border-amber-200" :
                "bg-slate-50"
              }`}
            >
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                past ? "bg-slate-300" : dueNow ? "bg-red-500 animate-pulse" : upcoming ? "bg-amber-500" : "bg-blue-400"
              }`} />
              <span className={`font-mono text-xs font-bold w-16 shrink-0 ${
                past ? "text-slate-400" : dueNow ? "text-red-700" : upcoming ? "text-amber-700" : "text-slate-600"
              }`}>
                {timeLabel(time)}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-700 truncate">{reminder.medicationName}</span>
                {reminder.dosage && (
                  <span className="text-xs text-slate-400 ml-1.5">{reminder.dosage}</span>
                )}
              </div>
              {dueNow && <span className="text-xs font-bold text-red-600 shrink-0">Take now</span>}
              {upcoming && <span className="text-xs text-amber-600 shrink-0">~{Math.round(diff)}m</span>}
              {past && <span className="text-xs text-slate-400 shrink-0">Done</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RemindersPage() {
  const { patientId: urlPatientId } = useParams();
  const navigate = useNavigate();

  const [patientId,  setPatientId]  = useState(urlPatientId ?? "");
  const [reminders,  setReminders]  = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [searchInput, setSearchInput] = useState(urlPatientId ?? "");

  const loadReminders = useCallback((pid) => {
    if (!pid) return;
    setLoading(true);
    setError(null);
    listReminders(pid)
      .then(setReminders)
      .catch(() => setError("Failed to load reminders"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (urlPatientId) {
      setPatientId(urlPatientId);
      setSearchInput(urlPatientId);
      loadReminders(urlPatientId);
    }
  }, [urlPatientId, loadReminders]);

  function handleSearch(e) {
    e.preventDefault();
    const pid = searchInput.trim();
    if (!pid) return;
    navigate(`/reminders/${pid}`);
  }

  function handleAdded(reminder) {
    setReminders((prev) => [reminder, ...prev]);
  }

  async function handleToggle(reminder) {
    try {
      const updated = await updateReminder(reminder._id, { active: !reminder.active });
      setReminders((prev) => prev.map((r) => r._id === updated._id ? updated : r));
    } catch {
      setError("Failed to update reminder");
    }
  }

  async function handleDelete(id) {
    try {
      await deleteReminder(id);
      setReminders((prev) => prev.filter((r) => r._id !== id));
    } catch {
      setError("Failed to delete reminder");
    }
  }

  const activeReminders   = reminders.filter((r) => r.active);
  const inactiveReminders = reminders.filter((r) => !r.active);
  const dueCount = activeReminders.filter((r) => isDueNow(r.times)).length;

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 p-6">
      <div className="max-w-screen-xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Medication Reminders
              {dueCount > 0 && (
                <span className="text-xs font-bold bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                  {dueCount} due
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Set and manage medication schedules per patient.</p>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Enter patient ID…"
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
            />
            <button type="submit" className="btn-primary text-sm py-1.5 px-4">
              Load Patient
            </button>
          </form>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-700 ml-4">✕</button>
          </div>
        )}

        {!patientId ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium">Enter a patient ID to manage their medication reminders.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left column: add form */}
            <div className="lg:col-span-1">
              <AddReminderForm patientId={patientId} onAdded={handleAdded} />
            </div>

            {/* Right column: today's schedule + reminder list */}
            <div className="lg:col-span-2 space-y-5">

              {/* Patient header strip */}
              <div className="bg-white rounded-xl border border-slate-200 px-5 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <svg className="w-4.5 h-4.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="font-mono font-bold text-slate-900">{patientId}</p>
                  <p className="text-xs text-slate-400">
                    {activeReminders.length} active reminder{activeReminders.length !== 1 ? "s" : ""}
                    {inactiveReminders.length > 0 && ` · ${inactiveReminders.length} paused`}
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
                  Loading reminders…
                </div>
              ) : (
                <>
                  <TodaySchedule reminders={reminders} />

                  {reminders.length === 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                      <p className="text-slate-400 text-sm">No reminders yet. Add one using the form.</p>
                    </div>
                  ) : (
                    <>
                      {activeReminders.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Active — {activeReminders.length}
                          </p>
                          {activeReminders.map((r) => (
                            <ReminderCard key={r._id} reminder={r} onToggle={handleToggle} onDelete={handleDelete} />
                          ))}
                        </div>
                      )}

                      {inactiveReminders.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Paused — {inactiveReminders.length}
                          </p>
                          {inactiveReminders.map((r) => (
                            <ReminderCard key={r._id} reminder={r} onToggle={handleToggle} onDelete={handleDelete} />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
