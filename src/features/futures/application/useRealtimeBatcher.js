import { useCallback, useEffect, useRef } from 'react';

/**
 * Batches high-frequency realtime state patches into the next animation frame.
 *
 * This keeps Socket.IO bursts from forcing one React render per event while
 * preserving a simple functional patch API for callers.
 */
export function useRealtimeBatcher(setState) {
  const frameRef = useRef(null);
  const queueRef = useRef([]);

  const enqueuePatch = useCallback((patchFactory) => {
    queueRef.current.push(patchFactory);

    if (frameRef.current) return;

    frameRef.current = requestAnimationFrame(() => {
      const queue = queueRef.current;
      queueRef.current = [];
      frameRef.current = null;

      if (queue.length === 0) return;

      setState((prev) => {
        const patch = queue.reduce((acc, factory) => ({
          ...acc,
          ...factory({ ...prev, ...acc }),
        }), {});

        return {
          ...prev,
          ...patch,
        };
      });
    });
  }, [setState]);

  useEffect(() => () => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
    queueRef.current = [];
  }, []);

  return enqueuePatch;
}
