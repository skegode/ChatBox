"use client";
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import api from '@/lib/api';
import chatAdapter from '@/lib/chatAdapter';
import normalizeContactId from '@/lib/normalizeContactId';

// Matches GET /api/Messages response (conversation summaries)
interface Conversation {
  contactId: string;
  contactName?: string | null;
  lastMessageText?: string | null;
  lastMessageTime?: string | null;
  unreadCount?: number;
  messageCount?: number;
  isLastMessageIncoming?: boolean | null;
  lastMessageStatus?: string | null;
  agentId?: number | null;
}

// Individual message from GET /api/Messages/contact/{contactId}
interface MessageDetail {
  id: number;
  isIncoming: boolean;
  sentBy?: number | null;
  senderName?: string | null;
  messageDateTime: string;
}

interface AgentActivity {
  agentId: number;
  agentName: string;
  lastReply: string;
  replyCount: number;
}

interface UserInfo {
  id: number;
  firstName?: string | null;
  otherName?: string | null;
}

// Per-conversation agent reply info
interface ConvoAgentInfo {
  lastRepliedBy?: number | null;
  lastRepliedByName?: string | null;
}

const StatsDashboard = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [usersMap, setUsersMap] = useState<Record<number, string>>({});
  const [convoAgentMap, setConvoAgentMap] = useState<Record<string, ConvoAgentInfo>>({});
  const [agentReplyData, setAgentReplyData] = useState<AgentActivity[]>([]);
  const usersMapRef = useRef<Record<number, string>>({});
  const [previewMessage, setPreviewMessage] = useState<{ text: string; time?: string | null; contactId?: string } | null>(null);

  // Full fetch: conversations + users + per-conversation agent data
  const fetchFullStats = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const [chatsRes, usersRes] = await Promise.all([
        api.get('/api/Chats'),
        api.get('/api/Users').catch(() => ({ data: [] })),
      ]);
      if (signal?.aborted) return;
      // Normalize conversation summaries from the Chats endpoint so field names are consistent
      const rawConvos = Array.isArray(chatsRes.data) ? chatsRes.data : [];
      const convos = chatAdapter.normalizeConversations(rawConvos) as Conversation[];
      setConversations(convos);

      const users: UserInfo[] = Array.isArray(usersRes.data) ? usersRes.data : [];
      const map: Record<number, string> = {};
      users.forEach(u => {
        const name = [u.firstName, u.otherName].filter(Boolean).join(' ').trim();
        if (name) map[u.id] = name;
      });
      setUsersMap(map);
      usersMapRef.current = map;

      const agentInfo: Record<string, ConvoAgentInfo> = {};
      const agentReplyCounter: Record<number, { name: string; lastReply: string; count: number }> = {};

      const batchSize = 5;
      for (let i = 0; i < convos.length; i += batchSize) {
        if (signal?.aborted) return;
        const batch = convos.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(c =>
              api.get(`/api/Messages/contact/${encodeURIComponent(c.contactId)}`)
              .then(r => ({ contactId: c.contactId, messages: Array.isArray(r.data) ? r.data as MessageDetail[] : [] }))
              .catch(() => ({ contactId: c.contactId, messages: [] as MessageDetail[] }))
          )
        );
        for (const { contactId, messages } of results) {
          const outgoing = messages
            .filter((m: MessageDetail) => !m.isIncoming && m.sentBy)
            .sort((a: MessageDetail, b: MessageDetail) => new Date(b.messageDateTime).getTime() - new Date(a.messageDateTime).getTime());
          if (outgoing.length > 0) {
            const last = outgoing[0];
            agentInfo[contactId] = {
              lastRepliedBy: last.sentBy,
              lastRepliedByName: last.senderName || (last.sentBy ? map[last.sentBy] : null) || null,
            };
            if (last.sentBy) {
              const agentName = last.senderName || map[last.sentBy] || `Agent #${last.sentBy}`;
              if (!agentReplyCounter[last.sentBy]) {
                agentReplyCounter[last.sentBy] = { name: agentName, lastReply: last.messageDateTime, count: 0 };
              }
              const agentOutgoing = messages.filter((m: MessageDetail) => !m.isIncoming && m.sentBy === last.sentBy);
              agentReplyCounter[last.sentBy].count += agentOutgoing.length;
              if (new Date(last.messageDateTime) > new Date(agentReplyCounter[last.sentBy].lastReply)) {
                agentReplyCounter[last.sentBy].lastReply = last.messageDateTime;
              }
            }
          }
        }
      }
      if (signal?.aborted) return;
      setConvoAgentMap(agentInfo);

      const activityList: AgentActivity[] = Object.entries(agentReplyCounter)
        .map(([id, data]) => ({ agentId: Number(id), agentName: data.name, lastReply: data.lastReply, replyCount: data.count }))
        .sort((a, b) => new Date(b.lastReply).getTime() - new Date(a.lastReply).getTime());
      setAgentReplyData(activityList);
    } catch (e) {
      console.error('Failed to fetch stats', e);
      if (!signal?.aborted) setConversations([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  // Lightweight refresh: only re-fetch conversation summaries for stat cards
  const fetchSummaryOnly = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await api.get('/api/Chats');
      if (signal?.aborted) return;
      const rawConvos = Array.isArray(res.data) ? res.data : [];
      const convos = chatAdapter.normalizeConversations(rawConvos) as Conversation[];
      setConversations(convos);
    } catch {
      // Silently ignore — cards keep showing last good data
    }
  }, []);

  // Initial full fetch + polling
  useEffect(() => {
    const controller = new AbortController();

    fetchFullStats(controller.signal);

    // Lightweight poll every 15s for stat card updates
    const summaryTimer = setInterval(() => {
      fetchSummaryOnly(controller.signal);
    }, 15_000);

    // Full refresh every 2 minutes for agent activity data
    const fullTimer = setInterval(() => {
      fetchFullStats(controller.signal);
    }, 120_000);

    return () => {
      controller.abort();
      clearInterval(summaryTimer);
      clearInterval(fullTimer);
    };
  }, [fetchFullStats, fetchSummaryOnly]);

  // Filter conversations by date range
  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      if (!c.lastMessageTime) return false;
      const msgDate = new Date(c.lastMessageTime);
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (msgDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (msgDate > end) return false;
      }
      return true;
    });
  }, [conversations, startDate, endDate]);

  // All stats derived from filtered conversations
  const totalConversations = filteredConversations.length;
  const totalMessages = filteredConversations.reduce((acc, c) => acc + (c.messageCount || 0), 0);
  const totalUnread = filteredConversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const conversationsWithUnread = filteredConversations.filter(c => (c.unreadCount || 0) > 0).length;
  // Awaiting reply: last message was from the customer (incoming) — agent hasn't responded yet
  const conversationsAwaitingReply = filteredConversations.filter(c => c.isLastMessageIncoming === true).length;

  return (
    <>
      <link rel="stylesheet" href="/fonts/remixicon.css" />
      <style>{`
        /* ===== SHARED (theme-independent) ===== */
        .stats-root {
          min-height: 100vh;
          font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
          transition: background 0.3s ease, color 0.3s ease;
        }
        .stats-header {
          backdrop-filter: blur(20px);
          transition: background 0.3s ease, border-color 0.3s ease;
        }
        .stat-card {
          position: relative;
          overflow: hidden;
          border-radius: 16px;
          padding: 24px;
          transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.3s ease;
          cursor: default;
        }
        .stat-card:hover {
          transform: translateY(-4px);
        }
        .stat-card::before {
          content: '';
          position: absolute;
          top: 0; right: 0;
          width: 100px; height: 100px;
          border-radius: 50%;
          filter: blur(40px);
          opacity: 0.3;
        }
        .stat-card .stat-icon {
          width: 52px; height: 52px;
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          font-size: 24px;
          margin-bottom: 16px;
          transition: background 0.3s ease;
        }
        .stat-card .stat-number {
          font-size: 2rem;
          font-weight: 800;
          letter-spacing: -0.5px;
          line-height: 1;
        }
        .stat-card .stat-label {
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-top: 6px;
        }
        .glass-panel {
          backdrop-filter: blur(16px);
          border-radius: 16px;
          transition: background 0.3s ease, border-color 0.3s ease;
        }
        .filter-bar {
          backdrop-filter: blur(12px);
          border-radius: 12px;
          transition: background 0.3s ease, border-color 0.3s ease;
        }
        .filter-bar input[type="date"] {
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 0.85rem;
          transition: background 0.3s ease, border-color 0.3s ease, color 0.3s ease;
        }
        .filter-bar input[type="date"]:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.3);
          outline: none;
        }
        .data-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
        }
        .data-table thead th {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          padding: 14px 16px;
          white-space: nowrap;
          transition: background 0.3s ease, color 0.3s ease;
        }
        .data-table thead th:first-child { border-radius: 10px 0 0 0; }
        .data-table thead th:last-child { border-radius: 0 10px 0 0; }
        .data-table tbody tr {
          transition: background 0.15s ease;
        }
        .data-table tbody td {
          padding: 12px 16px;
          font-size: 0.875rem;
          vertical-align: middle;
          transition: color 0.3s ease, border-color 0.3s ease;
        }
        .badge-pill {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.3px;
        }
        .badge-blue { background: rgba(59,130,246,0.2); color: #3b82f6; }
        .badge-red { background: rgba(239,68,68,0.2); color: #ef4444; }
        .badge-green { background: rgba(34,197,94,0.2); color: #16a34a; }
        .badge-amber { background: rgba(245,158,11,0.2); color: #d97706; }
        .badge-cyan { background: rgba(6,182,212,0.2); color: #0891b2; }
        .badge-slate { background: rgba(148,163,184,0.15); color: #64748b; }
        .btn-glass {
          border-radius: 8px;
          padding: 6px 14px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .pulse-loader {
          display: inline-block;
          width: 12px; height: 12px;
          border-radius: 50%;
          background: #3b82f6;
          animation: pulse 1.2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        .section-title {
          font-size: 1rem;
          font-weight: 700;
          letter-spacing: 0.3px;
        }

        /* ===== DARK THEME ===== */
        body[data-theme="dark"] .stats-root {
          background: linear-gradient(145deg, #0a1628 0%, #0f2847 40%, #132e54 70%, #0d1f3c 100%);
          color: #e2eafc;
        }
        body[data-theme="dark"] .stats-header {
          background: linear-gradient(135deg, rgba(37,99,235,0.15) 0%, rgba(14,45,92,0.3) 100%);
          border-bottom: 1px solid rgba(96,165,250,0.15);
        }
        body[data-theme="dark"] .stat-card { border: 1px solid rgba(96,165,250,0.12); }
        body[data-theme="dark"] .stat-card:hover { box-shadow: 0 12px 40px rgba(37,99,235,0.25); }
        body[data-theme="dark"] .stat-card-1 { background: linear-gradient(135deg, #0c2d5e 0%, #1a4a8a 100%); }
        body[data-theme="dark"] .stat-card-1::before { background: #3b82f6; }
        body[data-theme="dark"] .stat-card-2 { background: linear-gradient(135deg, #0e3668 0%, #1d5099 100%); }
        body[data-theme="dark"] .stat-card-2::before { background: #60a5fa; }
        body[data-theme="dark"] .stat-card-3 { background: linear-gradient(135deg, #0b2652 0%, #16407a 100%); }
        body[data-theme="dark"] .stat-card-3::before { background: #2563eb; }
        body[data-theme="dark"] .stat-card-4 { background: linear-gradient(135deg, #0d2e5c 0%, #1b4b8d 100%); }
        body[data-theme="dark"] .stat-card-4::before { background: #38bdf8; }
        body[data-theme="dark"] .stat-card-5 { background: linear-gradient(135deg, #0f3469 0%, #1c4f96 100%); }
        body[data-theme="dark"] .stat-card-5::before { background: #818cf8; }
        body[data-theme="dark"] .stat-card-6 { background: linear-gradient(135deg, #0c2b57 0%, #174283 100%); }
        body[data-theme="dark"] .stat-card-6::before { background: #06b6d4; }
        body[data-theme="dark"] .stat-card .stat-icon {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.1);
        }
        body[data-theme="dark"] .stat-card .stat-icon i { color: #60a5fa; }
        body[data-theme="dark"] .stat-card .stat-number { color: #ffffff; }
        body[data-theme="dark"] .stat-card .stat-label { color: rgba(191,219,254,0.7); }
        body[data-theme="dark"] .glass-panel {
          background: rgba(15,40,71,0.6);
          border: 1px solid rgba(96,165,250,0.1);
        }
        body[data-theme="dark"] .filter-bar {
          background: rgba(15,40,71,0.5);
          border: 1px solid rgba(96,165,250,0.12);
        }
        body[data-theme="dark"] .filter-bar input[type="date"] {
          background: rgba(10,22,40,0.8);
          border: 1px solid rgba(96,165,250,0.2);
          color: #bfdbfe;
        }
        body[data-theme="dark"] .filter-bar input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(0.7) sepia(1) saturate(3) hue-rotate(190deg);
        }
        body[data-theme="dark"] .data-table thead th {
          background: rgba(37,99,235,0.15);
          color: #93bbfd;
          border-bottom: 1px solid rgba(96,165,250,0.1);
        }
        body[data-theme="dark"] .data-table tbody tr:hover { background: rgba(37,99,235,0.08); }
        body[data-theme="dark"] .data-table tbody td {
          border-bottom: 1px solid rgba(96,165,250,0.06);
          color: #c7d7f0;
        }
        body[data-theme="dark"] .badge-blue { background: rgba(59,130,246,0.2); color: #60a5fa; }
        body[data-theme="dark"] .badge-red { background: rgba(239,68,68,0.2); color: #f87171; }
        body[data-theme="dark"] .badge-green { background: rgba(34,197,94,0.2); color: #4ade80; }
        body[data-theme="dark"] .badge-amber { background: rgba(245,158,11,0.2); color: #fbbf24; }
        body[data-theme="dark"] .badge-cyan { background: rgba(6,182,212,0.2); color: #22d3ee; }
        body[data-theme="dark"] .badge-slate { background: rgba(148,163,184,0.15); color: #94a3b8; }
        body[data-theme="dark"] .btn-glass {
          background: rgba(59,130,246,0.15);
          border: 1px solid rgba(96,165,250,0.2);
          color: #93bbfd;
        }
        body[data-theme="dark"] .btn-glass:hover {
          background: rgba(59,130,246,0.25);
          border-color: #3b82f6;
          color: #bfdbfe;
        }
        body[data-theme="dark"] .agent-name { color: #60a5fa; font-weight: 600; }
        body[data-theme="dark"] .section-title { color: #93bbfd; }

        /* ===== LIGHT THEME ===== */
        body[data-theme="light"] .stats-root {
          background: #f0f4f8;
          color: #1e293b;
        }
        body[data-theme="light"] .stats-root h1 { color: #0f172a !important; }
        body[data-theme="light"] .stats-root h5 { color: #1e293b !important; }
        body[data-theme="light"] .stats-header {
          background: linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(255,255,255,0.9) 100%);
          border-bottom: 1px solid #e2e8f0;
        }
        body[data-theme="light"] .stat-card { border: 1px solid #e2e8f0; }
        body[data-theme="light"] .stat-card:hover { box-shadow: 0 12px 40px rgba(59,130,246,0.12); }
        body[data-theme="light"] .stat-card-1 { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); }
        body[data-theme="light"] .stat-card-1::before { background: #3b82f6; }
        body[data-theme="light"] .stat-card-2 { background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); }
        body[data-theme="light"] .stat-card-2::before { background: #0ea5e9; }
        body[data-theme="light"] .stat-card-3 { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); }
        body[data-theme="light"] .stat-card-3::before { background: #f59e0b; }
        body[data-theme="light"] .stat-card-4 { background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%); }
        body[data-theme="light"] .stat-card-4::before { background: #ec4899; }
        body[data-theme="light"] .stat-card-5 { background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%); }
        body[data-theme="light"] .stat-card-5::before { background: #8b5cf6; }
        body[data-theme="light"] .stat-card-6 { background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); }
        body[data-theme="light"] .stat-card-6::before { background: #10b981; }
        body[data-theme="light"] .stat-card .stat-icon {
          background: rgba(255,255,255,0.7);
          border: 1px solid rgba(0,0,0,0.06);
        }
        body[data-theme="light"] .stat-card .stat-icon i { color: #1e40af; }
        body[data-theme="light"] .stat-card .stat-number { color: #0f172a; }
        body[data-theme="light"] .stat-card .stat-label { color: #475569; }
        body[data-theme="light"] .glass-panel {
          background: #ffffff;
          border: 1px solid #e2e8f0;
        }
        body[data-theme="light"] .filter-bar {
          background: #ffffff;
          border: 1px solid #e2e8f0;
        }
        body[data-theme="light"] .filter-bar input[type="date"] {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          color: #334155;
        }
        body[data-theme="light"] .data-table thead th {
          background: #f1f5f9;
          color: #475569;
          border-bottom: 1px solid #e2e8f0;
        }
        body[data-theme="light"] .data-table tbody tr:hover { background: #f8fafc; }
        body[data-theme="light"] .data-table tbody td {
          border-bottom: 1px solid #f1f5f9;
          color: #334155;
        }
        body[data-theme="light"] .btn-glass {
          background: rgba(59,130,246,0.1);
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
        }
        body[data-theme="light"] .btn-glass:hover {
          background: rgba(59,130,246,0.2);
          border-color: #3b82f6;
          color: #1e40af;
        }
        body[data-theme="light"] .agent-name { color: #1d4ed8; font-weight: 600; }
        body[data-theme="light"] .section-title { color: #1e40af; }

        /* Theme-aware utility classes for inline elements */
        .stats-title { font-size: 1.6rem; font-weight: 800; margin: 0; letter-spacing: -0.3px; }
        .stats-subtitle { font-size: 0.85rem; margin: 4px 0 0; }
        .stats-meta { font-size: 0.75rem; }
        .stats-empty-icon { font-size: 2rem; display: block; margin-bottom: 8px; opacity: 0.5; }
        .stats-contact-name { font-weight: 600; }
        .stats-avatar {
          width: 34px; height: 34px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.8rem; font-weight: 700; color: #fff; flex-shrink: 0;
        }
        .stats-dash { color: #94a3b8; }

        body[data-theme="dark"] .stats-title { color: #ffffff; }
        body[data-theme="dark"] .stats-subtitle { color: rgba(147,187,253,0.6); }
        body[data-theme="dark"] .stats-meta { color: rgba(147,187,253,0.5); }
        body[data-theme="dark"] .stats-empty-icon { color: #60a5fa; }
        body[data-theme="dark"] .stats-contact-name { color: #bfdbfe; }
        body[data-theme="dark"] .stats-avatar { background: linear-gradient(135deg, #1e40af, #3b82f6); }
        body[data-theme="dark"] .stats-dash { color: #475569; }
        body[data-theme="dark"] .accent-icon { color: #60a5fa; }

        body[data-theme="light"] .stats-title { color: #0f172a; }
        body[data-theme="light"] .stats-subtitle { color: #64748b; }
        body[data-theme="light"] .stats-meta { color: #94a3b8; }
        body[data-theme="light"] .stats-empty-icon { color: #3b82f6; }
        body[data-theme="light"] .stats-contact-name { color: #1e293b; }
        body[data-theme="light"] .stats-avatar { background: linear-gradient(135deg, #2563eb, #60a5fa); }
        body[data-theme="light"] .stats-dash { color: #cbd5e1; }
        body[data-theme="light"] .accent-icon { color: #1e40af; }
      `}</style>

      <div className="stats-root">
        {/* Header */}
        <div className="stats-header px-4 py-4">
          <div className="container">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
              <div>
                <h1 className="stats-title">
                  <i className="ri-bar-chart-box-line me-2 accent-icon"></i>
                  Analytics Dashboard
                </h1>
                <p className="stats-subtitle">
                  Real-time messaging insights &amp; agent performance
                </p>
              </div>
              <div className="d-flex align-items-center gap-2">
                <span className="stats-meta">
                  <i className="ri-refresh-line me-1"></i>
                  Auto-refresh on load
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="container py-4">
          {/* Date Filter Bar */}
          <div className="filter-bar p-3 mb-4 d-flex align-items-center gap-3 flex-wrap">
            <div className="d-flex align-items-center gap-2">
              <i className="ri-filter-3-line" style={{ fontSize: '1.1rem' }}></i>
              <span className="section-title" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filter</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <label className="stats-meta" style={{ fontWeight: 600 }}>From</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className="d-flex align-items-center gap-2">
              <label className="stats-meta" style={{ fontWeight: 600 }}>To</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
            {(startDate || endDate) && (
              <button className="btn-glass" onClick={() => { setStartDate(''); setEndDate(''); }}>
                <i className="ri-close-line me-1"></i> Clear
              </button>
            )}
            {(startDate || endDate) && (
                  <span className="stats-meta" style={{ marginLeft: 'auto' }}>
                {filteredConversations.length} of {conversations.length} conversations
              </span>
            )}
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="d-flex align-items-center justify-content-center gap-3">
                <span className="pulse-loader"></span>
                <span className="pulse-loader" style={{ animationDelay: '0.3s' }}></span>
                <span className="pulse-loader" style={{ animationDelay: '0.6s' }}></span>
              </div>
              <p className="stats-subtitle" style={{ marginTop: 16 }}>Loading analytics...</p>
            </div>
          ) : (
            <>
              {/* Stat Cards Grid */}
              <div className="row g-3 mb-4">
                {[
                  { cls: 'stat-card-1', icon: 'ri-chat-3-line', label: 'Total Conversations', value: totalConversations },
                  { cls: 'stat-card-2', icon: 'ri-message-3-line', label: 'Total Messages', value: totalMessages },
                  { cls: 'stat-card-3', icon: 'ri-mail-unread-line', label: 'Unread Messages', value: totalUnread },
                  { cls: 'stat-card-4', icon: 'ri-chat-off-line', label: 'With Unread', value: conversationsWithUnread },
                  { cls: 'stat-card-5', icon: 'ri-time-line', label: 'Awaiting Reply', value: conversationsAwaitingReply },
                  { cls: 'stat-card-6', icon: 'ri-team-line', label: 'Active Agents', value: agentReplyData.length },
                ].map((card, idx) => (
                  <div className="col-lg-4 col-md-6" key={idx}>
                    <div className={`stat-card ${card.cls}`}>
                      <div className="stat-icon">
                        <i className={card.icon}></i>
                      </div>
                      <div className="stat-number">{card.value}</div>
                      <div className="stat-label">{card.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Conversation Activity Table */}
              <div className="glass-panel p-4 mb-4">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h5 className="section-title mb-0">
                    <i className="ri-pulse-line me-2"></i> Conversation Activity
                  </h5>
                  <span className="stats-meta">
                    {filteredConversations.length} conversations
                  </span>
                </div>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th><i className="ri-user-3-line me-1"></i> Contact</th>
                        <th><i className="ri-chat-1-line me-1"></i> Last Message</th>
                        <th><i className="ri-calendar-line me-1"></i> Interaction</th>
                        <th><i className="ri-hashtag me-1"></i> Msgs</th>
                        <th><i className="ri-eye-off-line me-1"></i> Unread</th>
                        <th><i className="ri-arrow-left-right-line me-1"></i> Direction</th>
                        <th><i className="ri-user-star-line me-1"></i> Replied By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredConversations.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '32px 16px' }}>
                            <i className="ri-inbox-2-line stats-empty-icon"></i>
                            {(startDate || endDate) ? 'No conversations in the selected date range.' : 'No conversations found.'}
                          </td>
                        </tr>
                      ) : (
                        [...filteredConversations]
                          .sort((a, b) => new Date(b.lastMessageTime || 0).getTime() - new Date(a.lastMessageTime || 0).getTime())
                          .map(c => (
                            <tr key={`${normalizeContactId(c.contactId) || 'c'}-${idx}`}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div className="stats-avatar">
                                    {(c.contactName || c.contactId).charAt(0).toUpperCase()}
                                  </div>
                                  <span className="stats-contact-name">
                                    {c.contactName || c.contactId}
                                  </span>
                                </div>
                              </td>
                              <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: c.lastMessageText ? 'pointer' : 'default' }}
                                  title={c.lastMessageText || ''}
                                  onClick={() => { if (c.lastMessageText) setPreviewMessage({ text: c.lastMessageText || '', time: c.lastMessageTime || null, contactId: c.contactId }); }}>
                                {c.lastMessageText || '—'}
                              </td>
                              <td style={{ whiteSpace: 'nowrap' }}>
                                {c.lastMessageTime ? new Date(c.lastMessageTime).toLocaleString() : '—'}
                              </td>
                              <td><span className="badge-pill badge-blue">{c.messageCount || 0}</span></td>
                              <td>
                                {(c.unreadCount || 0) > 0
                                  ? <span className="badge-pill badge-red">{c.unreadCount}</span>
                                  : <span className="badge-pill badge-green">0</span>}
                              </td>
                              <td>
                                {(c.unreadCount || 0) > 0
                                  ? <span className="badge-pill badge-amber"><i className="ri-arrow-down-s-line me-1"></i>In</span>
                                  : <span className="badge-pill badge-cyan"><i className="ri-arrow-up-s-line me-1"></i>Out</span>}
                              </td>
                              <td>
                                {convoAgentMap[c.contactId]?.lastRepliedByName
                                  ? <span className="agent-name">
                                      <i className="ri-user-star-fill me-1 accent-icon"></i>
                                      {convoAgentMap[c.contactId].lastRepliedByName}
                                    </span>
                                  : <span className="stats-dash">—</span>}
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Agent Reply Activity Table */}
              <div className="glass-panel p-4">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h5 className="section-title mb-0">
                    <i className="ri-team-fill me-2"></i> Agent Performance
                  </h5>
                  <span className="stats-meta">
                    {agentReplyData.length} agents
                  </span>
                </div>
                {agentReplyData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <i className="ri-user-search-line stats-empty-icon"></i>
                    No agent replies found.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th><i className="ri-user-star-line me-1"></i> Agent</th>
                          <th><i className="ri-reply-line me-1"></i> Replies Sent</th>
                          <th><i className="ri-time-line me-1"></i> Last Active</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agentReplyData.map(a => (
                          <tr key={a.agentId}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div className="stats-avatar">
                                  {a.agentName.charAt(0).toUpperCase()}
                                </div>
                                <span className="agent-name">{a.agentName}</span>
                              </div>
                            </td>
                            <td><span className="badge-pill badge-blue">{a.replyCount}</span></td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              {new Date(a.lastReply).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              {/* Last message preview modal */}
              {previewMessage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <div className="bg-white rounded shadow-lg w-full max-w-lg p-4">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h5 className="mb-0">Last Message Preview</h5>
                      <button onClick={() => setPreviewMessage(null)} className="btn btn-sm btn-light">Close</button>
                    </div>
                    <div style={{ fontSize: '0.95rem', color: '#111' }}>
                      <div style={{ marginBottom: 8, color: '#6b7280' }}>
                        {previewMessage.contactId ? `Contact: ${previewMessage.contactId}` : ''}
                        {previewMessage.time ? ` • ${new Date(previewMessage.time).toLocaleString()}` : ''}
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{previewMessage.text}</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default StatsDashboard;
