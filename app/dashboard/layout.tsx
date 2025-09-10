// app/dashboard/layout.tsx
'use client';

import Sidebar from '../../components/layout/Sidebar';
import { useAuth } from '../../components/providers/AuthProvider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <div className="layout-wrapper d-lg-flex">{children}</div>;
  }

  return (
    // Full-page layout without a navbar
    <div className="layout-wrapper d-lg-flex">
      {/* Sidebar is rendered (fixed); main content is offset to avoid overlap */}
      <Sidebar />
      <div className="user-chat w-100 overflow-hidden">{children}</div>
    </div>
  );
}