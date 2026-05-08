import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Attach Bearer token from localStorage to every request
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("cq_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If any call returns 401, clear the token so AuthContext redirects to /login
axios.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("cq_token");
      // Only redirect if not already on login page
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.dispatchEvent(new CustomEvent("cq:unauthorized"));
      }
    }
    return Promise.reject(err);
  }
);

export const apiAnalyze = (payload) => axios.post(`${API}/analyze`, payload).then(r => r.data);
export const apiList = () => axios.get(`${API}/evaluations`).then(r => r.data);
export const apiGet = (id) => axios.get(`${API}/evaluations/${id}`).then(r => r.data);
export const apiDelete = (id) => axios.delete(`${API}/evaluations/${id}`).then(r => r.data);
export const apiAnalytics = () => axios.get(`${API}/analytics/summary`).then(r => r.data);
export const apiUpload = (formData) =>
  axios.post(`${API}/upload-transcript`, formData, { headers: { "Content-Type": "multipart/form-data" } }).then(r => r.data);
export const apiTranscribeAudio = (formData, onProgress) =>
  axios.post(`${API}/transcribe-audio`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: onProgress,
  }).then(r => r.data);
export const apiDiarize = (transcript) =>
  axios.post(`${API}/diarize`, { transcript }).then(r => r.data);
export const apiLeaderboard = () => axios.get(`${API}/analytics/leaderboard`).then(r => r.data);
export const apiDigestPreview = (days = 7) => axios.get(`${API}/digest/preview`, { params: { days } }).then(r => r.data);
export const apiDigestSendSlack = (days = 7) => axios.post(`${API}/digest/send-slack`, null, { params: { days } }).then(r => r.data);
export const apiDigestConfig = () => axios.get(`${API}/digest/config`).then(r => r.data);
export const apiListAgents = () => axios.get(`${API}/agents`).then(r => r.data);
export const apiCreateAgent = (payload) => axios.post(`${API}/agents`, payload).then(r => r.data);
export const apiDeleteAgent = (id) => axios.delete(`${API}/agents/${id}`).then(r => r.data);
export const apiSendAgentEmails = (days = 7) => axios.post(`${API}/digest/send-agent-emails`, null, { params: { days } }).then(r => r.data);
export const apiPreviewAgentEmail = (id, days = 7) => axios.post(`${API}/digest/preview-agent-email/${id}`, null, { params: { days } }).then(r => r.data);

// Auth
export const apiLogin = (email, password) => axios.post(`${API}/auth/login`, { email, password }).then(r => r.data);
export const apiRegister = (email, password, name) => axios.post(`${API}/auth/register`, { email, password, name }).then(r => r.data);
export const apiMe = () => axios.get(`${API}/auth/me`).then(r => r.data);
