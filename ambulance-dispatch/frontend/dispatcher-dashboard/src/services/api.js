import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me')
};

// Incidents API
export const incidentsApi = {
  getAll: (params) => api.get('/incidents', { params }),
  getById: (id) => api.get(`/incidents/${id}`),
  create: (data) => api.post('/incidents', data),
  update: (id, data) => api.put(`/incidents/${id}`, data),
  updateStatus: (id, status, notes) => api.patch(`/incidents/${id}/status`, { status, notes }),
  acknowledge: (id) => api.post(`/incidents/${id}/acknowledge`),
  getTimeline: (id) => api.get(`/incidents/${id}/timeline`)
};

// Ambulances API
export const ambulancesApi = {
  getAll: (params) => api.get('/ambulances', { params }),
  getById: (id) => api.get(`/ambulances/${id}`),
  getAvailable: (lat, lng, radius) => api.get('/ambulances/available', { params: { lat, lng, radius } }),
  updateStatus: (id, status) => api.patch(`/ambulances/${id}/status`, { status }),
  updateLocation: (id, lat, lng) => api.patch(`/ambulances/${id}/location`, { latitude: lat, longitude: lng })
};

// Hospitals API
export const hospitalsApi = {
  getAll: (params) => api.get('/hospitals', { params }),
  getById: (id) => api.get(`/hospitals/${id}`),
  getNearby: (lat, lng, radius) => api.get('/hospitals/nearby', { params: { lat, lng, radius } }),
  getScored: (incidentId) => api.get(`/hospitals/scored/${incidentId}`),
  updateCapacity: (id, data) => api.patch(`/hospitals/${id}/capacity`, data)
};

// Assignments API
export const assignmentsApi = {
  create: (data) => api.post('/assignments', data),
  getRecommendations: (incidentId) => api.get(`/assignments/recommendations/${incidentId}`),
  accept: (id) => api.post(`/assignments/${id}/accept`),
  reject: (id, reason) => api.post(`/assignments/${id}/reject`, { reason }),
  complete: (id) => api.post(`/assignments/${id}/complete`)
};

// Analytics API
export const analyticsApi = {
  getDashboardStats: () => api.get('/analytics/dashboard'),
  getHotspots: () => api.get('/analytics/hotspots'),
  getResponseTimes: (period) => api.get('/analytics/response-times', { params: { period } })
};

export default api;
