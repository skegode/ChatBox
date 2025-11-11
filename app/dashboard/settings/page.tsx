"use client";
import React, { useState, useEffect } from "react";
import ProtectedRoute from '../../../components/ProtectedRoute';
import api from '../../../lib/api';
import { PERMISSIONS } from '../../../lib/permissions';

interface AgentStatusPayload {
  isActive?: boolean;
}

function getErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err) ?? 'Unknown error';
  } catch {
    return 'Unknown error';
  }
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentActive, setAgentActive] = useState<boolean | null>(null);

  // Fetch current status on mount
  useEffect(() => {
    let mounted = true;
    async function fetchStatus() {
      setLoading(true);
      setError(null);
      try {
        const resp = await api.get<AgentStatusPayload>('/api/ai-agent/status');
        if (mounted) setAgentActive(Boolean(resp.data?.isActive));
      } catch (err: unknown) {
        if (mounted) setError(getErrorMessage(err) || "Failed to fetch agent status");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchStatus();
    return () => { mounted = false; };
  }, []);

  async function toggleAgent() {
    if (agentActive === null) return;
    setLoading(true);
    setError(null);
    try {
      if (agentActive) {
        await api.post('/api/ai-agent/deactivate');
        setAgentActive(false);
      } else {
        await api.post('/api/ai-agent/activate');
        setAgentActive(true);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err) || "Failed to update agent status");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProtectedRoute requiredPermissions={['adminOnly']} requiredPolicy={PERMISSIONS.POLICY_ADMIN_ONLY}>
      <div className="w-100 overflow-hidden position-relative">
        {/* Fixed Header */}
        <div className="p-3 p-lg-4 border-bottom user-chat-topbar">
          <h4 className="mb-0"><i className="ri-settings-line me-2" />Settings</h4>
        </div>

        {/* Scrollable Content */}
        <div className="chat-conversation p-3 p-lg-4" style={{ height: 'calc(100vh - 140px)', overflowY: 'auto' }}>
          <div className="container-fluid">
            <div className="row justify-content-center">
              <div className="col-md-8">
                <div className="card shadow-sm">
                  <div className="card-body p-4">
                    <div className="text-center mb-4">
                      <i className="ri-settings-3-line fs-1 text-primary mb-3 d-block"></i>
                      <h3 className="text-primary mb-2">Application Settings</h3>
                      <p className="text-muted mb-4">
                        Manage your application settings here.
                      </p>
                    </div>

                    {/* AI Agent controls */}
                    <div className="mb-4">
                      <div className="card bg-light border-0">
                        <div className="card-body text-center py-4">
                          <i className="ri-robot-line fs-4 text-muted mb-2 d-block"></i>
                          <h6 className="text-muted mb-1">Customer Service AI</h6>
                          <p className="text-muted small mb-3">
                            Activate or deactivate the Customer Service AI agent.
                          </p>

                          {agentActive === null ? (
                            <div className="mb-2"><small className="text-muted">{loading ? "Loading status..." : "Status: unknown"}</small></div>
                          ) : (
                            <div className="mb-2">
                              <small className={agentActive ? "text-success" : "text-danger"}>
                                Status: {agentActive ? "Active" : "Inactive"}
                              </small>
                            </div>
                          )}

                          <div className="d-flex justify-content-center gap-2">
                            <button
                              className={agentActive ? "btn btn-danger" : "btn btn-success"}
                              onClick={toggleAgent}
                              disabled={loading || agentActive === null}
                              aria-label={agentActive ? "Deactivate AI Agent" : "Activate AI Agent"}
                            >
                              {loading ? "Working..." : (agentActive ? "Turn Off" : "Turn On")}
                            </button>
                          </div>

                          {error && <div className="mt-3 text-danger small">{error}</div>}
                        </div>
                      </div>
                    </div>

                    {/* Placeholder for future settings */}
                    <div className="row g-3">
                      <div className="col-md-6">
                        <div className="card border-0 bg-light h-100">
                          <div className="card-body text-center">
                            <i className="ri-notification-line fs-4 text-info mb-2 d-block"></i>
                            <h6 className="mb-1">Notifications</h6>
                            <small className="text-muted">Coming soon</small>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="card border-0 bg-light h-100">
                          <div className="card-body text-center">
                            <i className="ri-user-settings-line fs-4 text-success mb-2 d-block"></i>
                            <h6 className="mb-1">User Preferences</h6>
                            <small className="text-muted">Coming soon</small>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="card border-0 bg-light h-100">
                          <div className="card-body text-center">
                            <i className="ri-shield-line fs-4 text-warning mb-2 d-block"></i>
                            <h6 className="mb-1">Security</h6>
                            <small className="text-muted">Coming soon</small>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="card border-0 bg-light h-100">
                          <div className="card-body text-center">
                            <i className="ri-database-line fs-4 text-danger mb-2 d-block"></i>
                            <h6 className="mb-1">System</h6>
                            <small className="text-muted">Coming soon</small>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

