"use client";
import React, { useEffect, useState, useMemo } from 'react';
import api from '@/lib/api';

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

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const [messagesRes, usersRes] = await Promise.all([
          api.get('api/Messages'),
          api.get('api/Users').catch(() => ({ data: [] })),
        ]);
        const convos: Conversation[] = Array.isArray(messagesRes.data) ? messagesRes.data : [];
        setConversations(convos);

        // Build user ID → name map
        const users: UserInfo[] = Array.isArray(usersRes.data) ? usersRes.data : [];
        const map: Record<number, string> = {};
        users.forEach(u => {
          const name = [u.firstName, u.otherName].filter(Boolean).join(' ').trim();
          if (name) map[u.id] = name;
        });
        setUsersMap(map);

        // Fetch individual messages for each conversation to get agent reply info
        // Process in batches of 5 to avoid overwhelming the API
        const agentInfo: Record<string, ConvoAgentInfo> = {};
        const agentReplyCounter: Record<number, { name: string; lastReply: string; count: number }> = {};

        const batchSize = 5;
        for (let i = 0; i < convos.length; i += batchSize) {
          const batch = convos.slice(i, i + batchSize);
          const results = await Promise.all(
            batch.map(c =>
              api.get(`api/Messages/contact/${encodeURIComponent(c.contactId)}`)
                .then(r => ({ contactId: c.contactId, messages: Array.isArray(r.data) ? r.data as MessageDetail[] : [] }))
                .catch(() => ({ contactId: c.contactId, messages: [] as MessageDetail[] }))
            )
          );
          for (const { contactId, messages } of results) {
            // Debug: log first message structure to see available fields
            if (i === 0 && messages.length > 0) {
              console.log('Stats - first individual message ALL keys:', Object.keys(messages[0]));
              console.log('Stats - first individual message:', JSON.stringify(messages[0]));
              const outMsgs = messages.filter((m: any) => !m.isIncoming);
              if (outMsgs.length > 0) {
                console.log('Stats - first OUTGOING message keys:', Object.keys(outMsgs[0]));
                console.log('Stats - first OUTGOING message:', JSON.stringify(outMsgs[0]));
              } else {
                console.log('Stats - NO outgoing messages in first conversation');
              }
            }
            // Find last outgoing message (agent reply)
            const outgoing = messages
              .filter((m: MessageDetail) => !m.isIncoming && m.sentBy)
              .sort((a: MessageDetail, b: MessageDetail) => new Date(b.messageDateTime).getTime() - new Date(a.messageDateTime).getTime());
            if (outgoing.length > 0) {
              const last = outgoing[0];
              agentInfo[contactId] = {
                lastRepliedBy: last.sentBy,
                lastRepliedByName: last.senderName || (last.sentBy ? map[last.sentBy] : null) || null,
              };
              // Track per-agent reply stats
              if (last.sentBy) {
                const agentName = last.senderName || map[last.sentBy] || `Agent #${last.sentBy}`;
                if (!agentReplyCounter[last.sentBy]) {
                  agentReplyCounter[last.sentBy] = { name: agentName, lastReply: last.messageDateTime, count: 0 };
                }
                // Count all outgoing messages by each agent in this conversation
                const agentOutgoing = messages.filter((m: MessageDetail) => !m.isIncoming && m.sentBy === last.sentBy);
                agentReplyCounter[last.sentBy].count += agentOutgoing.length;
                if (new Date(last.messageDateTime) > new Date(agentReplyCounter[last.sentBy].lastReply)) {
                  agentReplyCounter[last.sentBy].lastReply = last.messageDateTime;
                }
              }
            }
          }
        }
        setConvoAgentMap(agentInfo);

        // Build agent activity from actual reply data
        const activityList: AgentActivity[] = Object.entries(agentReplyCounter)
          .map(([id, data]) => ({ agentId: Number(id), agentName: data.name, lastReply: data.lastReply, replyCount: data.count }))
          .sort((a, b) => new Date(b.lastReply).getTime() - new Date(a.lastReply).getTime());
        setAgentReplyData(activityList);
      } catch (e) {
        console.error('Failed to fetch stats', e);
        setConversations([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

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
  // Awaiting reply: unread > 0 means customer sent something and no agent has replied yet
  const conversationsAwaitingReply = filteredConversations.filter(c => (c.unreadCount || 0) > 0).length;

  return (
    <div className="container py-4" style={{ background: 'linear-gradient(135deg, #e3f0ff 0%, #ffffff 100%)', minHeight: '100vh' }}>
      {/* Remix Icon stylesheet */}
      <link rel="stylesheet" href="/fonts/remixicon.css" />
      <h2 className="mb-4 fw-bold text-center" style={{ color: '#2563eb' }}>Messaging Statistics</h2>
      {/* Date Filter */}
      <div className="card p-3 mb-4 border-0 shadow-sm d-flex flex-row align-items-center gap-3 flex-wrap" style={{ background: '#e3f0ff' }}>
        <div className="d-flex align-items-center gap-2">
          <i className="ri-calendar-line ri-lg" style={{ color: '#2563eb' }}></i>
          <label className="fw-semibold mb-0" style={{ color: '#2563eb' }}>From:</label>
          <input
            type="date"
            className="form-control form-control-sm"
            style={{ maxWidth: 180, borderColor: '#2563eb' }}
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>
        <div className="d-flex align-items-center gap-2">
          <label className="fw-semibold mb-0" style={{ color: '#2563eb' }}>To:</label>
          <input
            type="date"
            className="form-control form-control-sm"
            style={{ maxWidth: 180, borderColor: '#2563eb' }}
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </div>
        {(startDate || endDate) && (
          <button
            className="btn btn-sm btn-outline-primary"
            onClick={() => { setStartDate(''); setEndDate(''); }}
          >
            <i className="ri-close-line me-1"></i> Clear Filter
          </button>
        )}
        {(startDate || endDate) && (
          <span className="text-muted small ms-auto">
            Showing {filteredConversations.length} of {conversations.length} conversations
          </span>
        )}
      </div>
      {loading ? (
        <div className="text-center text-primary"><i className="ri-loader-4-line ri-2x spin"></i> Loading...</div>
      ) : (
        <>
          <div className="row mb-4">
            <div className="col-md-4">
              <div className="card p-4 mb-3 border-0 shadow-sm" style={{ background: '#f0f6ff' }}>
                <h5 className="fw-semibold mb-2 d-flex align-items-center" style={{ color: '#2563eb' }}>
                  <i className="ri-chat-1-line ri-xl me-2" style={{ color: '#2563eb' }}></i> Total Conversations
                </h5>
                <div className="display-6 fw-bold d-flex align-items-center" style={{ color: '#1e40af' }}>
                  <i className="ri-chat-1-fill ri-2x me-2" style={{ color: '#1e40af' }}></i> {totalConversations}
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card p-4 mb-3 border-0 shadow-sm" style={{ background: '#e0eaff' }}>
                <h5 className="fw-semibold mb-2 d-flex align-items-center" style={{ color: '#2563eb' }}>
                  <i className="ri-message-3-line ri-xl me-2" style={{ color: '#2563eb' }}></i> Total Messages
                </h5>
                <div className="display-6 fw-bold d-flex align-items-center" style={{ color: '#1e40af' }}>
                  <i className="ri-message-3-fill ri-2x me-2" style={{ color: '#1e40af' }}></i> {totalMessages}
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card p-4 mb-3 border-0 shadow-sm" style={{ background: '#dbeafe' }}>
                <h5 className="fw-semibold mb-2 d-flex align-items-center" style={{ color: '#2563eb' }}>
                  <i className="ri-mail-unread-line ri-xl me-2" style={{ color: '#2563eb' }}></i> Unread Messages
                </h5>
                <div className="display-6 fw-bold d-flex align-items-center" style={{ color: '#1e40af' }}>
                  <i className="ri-notification-badge-line ri-2x me-2" style={{ color: '#1e40af' }}></i> {totalUnread}
                </div>
              </div>
            </div>
          </div>
          <div className="row mb-4">
            <div className="col-md-4">
              <div className="card p-4 mb-3 border-0 shadow-sm" style={{ background: '#f0f6ff' }}>
                <h5 className="fw-semibold mb-2 d-flex align-items-center" style={{ color: '#2563eb' }}>
                  <i className="ri-chat-voice-line ri-xl me-2" style={{ color: '#2563eb' }}></i> Conversations With Unread
                </h5>
                <div className="display-6 fw-bold d-flex align-items-center" style={{ color: '#1e40af' }}>
                  <i className="ri-chat-voice-fill ri-2x me-2" style={{ color: '#1e40af' }}></i> {conversationsWithUnread}
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card p-4 mb-3 border-0 shadow-sm" style={{ background: '#e0eaff' }}>
                <h5 className="fw-semibold mb-2 d-flex align-items-center" style={{ color: '#2563eb' }}>
                  <i className="ri-time-line ri-xl me-2" style={{ color: '#2563eb' }}></i> Awaiting Reply
                </h5>
                <div className="display-6 fw-bold d-flex align-items-center" style={{ color: '#1e40af' }}>
                  <i className="ri-timer-flash-line ri-2x me-2" style={{ color: '#1e40af' }}></i> {conversationsAwaitingReply}
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card p-4 mb-3 border-0 shadow-sm" style={{ background: '#dbeafe' }}>
                <h5 className="fw-semibold mb-2 d-flex align-items-center" style={{ color: '#2563eb' }}>
                  <i className="ri-team-line ri-xl me-2" style={{ color: '#2563eb' }}></i> Active Agents
                </h5>
                <div className="display-6 fw-bold d-flex align-items-center" style={{ color: '#1e40af' }}>
                  <i className="ri-team-fill ri-2x me-2" style={{ color: '#1e40af' }}></i> {agentReplyData.length}
                </div>
              </div>
            </div>
          </div>
          <div className="card p-4 border-0 shadow-sm mb-4" style={{ background: '#f8fafc' }}>
            <h5 className="fw-semibold mb-3 d-flex align-items-center" style={{ color: '#2563eb' }}>
              <i className="ri-calendar-event-line ri-xl me-2"></i> Conversation Activity
            </h5>
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr style={{ color: '#2563eb' }}>
                    <th><i className="ri-user-line me-1"></i> Contact</th>
                    <th><i className="ri-message-2-line me-1"></i> Last Message</th>
                    <th><i className="ri-calendar-line me-1"></i> Last Interaction</th>
                    <th><i className="ri-chat-3-line me-1"></i> Messages</th>
                    <th><i className="ri-notification-badge-line me-1"></i> Unread</th>
                    <th><i className="ri-arrow-left-right-line me-1"></i> Direction</th>
                    <th><i className="ri-user-star-line me-1"></i> Replied By</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredConversations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center" style={{ color: '#2563eb' }}>
                        <i className="ri-inbox-line ri-xl me-2"></i> {(startDate || endDate) ? 'No conversations found for the selected date range.' : 'No conversations found.'}
                      </td>
                    </tr>

                  ) : (
                    [...filteredConversations]
                      .sort((a, b) => new Date(b.lastMessageTime || 0).getTime() - new Date(a.lastMessageTime || 0).getTime())
                      .map(c => (
                        <tr key={c.contactId}>
                          <td className="fw-semibold" style={{ color: '#1e40af' }}>{c.contactName || c.contactId}</td>
                          <td className="text-truncate" style={{ maxWidth: 200 }}>{c.lastMessageText || '—'}</td>
                          <td>
                            <i className="ri-time-line me-1 text-muted"></i>
                            {c.lastMessageTime ? new Date(c.lastMessageTime).toLocaleString() : '—'}
                          </td>
                          <td><span className="badge bg-primary rounded-pill">{c.messageCount || 0}</span></td>
                          <td>
                            {(c.unreadCount || 0) > 0
                              ? <span className="badge bg-danger rounded-pill">{c.unreadCount}</span>
                              : <span className="badge bg-success rounded-pill">0</span>}
                          </td>
                          <td>
                            {(c.unreadCount || 0) > 0
                              ? <span className="badge bg-warning text-dark"><i className="ri-arrow-down-line me-1"></i>Incoming</span>
                              : <span className="badge bg-info text-white"><i className="ri-arrow-up-line me-1"></i>Outgoing</span>}
                          </td>
                          <td>
                            {convoAgentMap[c.contactId]?.lastRepliedByName
                              ? <span className="fw-semibold" style={{ color: '#1e40af' }}>
                                  <i className="ri-user-star-line me-1"></i>
                                  {convoAgentMap[c.contactId].lastRepliedByName}
                                </span>
                              : <span className="text-muted">—</span>}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card p-4 border-0 shadow-sm" style={{ background: '#f8fafc' }}>
            <h5 className="fw-semibold mb-3" style={{ color: '#2563eb' }}>
              <i className="ri-team-line ri-xl me-2"></i> Agent Reply Activity
            </h5>
            {agentReplyData.length === 0 ? (
              <div className="text-center py-3" style={{ color: '#2563eb' }}>
                <i className="ri-user-search-line ri-xl me-2"></i> No agent replies found.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead>
                    <tr style={{ color: '#2563eb' }}>
                      <th><i className="ri-user-star-line me-1"></i> Agent</th>
                      <th><i className="ri-message-2-line me-1"></i> Replies Sent</th>
                      <th><i className="ri-time-line me-1"></i> Last Reply</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentReplyData.map(a => (
                      <tr key={a.agentId}>
                        <td className="fw-semibold" style={{ color: '#1e40af' }}>
                          <i className="ri-user-star-fill me-1"></i> {a.agentName}
                        </td>
                        <td><span className="badge bg-primary rounded-pill">{a.replyCount}</span></td>
                        <td className="text-muted">
                          <i className="ri-time-line me-1"></i> {new Date(a.lastReply).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default StatsDashboard;
