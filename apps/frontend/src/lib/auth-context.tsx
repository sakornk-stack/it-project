'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import type {
  AccessTokenResponse,
  CurrentUserResponse,
} from '@eduanalyze-ai/shared-types';
import { apiClient, getAccessToken, setAccessToken, setOnRefreshFailed } from './api-client';
import { getSessionChannel } from './session-channel';
import {
  buildLoginUrl,
  type InvoluntarySessionEndReason,
  type SessionEndReason,
} from './session-end-reason';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  user: CurrentUserResponse | null;
  status: AuthStatus;
  // Called after a call that issued a fresh access token (login, register,
  // google/complete-registration) — stores it in memory, loads /me, and
  // returns the loaded user so the caller can decide where to redirect.
  login: (accessToken: string) => Promise<CurrentUserResponse>;
  logout: () => Promise<void>;
  // Ends the session for any reason: revokes the refresh token server-side
  // (unless another tab already did — `remote`), wipes the client state and
  // the React Query cache, and sends the user to /login with the reason.
  endSession: (reason: SessionEndReason, options?: { remote?: boolean }) => Promise<void>;
  // True after an explicit sign-out (vs. a session that expired): the next
  // person at this browser must not be sent back to the previous user's page.
  signedOut: boolean;
  // Why the last session ended involuntarily (idle / absolute cap / refresh
  // failure) — ProtectedRoute puts it on the /login redirect.
  sessionEndReason: InvoluntarySessionEndReason | null;
  // Re-fetches /auth/me without touching the access token — used after a
  // password change so `user.mustChangePassword` reflects reality without
  // a full page reload.
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUserResponse | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [signedOut, setSignedOut] = useState(false);
  const [sessionEndReason, setSessionEndReason] = useState<InvoluntarySessionEndReason | null>(
    null,
  );
  const router = useRouter();
  const queryClient = useQueryClient();

  // Read by the long-lived refresh-failure handler below, which must tell
  // "the session died while in use" from "a visitor who was never signed in".
  const statusRef = useRef<AuthStatus>('loading');
  statusRef.current = status;

  const loadCurrentUser = useCallback(async () => {
    const { data } = await apiClient.get<CurrentUserResponse>('/auth/me');
    setUser(data);
    setStatus('authenticated');
    return data;
  }, []);

  const login = useCallback(
    async (accessToken: string) => {
      setAccessToken(accessToken);
      setSignedOut(false);
      setSessionEndReason(null);
      return loadCurrentUser();
    },
    [loadCurrentUser],
  );

  const endSession = useCallback(
    async (reason: SessionEndReason, options?: { remote?: boolean }) => {
      const remote = options?.remote ?? false;
      const next =
        reason === 'logout' ? null : `${window.location.pathname}${window.location.search}`;
      try {
        // The refresh-cookie-authenticated logout works even though the 15 min
        // access token has probably expired by now. A failure must not block
        // leaving: the client state is wiped either way.
        if (!remote) await apiClient.post('/auth/logout');
      } catch {
        // See above.
      } finally {
        setAccessToken(null);
        // Another person may sign in here next — nothing of this session's
        // data may stay in the cache.
        queryClient.clear();
        setUser(null);
        if (reason === 'logout') {
          setSignedOut(true);
          setSessionEndReason(null);
        } else {
          setSessionEndReason(reason);
        }
        setStatus('unauthenticated');
        // Tell the other tabs once; tabs that were told (`remote`) don't echo.
        if (!remote) getSessionChannel().post({ type: 'ended', reason, ts: Date.now() });
        router.replace(buildLoginUrl({ next, reason }));
      }
    },
    [queryClient, router],
  );

  const logout = useCallback(() => endSession('logout'), [endSession]);

  // Revives the session on mount/reload — the access token was never
  // persisted anywhere, so the only way back in is the httpOnly refresh
  // cookie auto-attaching to this call.
  useEffect(() => {
    setOnRefreshFailed(() => {
      if (statusRef.current === 'authenticated') {
        // Session lost while in use (refresh cookie expired, account
        // deactivated, absolute cap hit on the server).
        queryClient.clear();
        setSessionEndReason('refresh-failed');
      }
      setAccessToken(null);
      setUser(null);
      setStatus('unauthenticated');
    });

    (async () => {
      try {
        const { data } = await apiClient.post<AccessTokenResponse>('/auth/refresh');
        setAccessToken(data.accessToken);
        await loadCurrentUser();
      } catch {
        setStatus('unauthenticated');
      }
    })();

    return () => setOnRefreshFailed(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        signedOut,
        sessionEndReason,
        login,
        logout,
        endSession,
        refreshUser: async () => {
          await loadCurrentUser();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

// Exposed for code that needs a synchronous read outside React (rare;
// prefer useAuth() in components).
export { getAccessToken };
