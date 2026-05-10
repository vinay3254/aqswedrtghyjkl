import React from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import ResultsPage from "./pages/ResultsPage";
import ImagingPage from "./pages/ImagingPage";
import PredictPage from "./pages/PredictPage";
import PatientPage from "./pages/PatientPage";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-navy-900">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/imaging" element={<ImagingPage />} />
          <Route path="/results/:id" element={<ResultsPage />} />
          <Route path="/predict" element={<PredictPage />} />
          <Route path="/patient" element={<PatientPage />} />
          <Route path="/patient/:patientId" element={<PatientPage />} />
        </Routes>
      </main>
    </div>
  );
}
