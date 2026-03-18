// app/dashboard/page.tsx
//Dashboard Page (Everyone who is authenticated)
'use client';

import ProtectedRoute from '../../components/ProtectedRoute';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div className="w-100 d-flex align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
          <div className="text-center">
            <div className="welcome-icon-box" style={{ width: 80, height: 80, borderRadius: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <i className="ri-message-3-line" style={{ fontSize: 36 }} />
            </div>
            <h2 className="welcome-title mb-2">Welcome to Customer Desk</h2>
            <p className="welcome-subtitle" style={{ maxWidth: 400 }}>
              Select a chat from the sidebar or start a new conversation
            </p>
          </div>
        </div>
    </ProtectedRoute>
  );
}
