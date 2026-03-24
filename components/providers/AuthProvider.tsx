'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import { PERMISSIONS } from '../.././lib/permissions';

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
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => {},
  logout: () => {},
  isAuthenticated: false,
  hasPermission: () => false,
  checkPolicy: () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

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

        // Previously we removed the user if `expiresAtUtc` was past.
        // Removing that client-side forced-logout to avoid unexpected session drops.
        // Keep token stored and restore user from localStorage as-is; backend should enforce token validity.
        localStorage.setItem('token', token); // Ensure token is separately stored for API calls
        setUser(userData);
      } catch (error) {
        console.error('Error loading user data:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async (phoneNumber: string, password: string): Promise<void> => {
    try {
      const response = await api.post('/api/Auth/login', {
        phoneNumber,
        password
      });
      
      const userData: User = response.data;
      
      // Store the complete user object and token
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', userData.token);
      
      setUser(userData);
      router.push('/dashboard');
    } catch (error: unknown) {
      console.error('Login failed:', error);
      const errorMessage = (error as { response?: { data?: { error?: string } } }).response?.data?.error || 'Login failed. Please check your credentials.';
      throw new Error(errorMessage);
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
    router.push('/login');
  };

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
        checkPolicy
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);