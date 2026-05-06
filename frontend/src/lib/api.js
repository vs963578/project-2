import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

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
