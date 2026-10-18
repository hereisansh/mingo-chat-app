import axios from "axios";

export const backendUrl = import.meta.env.PROD
  ? window.location.origin
  : import.meta.env.VITE_BACKEND_URL || `http://${window.location.hostname}:4500`;

export const assetUrl = (value = "") => value.startsWith("/") ? `${backendUrl}${value}` : value;

const api = axios.create({
  baseURL: backendUrl,
  withCredentials: true,
});

export default api;
