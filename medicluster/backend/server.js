/**
 * backend/server.js
 * Express API gateway for MediCluster.
 * Connects to MongoDB, proxies ML requests to the Python engine.
 */

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const dataRoutes = require("./routes/dataRoutes");
const clusterRoutes = require("./routes/clusterRoutes");
const mediaRoutes = require("./routes/mediaRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: ["http://localhost:3000", "http://localhost:5173"] }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/data", dataRoutes);
app.use("/api/cluster", clusterRoutes);
app.use("/api/media", mediaRoutes);

app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", service: "medicluster-backend" })
);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found" });
});

app.use((err, _req, res, _next) => {
  let status = err.status || err.statusCode || 500;
  let message = status >= 500 ? "Internal server error" : err.message;

  if (err.name === "MulterError") {
    status = 400;
    message = err.code === "LIMIT_FILE_SIZE"
      ? "CSV file is too large"
      : err.message;
  }

  if (status >= 500) {
    console.error("Unhandled API error:", err);
  }

  res.status(status).json({ error: message });
});

// ── MongoDB connection ────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/medicluster";

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅  MongoDB connected");
    app.listen(PORT, () =>
      console.log(`🚀  MediCluster backend running on port ${PORT}`)
    );
  })
  .catch((err) => {
    console.error("❌  MongoDB connection error:", err.message);
    // Start server even without DB so frontend can show error state
    app.listen(PORT, () =>
      console.log(`⚠️   Backend running without DB on port ${PORT}`)
    );
  });

module.exports = app;
