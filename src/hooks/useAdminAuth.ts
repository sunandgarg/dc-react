import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface AdminAuthState {
  isAdmin: boolean;
  isApproved: boolean;
  loading: boolean;
  userEmail: string | null;
  error: string | null;
}

const ADMIN_AUTH_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function getAdminAuthCacheKey(userId: string): string {
  return `dc_admin_auth_cache_v1:${userId}`;
}

function readCachedAdminAuth(userId: string): Pick<AdminAuthState, 'isAdmin' | 'isApproved' | 'userEmail'> | null {
  try {
    const raw = localStorage.getItem(getAdminAuthCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      isAdmin: Boolean(parsed?.isAdmin),
      isApproved: Boolean(parsed?.isApproved),
      userEmail: typeof parsed?.userEmail === 'string' ? parsed.userEmail : null,
    };
  } catch {
    return null;
  }
}

function writeCachedAdminAuth(userId: string, state: Pick<AdminAuthState, 'isAdmin' | 'isApproved' | 'userEmail'>) {
  try {
    localStorage.setItem(getAdminAuthCacheKey(userId), JSON.stringify(state));
  } catch {
    // ignore cache write failures
  }
}

export function useAdminAuth(): AdminAuthState & { refetch: () => Promise<void> } {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<AdminAuthState>({
    isAdmin: false,
    isApproved: false,
    loading: true,
    userEmail: null,
    error: null,
  });

  // Track which user ID we've already checked to avoid redundant checks
  const checkedUserIdRef = useRef<string | null>(null);
  const isInitialCheckDoneRef = useRef(false);

  const checkAdminStatus = useCallback(async (isInitial: boolean = false) => {
    if (!user) {
      setState({
        isAdmin: false,
        isApproved: false,
        loading: false,
        userEmail: null,
        error: null,
      });
      checkedUserIdRef.current = null;
      isInitialCheckDoneRef.current = false;
      return;
    }

    const cachedState = readCachedAdminAuth(user.id);

    // Skip if we already checked this exact user and it's not a forced refetch
    if (checkedUserIdRef.current === user.id && isInitialCheckDoneRef.current && isInitial) {
      return;
    }

    // CRITICAL: Only show loading spinner on INITIAL check, not on re-checks
    // This prevents the component tree from unmounting on tab switches
    if (!isInitialCheckDoneRef.current) {
      setState(prev => ({ ...prev, loading: true, error: null }));
    }

    if (cachedState && !isInitialCheckDoneRef.current) {
      setState({
        isAdmin: cachedState.isAdmin,
        isApproved: cachedState.isApproved,
        loading: false,
        userEmail: cachedState.userEmail || user.email || null,
        error: null,
      });
    }

    try {
      // Ensure a profile exists for this user
      const { data: existingProfile, error: profileReadError } = await withTimeout(
        supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle(),
        ADMIN_AUTH_TIMEOUT_MS,
        'Profile lookup timed out.',
      );

      if (profileReadError) {
        console.error('Error reading profile:', profileReadError);
      }

      if (!existingProfile) {
        supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email ?? '',
            full_name: (user.user_metadata as any)?.full_name ?? user.email ?? null,
          })
          .then(({ error: profileInsertError }) => {
            if (profileInsertError) {
              console.error('Error creating profile:', profileInsertError);
            }
          });
      }

      // Check if user has admin role
      const [{ data: hasAdminRole, error: roleError }, { data: approvedData, error: approvedError }] = await withTimeout(
        Promise.all([
          supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' }),
          supabase.rpc('is_user_approved', { _user_id: user.id }),
        ]),
        ADMIN_AUTH_TIMEOUT_MS,
        'Admin permission lookup timed out.',
      );

      if (roleError) console.error('Error checking admin role:', roleError);
      if (approvedError) console.error('Error checking approval status:', approvedError);

      checkedUserIdRef.current = user.id;
      isInitialCheckDoneRef.current = true;

      const nextState = {
        isAdmin: !!hasAdminRole,
        isApproved: !!approvedData,
        loading: false,
        userEmail: user.email ?? null,
        error: null,
      };

      writeCachedAdminAuth(user.id, nextState);
      setState(nextState);
    } catch (error) {
      console.error('Error in admin auth check:', error);
      const fallbackState = cachedState
        ? {
            isAdmin: cachedState.isAdmin,
            isApproved: cachedState.isApproved,
            loading: false,
            userEmail: cachedState.userEmail || user.email || null,
            error: null,
          }
        : {
            isAdmin: false,
            // Never deadlock the whole app behind a transient approval check.
            // Admin-only surfaces still remain hidden unless the role check succeeds.
            isApproved: true,
            loading: false,
            userEmail: user.email ?? null,
            error: null,
          };

      checkedUserIdRef.current = user.id;
      isInitialCheckDoneRef.current = true;
      setState(fallbackState);
    }
  }, [user?.id, user?.email]);

  // Initial check - only when auth loading finishes and user changes
  useEffect(() => {
    if (!authLoading) {
      checkAdminStatus(true);
    }
  }, [authLoading, user?.id]);

  // Keep approval and role changes fresh without depending on Supabase Realtime.
  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => { void checkAdminStatus(false); }, 30_000);
    return () => window.clearInterval(timer);
  }, [user?.id, checkAdminStatus]);

  return {
    ...state,
    loading: authLoading || state.loading,
    refetch: () => checkAdminStatus(false),
  };
}
