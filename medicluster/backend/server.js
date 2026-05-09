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

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: ["http://localhost:3000", "http://localhost:5173"] }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/data", dataRoutes);
app.use("/api/cluster", clusterRoutes);

app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", service: "medicluster-backend" })
);

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
