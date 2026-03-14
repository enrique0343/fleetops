import axios, { AxiosInstance, AxiosError } from 'axios';

const RAW_BASE_URL =
  typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL
    ? String((import.meta as any).env.VITE_API_URL).replace(/\/$/, '')
    : '';

const BASE_URL = RAW_BASE_URL ? `${RAW_BASE_URL}/api` : '/api';

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('fleetops_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('fleetops_token');
      localStorage.removeItem('fleetops_user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as any;
    if (data?.error) return data.error;
    if (data?.errors?.length) return data.errors[0].msg;
    if (error.message === 'Network Error') return 'Sin conexión al servidor';
    if (error.code === 'ECONNABORTED') return 'Tiempo de espera agotado';
  }
  if (error instanceof Error) return error.message;
  return 'Error desconocido';
}