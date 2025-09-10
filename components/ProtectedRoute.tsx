// app/components/ProtectedRoute.tsx
'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './providers/AuthProvider';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermissions?: string[];
  requiredPolicy?: string;
}

const ProtectedRoute = ({ 
  children, 
  requiredPermissions = [], 
  requiredPolicy 
}: ProtectedRouteProps) => {
  const { isAuthenticated, hasPermission, checkPolicy } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // First check if user is authenticated
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    // Check policy if specified
    if (requiredPolicy && !checkPolicy(requiredPolicy)) {
      router.replace('/dashboard');
      return;
    }

    // Check individual permissions if specified
    const hasAllPermissions = requiredPermissions.every(permission => 
      hasPermission(permission)
    );

    if (requiredPermissions.length > 0 && !hasAllPermissions) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, hasPermission, checkPolicy, requiredPermissions, requiredPolicy, router]);

  return <>{children}</>;
};

export default ProtectedRoute;