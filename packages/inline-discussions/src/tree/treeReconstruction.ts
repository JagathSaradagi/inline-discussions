import { InlineThreadMessage, InlineSubThread } from '../types';

/**
 * Reconstructs a flat array of messages into a nested tree structure.
 * Supports recursive subthreads at arbitrary depth levels.
 *
 * @param nodes Flat array of messages
 * @returns Array of root messages containing nested subthreads and recursive messages
 */
export const reconstructTree = <T extends InlineThreadMessage>(nodes: T[]): T[] => {
  const nodeMap = new Map<string, T>();

  // 1. First pass: Clone all nodes and initialize empty subThreads lists
  nodes.forEach(n => {
    nodeMap.set(n.id, {
      ...n,
      subThreads: (n.subThreads || []).map(st => ({ ...st, messages: [] as T[] }))
    } as T);
  });

  const rootMessages: T[] = [];

  // 2. Second pass: Build the actual tree hierarchy
  nodes.forEach(n => {
    const current = nodeMap.get(n.id)!;

    if (!n.parentId) {
      rootMessages.push(current);
    } else {
      // Find the "True Owner" of this message's thread
      if (n.threadId) {
        let owner: T | undefined = undefined;
        let currentParentId = n.parentId;

        // Crawl up until we find the node that actually HAS this subThread ID defined
        while (currentParentId) {
          const p = nodeMap.get(currentParentId);
          if (!p) break;
          if (p.subThreads && p.subThreads.some(st => st.id === n.threadId)) {
            owner = p;
            break;
          }
          currentParentId = (p.parentId as string) || '';
        }

        if (owner && owner.subThreads) {
          const thread = owner.subThreads.find(st => st.id === n.threadId);
          if (thread) {
            thread.messages.push(current);
            return;
          }
        }
      }
      rootMessages.push(current);
    }
  });

  // 3. Sorting by timestamp
  const sortRecursive = (list: T[]) => {
    list.sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));
    list.forEach(m => {
      if (m.subThreads) {
        m.subThreads.forEach(st => sortRecursive(st.messages as T[]));
      }
    });
  };

  sortRecursive(rootMessages);

  // 4. Final filter to remove nested messages mistakenly placed at root
  return rootMessages.filter((m, index, self) =>
    self.findIndex(t => t.id === m.id) === index
  ).filter(m => {
    if (!m.parentId) return true;
    if (m.threadId) {
      const parent = nodes.find(pn => pn.id === m.parentId);
      if (parent && parent.threadId === m.threadId) return false;
      if (parent && parent.subThreads && parent.subThreads.some(st => st.id === m.threadId)) return false;
    }
    return true;
  });
};
