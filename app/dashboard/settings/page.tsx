import ProtectedRoute from '../../../components/ProtectedRoute';
import { PERMISSIONS } from '../../../lib/permissions';

export default function SettingsPage() {
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
                    
                    {/* Settings sections */}
                    <div className="mb-4">
                      <div className="card bg-light border-0">
                        <div className="card-body text-center py-4">
                          <i className="ri-time-line fs-4 text-muted mb-2 d-block"></i>
                          <h6 className="text-muted mb-1">Settings Configuration</h6>
                          <p className="text-muted small mb-0">
                            Settings options coming soon...
                          </p>
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