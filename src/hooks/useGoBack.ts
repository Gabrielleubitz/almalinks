import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/** Navigate to the previous history entry, or `fallbackPath` when there is none. */
export function useGoBack(fallbackPath = '/') {
  const navigate = useNavigate();
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof idx === 'number' && idx > 0) {
      navigate(-1);
    } else {
      navigate(fallbackPath);
    }
  }, [navigate, fallbackPath]);
}
