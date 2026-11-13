import { useState, useCallback } from 'react';

/**
 * Hook to manage expanded and collapsed states of discussion threads.
 */
export function useThreadExpansion(initialExpandedIds: string[] = []) {
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(
    () => new Set(initialExpandedIds)
  );

  const toggleThread = useCallback((threadId: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  }, []);

  const expandThread = useCallback((threadId: string) => {
    setExpandedThreads(prev => new Set(prev).add(threadId));
  }, []);

  const collapseThread = useCallback((threadId: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      next.delete(threadId);
      return next;
    });
  }, []);

  const isExpanded = useCallback((threadId: string) => expandedThreads.has(threadId), [expandedThreads]);

  return {
    expandedThreads,
    toggleThread,
    expandThread,
    collapseThread,
    isExpanded,
    setExpandedThreads,
  };
}
