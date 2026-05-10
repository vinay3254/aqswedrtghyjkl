import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { CssBaseline, Box } from '@mui/material'
import DashboardPage from './pages/DashboardPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <CssBaseline />
      <Box sx={{ width: '100%', height: '100vh' }}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
        </Routes>
      </Box>
    </BrowserRouter>
  )
}

export default App
