import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { AccessTokenResponse } from '@eduanalyze-ai/shared-types';

// Access token lives only in memory — never localStorage, never a cookie
// (see the Frontend F1 plan's token-architecture note). Lost on reload by
// design; AuthProvider re-hydrates it via POST /auth/refresh on mount,
// which works because the httpOnly refresh cookie auto-attaches.
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

// AuthProvider registers this once on mount — called when a refresh
// attempt fails (refresh cookie missing/expired), so the app can drop
// back to "logged out" state and redirect, without api-client.ts itself
// needing to know about React/routing.
let onRefreshFailed: (() => void) | null = null;

export function setOnRefreshFailed(handler: (() => void) | null) {
  onRefreshFailed = handler;
}

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Single in-flight refresh promise shared across every concurrent 401 —
// several requests failing at once (e.g. a page firing multiple queries)
// must trigger exactly one /auth/refresh call, not one per request.
let refreshPromise: Promise<string> | null = null;

// Exported for the idle-timeout "ต่อเวลา" button: it must renew the session
// through the same single-flight path as the 401 interceptor.
export async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .post<AccessTokenResponse>(
        '/auth/refresh',
        {},
        { _isRefreshCall: true } as never,
      )
      .then((res) => {
        setAccessToken(res.data.accessToken);
        return res.data.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    _isRefreshCall?: boolean;
    _retried?: boolean;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig | undefined;

    // The refresh call itself failing (any status/network error) means
    // there's no valid session left — notify the app, don't recurse.
    if (config?._isRefreshCall) {
      setAccessToken(null);
      onRefreshFailed?.();
      throw error;
    }

    const isRetryableAuthFailure =
      error.response?.status === 401 && config && !config._retried;
    if (!isRetryableAuthFailure) {
      throw error;
    }

    config._retried = true;
    try {
      const newAccessToken = await refreshAccessToken();
      config.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(config);
    } catch (refreshError) {
      setAccessToken(null);
      onRefreshFailed?.();
      throw refreshError;
    }
  },
);
