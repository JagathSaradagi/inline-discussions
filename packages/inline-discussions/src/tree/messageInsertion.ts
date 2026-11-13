import { InlineThreadMessage, InlineSubThread } from '../types';

/**
 * Snaps a DOM character offset to raw Markdown source text,
 * accounting for Markdown punctuation and formatting markers.
 */
export const findMarkdownOffset = (content: string, selectedText: string, domOffset: number): number => {
  if (!selectedText) return domOffset;
  const targetText = selectedText.trim();
  const escaped = targetText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexSource = escaped.split('').map(char => {
    if (/\s/.test(char)) return '\\s+';
    return '[\\*_`~]*' + char + '[\\*_`~]*';
  }).join('');

  const regex = new RegExp(regexSource, 'g');
  let match;
  let bestMatchEnd = -1;
  let minDiff = Infinity;

  while ((match = regex.exec(content)) !== null) {
    const matchEnd = match.index + match[0].length;
    const diff = Math.abs(matchEnd - domOffset);
    if (diff < minDiff) {
      minDiff = diff;
      bestMatchEnd = matchEnd;
    }
  }
  return bestMatchEnd !== -1 ? bestMatchEnd : domOffset;
};

/**
 * Finds target node and attaches an inline sub-thread or user message
 * using immediate injection at the exact selection boundary.
 */
export const findAndAddMessageFlat = <T extends InlineThreadMessage>(
  nodes: T[],
  targetId: string,
  rawAnchorOffset: number,
  highlightedText: string,
  newMsg: T | null
): { nodes: T[]; subThreadId: string | null } => {
  const targetNode = nodes.find(n => n.id === targetId);
  if (!targetNode) return { nodes, subThreadId: null };

  const anchorOffset = findMarkdownOffset(targetNode.content, highlightedText, rawAnchorOffset);

  const escapedH = highlightedText.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hRegexSource = escapedH.split('').map(char => (/\s/.test(char) ? '\\s+' : '[\\*_`~]*' + char + '[\\*_`~]*')).join('');
  const hRegex = new RegExp(hRegexSource, 'g');

  let hMatch;
  let hStart = Math.max(0, anchorOffset - highlightedText.length);
  let minHDiff = Infinity;
  while ((hMatch = hRegex.exec(targetNode.content)) !== null) {
    const matchEnd = hMatch.index + hMatch[0].length;
    const diff = Math.abs(matchEnd - anchorOffset);
    if (diff < minHDiff) {
      minHDiff = diff;
      hStart = hMatch.index;
    }
  }

  // Immediate Injection: branch opens exactly at anchor offset
  const injectionPoint = anchorOffset;

  const existingThread = (targetNode.subThreads || []).find(
    st => st.anchorOffset === injectionPoint && st.highlightStart === hStart
  );

  let subThreadId = existingThread?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10));
  let updatedNodes = [...nodes];

  if (!existingThread) {
    const updatedTarget: T = {
      ...targetNode,
      subThreads: [
        ...(targetNode.subThreads || []),
        {
          id: subThreadId,
          anchorOffset: injectionPoint,
          highlightStart: hStart,
          highlightedText: targetNode.content.slice(hStart, anchorOffset),
          messages: []
        }
      ]
    };
    updatedNodes = updatedNodes.map(n => n.id === targetId ? updatedTarget : n);
  }

  if (newMsg) {
    const messageWithPointers: T = {
      ...newMsg,
      parentId: targetId,
      threadId: subThreadId
    };
    updatedNodes.push(messageWithPointers);
  }

  return { nodes: updatedNodes, subThreadId };
};
