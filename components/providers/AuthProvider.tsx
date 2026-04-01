'use client';

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import { PERMISSIONS } from '../.././lib/permissions';

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000;   // 60 minutes
const WARNING_BEFORE_MS     = 5  * 60 * 1000;    // warn 5 min before timeout
const LAST_ACTIVE_KEY       = 'lastActiveAt';

// Define types based on the backend AuthResponse model
interface User {
  userId: number;
  firstName: string;
  phoneNumber: string;
  role: string;
  accessRights: string;
  token: string;
  expiresAtUtc: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (phoneNumber: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  checkPolicy: (policyName: string) => boolean;
  sessionWarning: boolean;
  extendSession: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => {},
  logout: () => {},
  isAuthenticated: false,
  hasPermission: () => false,
  checkPolicy: () => false,
  sessionWarning: false,
  extendSession: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionWarning, setSessionWarning] = useState(false);
  const router = useRouter();
  const timeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAuthed    = useRef(false);

  const syncTokenCookie = (token?: string | null) => {
    if (typeof document === 'undefined') return;
    if (token && token.trim().length > 0) {
      document.cookie = `token=${encodeURIComponent(token)}; Path=/; SameSite=Lax`;
      return;
    }
    document.cookie = 'token=; Path=/; Max-Age=0; SameSite=Lax';
  };

  const doLogout = useCallback((reason?: string) => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem(LAST_ACTIVE_KEY);
    syncTokenCookie(null);
    setUser(null);
    setSessionWarning(false);
    isAuthed.current = false;
    if (timeoutRef.current)  clearTimeout(timeoutRef.current);
    if (warningRef.current)  clearTimeout(warningRef.current);
    router.push(reason === 'inactivity' ? '/login?reason=inactivity' : '/login');
  }, [router]);

  /** Reset the inactivity clock whenever the user does something */
  const resetInactivityTimer = useCallback(() => {
    if (!isAuthed.current) return;

    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
    setSessionWarning(false);

    if (timeoutRef.current)  clearTimeout(timeoutRef.current);
    if (warningRef.current)  clearTimeout(warningRef.current);

    warningRef.current = setTimeout(() => {
      setSessionWarning(true);
    }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS);

    timeoutRef.current = setTimeout(() => {
      doLogout('inactivity');
    }, INACTIVITY_TIMEOUT_MS);
  }, [doLogout]);

  /** Let the user manually extend their session via the warning banner */
  const extendSession = useCallback(() => {
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  // Register global activity listeners
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'] as const;
    const handler = () => resetInactivityTimer();
    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, handler));
  }, [resetInactivityTimer]);

  // On tab focus: check if the stored last-active timestamp already expired
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible' || !isAuthed.current) return;
      const last = Number(localStorage.getItem(LAST_ACTIVE_KEY) ?? 0);
      if (Date.now() - last > INACTIVITY_TIMEOUT_MS) {
        doLogout('inactivity');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [doLogout]);

  // Check for existing token on mount and validate it
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
          setIsLoading(false);
          return;
        }

        const userData = JSON.parse(storedUser) as User;
        const token = userData.token;

        // Check if the session already expired while the tab was closed
        const last = Number(localStorage.getItem(LAST_ACTIVE_KEY) ?? 0);
        if (last > 0 && Date.now() - last > INACTIVITY_TIMEOUT_MS) {
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          localStorage.removeItem(LAST_ACTIVE_KEY);
          syncTokenCookie(null);
          setIsLoading(false);
          router.push('/login?reason=inactivity');
          return;
        }

        localStorage.setItem('token', token);
        syncTokenCookie(token);
        isAuthed.current = true;
        setUser(userData);
        resetInactivityTimer();
      } catch (error) {
        console.error('Error loading user data:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem(LAST_ACTIVE_KEY);
        syncTokenCookie(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (phoneNumber: string, password: string): Promise<void> => {
    try {
      const response = await api.post('/api/Auth/login', {
        phoneNumber,
        password
      });
      
      const userData: User = response.data;
      
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', userData.token);
      syncTokenCookie(userData.token);
      isAuthed.current = true;
      setUser(userData);
      resetInactivityTimer();
      router.push('/dashboard');
    } catch (error: unknown) {
      console.error('Login failed:', error);
      const errorMessage = (error as { response?: { data?: { error?: string } } }).response?.data?.error || 'Login failed. Please check your credentials.';
      throw new Error(errorMessage);
    }
  };

  const logout = () => doLogout();

  // Check for direct permission in accessRights
  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    
    // Admin has all permissions (matching backend Program.cs policy)
    if (user.role === 'Admin') return true;
    
    // Check access rights (matching structure used in AuthService.cs)
    try {
      const accessRights = JSON.parse(user.accessRights || '{}');
      return !!accessRights[permission];
    } catch (error) {
      console.error('Error parsing access rights:', error);
      return false;
    }
  };
  
  // Check policy (directly matching backend policy definitions)
  const checkPolicy = (policyName: string): boolean => {
    if (!user) return false;
    
    switch(policyName) {
      case PERMISSIONS.POLICY_ADMIN_ONLY:
        return user.role === 'Admin';
        
      case PERMISSIONS.POLICY_VIEW_ALL_CHATS:
        return user.role === 'Admin' || hasPermission(PERMISSIONS.VIEW_ALL_CHATS);
        
      case PERMISSIONS.POLICY_VIEW_USERS:
        return user.role === 'Admin' || hasPermission(PERMISSIONS.VIEW_USERS);
        
      default:
        return false;
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        isLoading, 
        login, 
        logout,
        isAuthenticated: !!user,
        hasPermission,
        checkPolicy,
        sessionWarning,
        extendSession,
      }}
    >
      {children}

      {/* Inactivity warning banner — shown 5 min before auto-logout */}
      {sessionWarning && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--wa-ink-900, #1f2c34)', color: '#fff',
          padding: '14px 24px', borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
          fontSize: '0.9rem', fontFamily: 'inherit',
          maxWidth: '90vw',
        }}>
          <span style={{ fontSize: '1.2rem' }}>⏳</span>
          <span>Your session will expire in <strong>5 minutes</strong> due to inactivity.</span>
          <button
            onClick={extendSession}
            style={{
              marginLeft: 8,
              background: 'var(--wa-green-600, #128c7e)', color: '#fff',
              border: 'none', borderRadius: 8,
              padding: '7px 16px', cursor: 'pointer',
              fontWeight: 700, fontSize: '0.85rem',
            }}
          >
            Stay logged in
          </button>
          <button
            onClick={() => doLogout()}
            style={{
              background: 'transparent', color: 'rgba(255,255,255,0.65)',
              border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
              padding: '7px 14px', cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Log out
          </button>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);