import ProtectedRoute from '../../../components/ProtectedRoute';
import { PERMISSIONS } from '../../../lib/permissions';

export default function SettingsPage() {
  return (
    <ProtectedRoute requiredPermissions={['adminOnly']} requiredPolicy={PERMISSIONS.POLICY_ADMIN_ONLY}>
      <div className="max-w-2xl mx-auto px-4 py-10 bg-white rounded-lg shadow-md mt-10">
        <h1 className="text-3xl font-bold mb-4 text-blue-700 text-center">Settings</h1>
        <p className="text-gray-600 mb-8 text-center">
          Manage your application settings here.
        </p>
        {/* Add your settings form or options here */}
        <div className="flex flex-col gap-4">
          {/* Example placeholder for future settings */}
          <div className="bg-gray-100 rounded p-4 text-gray-500 text-center">
            Settings options coming soon...
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}