import React from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import ResultsPage from "./pages/ResultsPage";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-navy-900">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/results/:id" element={<ResultsPage />} />
        </Routes>
      </main>
    </div>
  );
}
