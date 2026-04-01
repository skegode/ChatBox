// app/dashboard/layout.tsx
'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '../../components/layout/Sidebar';
import { useAuth } from '../../components/providers/AuthProvider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();

  // On mobile the `.user-chat` panel is hidden by default (CSS: visibility:hidden + translateX).
  // Add `.user-chat-show` when we're viewing a specific chat so the panel slides into view.
  const segments = pathname?.split('/').filter(Boolean) ?? [];
  // /dashboard/<chatId> has segments ['dashboard', '<chatId>']
  // Other sub-pages like /dashboard/settings also have 2+ segments but they aren't chat views.
  const knownSubPages = new Set([
    'settings', 'contacts', 'users', 'assignments', 'merchants',
    'prospects', 'influencers', 'stats', 'broadcast', 'selfOnboardedBorrowers',
  ]);
  const isViewingChat = segments.length >= 2 &&
    segments[0] === 'dashboard' &&
    !knownSubPages.has(segments[1].toLowerCase());

  const chatPanelClass = `user-chat w-100 overflow-hidden${isViewingChat ? ' user-chat-show' : ''}`;

  if (!isAuthenticated) {
    return <div className="layout-wrapper d-lg-flex">{children}</div>;
  }

  return (
    // Full-page layout without a navbar
    <div className="layout-wrapper d-lg-flex">
      {/* Sidebar is rendered (fixed); main content is offset to avoid overlap */}
      <Sidebar />
      <div className={chatPanelClass}>{children}</div>
    </div>
  );
}