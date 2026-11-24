import { useEffect, useState } from 'react';
import { healthCheck } from '@/lib/api';

/**
 * Hook to check if the backend API is connected and healthy
 */
export const useBackendHealth = () => {
  const [isHealthy, setIsHealthy] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        setIsLoading(true);
        const healthy = await healthCheck();
        setIsHealthy(healthy);
        if (!healthy) {
          setError('Backend is not responding');
        } else {
          setError(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsHealthy(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkHealth();

    // Check health every 30 seconds
    const interval = setInterval(checkHealth, 30000);

    return () => clearInterval(interval);
  }, []);

  return { isHealthy, isLoading, error };
};
