// app/dashboard/page.tsx
//Dashboard Page (Everyone who is authenticated)
'use client';

import ProtectedRoute from '../../components/ProtectedRoute';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div className="w-100 h-full text-center p-4">
          <h2 className="mb-2">Welcome to Customer Desk</h2>
          <p className="text-muted">
            Select a chat from the sidebar or start a new conversation
          </p>
        </div>
    </ProtectedRoute>
  );
}
