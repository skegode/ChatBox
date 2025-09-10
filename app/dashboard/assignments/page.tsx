// app/dashboard/contacts/page.tsx
'use client'

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { PERMISSIONS } from '../../../lib/permissions';
import api from '../../../lib/api'; // Use shared API instance

// --- Type Definitions ---
type Agent = {
  id: number;
  firstName: string;
  otherName: string;
  contactCount: number;
};

type Contact = {
  id: number;
  phoneNumber: string;
  assignedDate: string;
  lastMessage?: string;
};

type User = {
  id: number;
  role: string;
  [key: string]: unknown;
};

export default function ContactAssignmentPage() {  
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
  const [selectedAgentDetails, setSelectedAgentDetails] = useState<Agent | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Example: Load user from localStorage or context (adjust as needed)
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
  }, []);

  useEffect(() => {
    if (user?.role !== 'Admin') return;

    // Load agents
    api.get('/api/messages/agents')
      .then(res => setAgents(res.data))
      .catch(err => console.error('Failed to load agents', err));
  }, [user]);

  const handleAgentSelect = (agent: Agent) => {
    setSelectedAgent(agent.id);
    setSelectedAgentDetails(agent);

    api.get(`/api/messages/agents/${agent.id}/contacts`)
      .then(res => setContacts(res.data))
      .catch(err => console.error('Failed to load contacts', err));
      setShowModal(true);
  };

  const handleAssign = (contactPhone: string, agentId: number) => {
    api.post('/api/messages/contacts/assign', {
      contactPhoneNumber: contactPhone,
      agentId: agentId
    })
    .then(() => {
      // Refresh data after assignment
      if (selectedAgentDetails) handleAgentSelect(selectedAgentDetails);
    })
    .catch(err => console.error('Failed to assign contact', err));
  };

  return (
    <ProtectedRoute requiredPermissions={['adminOnly']} requiredPolicy={PERMISSIONS.POLICY_ADMIN_ONLY}>
      <div className="p-4">
        <div className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0"><i className="ri-contacts-line me-2" />Contact Assignment</h4> 
          <Link
            href="/dashboard"
          >
            <i className="ri-arrow-left-line me-2"></i>Dashboard
          </Link>
        </div>
        <hr />
        
        {/* Agent selection */}
        <div className="row">
          {agents.map(agent => (
            <a href='#' key={agent.id} className='col-md-4 mb-4'>
              <div className={`d-flex align-items-center rounded p-3 ${
                selectedAgent === agent.id
                  ? 'bg-light'
                  : 'border'
              }`}
              onClick={() => handleAgentSelect(agent)}>
                <div className="chat-user-img me-3 ms-0">
                  <div className="avatar-xs">
                      <span className="avatar-title rounded-circle bg-primary-subtle text-primary">
                          <i className="ri-user-3-line"></i>
                      </span>
                  </div>
                </div>
                <h5 className="flex-grow-1 mb-0">{agent.firstName} {agent.otherName}</h5>
                <span className="badge badge-soft-danger rounded-pill">{agent.contactCount}</span>
              </div>
            </a>
          ))}
        </div>
        
        {/* Contact management */}
        {selectedAgent && (
          <div className={`modal fade${showModal ? ' show d-block' : ''}`} tabIndex={-1} role="dialog" style={showModal ? { background: 'rgba(0,0,0,0.5)' } : {}}>
            <div className="modal-dialog modal-lg" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title text-blue-600">{selectedAgentDetails?.firstName} {selectedAgentDetails?.otherName}</h5>
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setShowModal(false)}></button>
                </div>
                <div className="modal-body">
                  {contacts.length === 0 ? (
                    <p className="text-gray-500">No contacts assigned to this agent</p>
                  ) : (
                    <ul className="list-group">
                      {contacts.map(contact => (
                        <li key={contact.id} className="list-group-item d-flex flex-column flex-md-row align-items-start justify-content-md-between gap-2 py-3">
                          <div>
                            <span className="font-mono text-lg text-dark">{contact.phoneNumber}</span> | 
                            <span className="ms-2 text-xs text-secondary">
                              {new Date(contact.assignedDate).toLocaleString()}
                            </span>
                            <p className="text-sm text-secondary mt-1">{contact.lastMessage || <span className="fst-italic text-muted">No messages</span>}</p>
                          </div>
                          {/* Reassignment dropdown */}
                          <div>
                            <select
                              className="form-select"
                              onChange={(e) => handleAssign(contact.phoneNumber, parseInt(e.target.value))}
                              defaultValue=""
                            >
                              <option value="" disabled>Reassign to...</option>
                              {agents.map(agent => (
                                <option key={agent.id} value={agent.id} disabled={agent.id === selectedAgent}>
                                  {agent.firstName} {agent.otherName}
                                </option>
                              ))}
                            </select>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}