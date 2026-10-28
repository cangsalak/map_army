/**
 * GeoMonitor 3D Frontend API Client
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  code: string;
  details?: any;

  constructor(message: string, code = 'API_ERROR', details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

let authToken: string | null = null;

export function setClientToken(token: string | null) {
  authToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('geomonitor_token', token);
      document.cookie = `geomonitor_token=${encodeURIComponent(token)}; path=/; max-age=86400; SameSite=Lax`;
    } else {
      localStorage.removeItem('geomonitor_token');
      document.cookie = 'geomonitor_token=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'geomonitor_access_token=; path=/; max-age=0; SameSite=Lax';
    }
  }
}

export function getClientToken(): string | null {
  if (authToken) return authToken;
  if (typeof window !== 'undefined') {
    authToken = localStorage.getItem('geomonitor_token');
    if (!authToken) {
      // Check document.cookie as fallback
      const match = document.cookie.match(/(?:^|; )geomonitor_token=([^;]*)/);
      if (match) authToken = decodeURIComponent(match[1]);
    }
  }
  return authToken;
}

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getClientToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    const data = await res.json();

    if (!res.ok || data.success === false) {
      if (res.status === 401) {
        setClientToken(null);
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = `/login?from=${encodeURIComponent(window.location.pathname)}`;
        }
      }
      throw new ApiError(
        data.error?.message || 'เกิดข้อผิดพลาดในการติดต่อกับเซิร์ฟเวอร์',
        data.error?.code || `HTTP_${res.status}`,
        data.error?.details
      );
    }

    return data.data !== undefined ? data.data : data;
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.message || 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่อ');
  }
}
