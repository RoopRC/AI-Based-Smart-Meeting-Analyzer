import { useBackendHealth } from '@/hooks/useBackendHealth';
import { Alert } from './Alert';

const BackendStatus = () => {
  const { isHealthy, isLoading, error } = useBackendHealth();

  if (isLoading) {
    return (
      <div className="mb-4 rounded-lg border border-yellow-500 bg-yellow-50 p-4 text-yellow-700">
        <p className="text-sm font-medium">Checking backend connection...</p>
      </div>
    );
  }

  if (!isHealthy) {
    return (
      <div className="mb-4 rounded-lg border border-red-500 bg-red-50 p-4 text-red-700">
        <p className="text-sm font-bold">⚠️ Backend API Connection Failed</p>
        <p className="text-xs">{error || 'Make sure the backend server is running on http://localhost:8000'}</p>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-green-500 bg-green-50 p-4 text-green-700">
      <p className="text-sm font-medium">✅ Backend API Connected</p>
    </div>
  );
};

export default BackendStatus;
