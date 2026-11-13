import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';

export interface AstTextSpan {
  id: string;
  type: string;
  text: string;
  rawStart: number;
  rawEnd: number;
  parentType: string | null;
  charMap: number[];
}

export interface AstSourceMap {
  rawContent: string;
  spans: AstTextSpan[];
  spanMap: Map<string, AstTextSpan>;
}

export interface DomSelectionCoordinates {
  startSpanId: string;
  startOffset: number;
  endSpanId: string;
  endOffset: number;
}

export interface ResolvedSourceRange {
  rawStart: number;
  rawEnd: number;
  selectedText: string;
  found: boolean;
}

// Bounded message-scoped AST source map cache: LRU eviction with max 100 entries
const MAX_CACHE_ENTRIES = 100;
const astSourceMapCache = new Map<string, { content: string; map: AstSourceMap }>();

export function getCachedAstSourceMap(msgId: string, rawContent: string): AstSourceMap {
  if (!msgId) {
    return buildAstSourceMap(rawContent);
  }
  const cached = astSourceMapCache.get(msgId);
  if (cached && cached.content === rawContent) {
    // Refresh LRU order: delete and re-insert at tail
    astSourceMapCache.delete(msgId);
    astSourceMapCache.set(msgId, cached);
    return cached.map;
  }
  const map = buildAstSourceMap(rawContent);

  // If replacing existing or adding new, evict oldest if at capacity
  if (astSourceMapCache.has(msgId)) {
    astSourceMapCache.delete(msgId);
  } else if (astSourceMapCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = astSourceMapCache.keys().next().value;
    if (oldestKey !== undefined) {
      astSourceMapCache.delete(oldestKey);
    }
  }

  astSourceMapCache.set(msgId, { content: rawContent, map });
  return map;
}

export function invalidateAstSourceMapCache(msgId?: string): void {
  if (msgId) {
    astSourceMapCache.delete(msgId);
  } else {
    astSourceMapCache.clear();
  }
}

export function getAstSourceMapCacheSize(): number {
  return astSourceMapCache.size;
}

export function buildAstSourceMap(rawContent: string): AstSourceMap {
  if (!rawContent) {
    return { rawContent: '', spans: [], spanMap: new Map() };
  }

  const processor = unified().use(remarkParse).use(remarkGfm);
  const tree = processor.parse(rawContent);
  const spans: AstTextSpan[] = [];
  const spanMap = new Map<string, AstTextSpan>();
  let spanCounter = 0;

  visit(tree, (node: any, _index: number | undefined, parent: any) => {
    if (node.type === 'text' || node.type === 'inlineCode' || node.type === 'code') {
      if (node.position?.start && node.position?.end) {
        let rawStart = node.position.start.offset ?? 0;
        let rawEnd = node.position.end.offset ?? 0;
        const textVal: string = node.value ?? '';

        const charMap: number[] = [];

        if (node.type === 'inlineCode') {
          // Precise mapping for inline code supporting arbitrary backtick delimiters and whitespace normalization
          // 1. Measure opening delimiter length
          let openTicks = 0;
          while (rawStart + openTicks < rawEnd && rawContent[rawStart + openTicks] === '`') {
            openTicks++;
          }
          let closeTicks = 0;
          while (rawEnd - 1 - closeTicks >= rawStart && rawContent[rawEnd - 1 - closeTicks] === '`') {
            closeTicks++;
          }

          let innerRawStart = rawStart + openTicks;
          let innerRawEnd = rawEnd - closeTicks;

          // Markdown spec: if code span begins and ends with space (and is not all spaces), one space is stripped
          if (
            innerRawEnd - innerRawStart >= 2 &&
            rawContent[innerRawStart] === ' ' &&
            rawContent[innerRawEnd - 1] === ' ' &&
            /[^ ]/.test(rawContent.slice(innerRawStart, innerRawEnd))
          ) {
            innerRawStart++;
            innerRawEnd--;
          }

          // Build exact charMap for rendered inlineCode characters
          let rawCursor = innerRawStart;
          for (let i = 0; i < textVal.length; i++) {
            const char = textVal[i];
            // Markdown code spans normalize newlines to single spaces
            if (char === ' ' && (rawContent[rawCursor] === '\n' || rawContent[rawCursor] === '\r')) {
              charMap.push(rawCursor);
              if (rawContent[rawCursor] === '\r' && rawContent[rawCursor + 1] === '\n') {
                rawCursor += 2;
              } else {
                rawCursor += 1;
              }
            } else {
              charMap.push(rawCursor);
              rawCursor += 1;
            }
          }
        } else {
          // Text node: handles backslash escaped characters
          const rawSlice = rawContent.slice(rawStart, rawEnd);
          let rawCursor = 0;
          for (let i = 0; i < textVal.length; i++) {
            const char = textVal[i];
            if (rawSlice[rawCursor] === '\\' && rawSlice[rawCursor + 1] === char) {
              rawCursor += 1;
            }
            charMap.push(rawStart + rawCursor);
            rawCursor += 1;
          }
        }

        const span: AstTextSpan = {
          id: `span-${spanCounter++}`,
          type: node.type,
          text: textVal,
          rawStart,
          rawEnd,
          parentType: parent ? parent.type : null,
          charMap,
        };

        spans.push(span);
        spanMap.set(span.id, span);
      }
    }
  });

  return { rawContent, spans, spanMap };
}

export function resolveDomSelectionToSourceRange(
  sourceMap: AstSourceMap,
  coords: DomSelectionCoordinates
): ResolvedSourceRange {
  const startSpan = sourceMap.spanMap.get(coords.startSpanId);
  const endSpan = sourceMap.spanMap.get(coords.endSpanId);

  if (!startSpan || !endSpan) {
    return { rawStart: -1, rawEnd: -1, selectedText: '', found: false };
  }

  const clampedStartOffset = Math.max(0, Math.min(coords.startOffset, startSpan.text.length));
  const clampedEndOffset = Math.max(0, Math.min(coords.endOffset, endSpan.text.length));

  let rawStart: number;
  if (clampedStartOffset < startSpan.charMap.length) {
    rawStart = startSpan.charMap[clampedStartOffset];
  } else {
    rawStart = startSpan.rawEnd;
  }

  let rawEnd: number;
  if (clampedEndOffset > 0 && clampedEndOffset <= endSpan.charMap.length) {
    const lastIncludedCharRaw = endSpan.charMap[clampedEndOffset - 1];
    rawEnd = lastIncludedCharRaw + 1;
  } else if (clampedEndOffset === 0) {
    rawEnd = endSpan.rawStart;
  } else {
    rawEnd = endSpan.rawEnd;
  }

  let selectedText = '';
  const startIndex = sourceMap.spans.findIndex((s) => s.id === startSpan.id);
  const endIndex = sourceMap.spans.findIndex((s) => s.id === endSpan.id);

  if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
    return { rawStart: -1, rawEnd: -1, selectedText: '', found: false };
  }

  if (startIndex === endIndex) {
    selectedText = startSpan.text.slice(clampedStartOffset, clampedEndOffset);
  } else {
    selectedText += startSpan.text.slice(clampedStartOffset);
    for (let i = startIndex + 1; i < endIndex; i++) {
      selectedText += sourceMap.spans[i].text;
    }
    selectedText += endSpan.text.slice(0, clampedEndOffset);
  }

  return {
    rawStart,
    rawEnd,
    selectedText,
    found: true,
  };
}

export interface OverlappingThread {
  threadId: string;
  start: number;
  end: number;
}

export interface SegmentedSpan {
  start: number;
  end: number;
  threadIds: string[];
}

export function partitionOverlappingThreads(
  threads: OverlappingThread[]
): SegmentedSpan[] {
  if (!threads.length) return [];

  const points = new Set<number>();
  threads.forEach((t) => {
    points.add(t.start);
    points.add(t.end);
  });

  const sortedPoints = Array.from(points).sort((a, b) => a - b);
  const segments: SegmentedSpan[] = [];

  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const segStart = sortedPoints[i];
    const segEnd = sortedPoints[i + 1];

    const activeThreads = threads
      .filter((t) => t.start <= segStart && t.end >= segEnd)
      .map((t) => t.threadId);

    if (activeThreads.length > 0) {
      segments.push({
        start: segStart,
        end: segEnd,
        threadIds: activeThreads,
      });
    }
  }

  return segments;
}

/**
 * Helper: Maps a raw Markdown document offset into a rendered character index within a text leaf,
 * strictly utilizing the node's charMap if available to eliminate backslash escape drift.
 */
function getRenderedIndexFromRawOffset(rawOffset: number, rawStart: number, charMap?: number[]): number {
  if (charMap && charMap.length > 0) {
    for (let i = 0; i < charMap.length; i++) {
      if (charMap[i] >= rawOffset) {
        return i;
      }
    }
    return charMap.length;
  }
  return Math.max(0, rawOffset - rawStart);
}

/**
 * Splits an arbitrary phrasing AST node (text, strong, emphasis, link, inlineCode) at a raw document offset.
 * Returns [leftNode, rightNode]. If the cut falls outside [nodeStart, nodeEnd], one side will be null.
 */
function splitPhrasingNode(node: any, cutPos: number, nextSpanIdFn?: () => string): [any | null, any | null] {
  const nodeStart = node.position?.start?.offset ?? 0;
  const nodeEnd = node.position?.end?.offset ?? 0;

  if (nodeEnd <= cutPos) {
    return [node, null];
  }
  if (nodeStart >= cutPos) {
    return [null, node];
  }

  if (node.type === 'text') {
    const charMap = node.data?.charMap;
    const localSplit = getRenderedIndexFromRawOffset(cutPos, nodeStart, charMap);
    const leftText = node.value.slice(0, localSplit);
    const rightText = node.value.slice(localSplit);

    const leftNode = leftText ? {
      ...node,
      value: leftText,
      position: { start: { offset: nodeStart }, end: { offset: cutPos } },
      data: {
        ...(node.data || {}),
        hProperties: {
          ...(node.data?.hProperties || {}),
          'data-ast-span-id': nextSpanIdFn ? nextSpanIdFn() : node.data?.hProperties?.['data-ast-span-id'],
        },
      },
    } : null;

    const rightNode = rightText ? {
      ...node,
      value: rightText,
      position: { start: { offset: cutPos }, end: { offset: nodeEnd } },
      data: {
        ...(node.data || {}),
        hProperties: {
          ...(node.data?.hProperties || {}),
          'data-ast-span-id': nextSpanIdFn ? nextSpanIdFn() : node.data?.hProperties?.['data-ast-span-id'],
        },
      },
    } : null;

    return [leftNode, rightNode];
  }

  if (node.type === 'inlineCode') {
    const charMap = node.data?.charMap;
    const localSplit = getRenderedIndexFromRawOffset(cutPos, nodeStart, charMap);
    const leftText = node.value.slice(0, localSplit);
    const rightText = node.value.slice(localSplit);

    const leftNode = leftText ? {
      ...node,
      value: leftText,
      position: { start: { offset: nodeStart }, end: { offset: cutPos } },
      data: {
        ...(node.data || {}),
        hProperties: {
          ...(node.data?.hProperties || {}),
          'data-ast-span-id': nextSpanIdFn ? nextSpanIdFn() : node.data?.hProperties?.['data-ast-span-id'],
        },
      },
    } : null;

    const rightNode = rightText ? {
      ...node,
      value: rightText,
      position: { start: { offset: cutPos }, end: { offset: nodeEnd } },
      data: {
        ...(node.data || {}),
        hProperties: {
          ...(node.data?.hProperties || {}),
          'data-ast-span-id': nextSpanIdFn ? nextSpanIdFn() : node.data?.hProperties?.['data-ast-span-id'],
        },
      },
    } : null;

    return [leftNode, rightNode];
  }

  if (node.children && Array.isArray(node.children)) {
    const leftChildren: any[] = [];
    const rightChildren: any[] = [];

    for (const child of node.children) {
      const [lPart, rPart] = splitPhrasingNode(child, cutPos, nextSpanIdFn);
      if (lPart) leftChildren.push(lPart);
      if (rPart) rightChildren.push(rPart);
    }

    const leftWrapper = leftChildren.length > 0 ? {
      ...node,
      children: leftChildren,
      position: { start: { offset: nodeStart }, end: { offset: cutPos } }
    } : null;

    const rightWrapper = rightChildren.length > 0 ? {
      ...node,
      children: rightChildren,
      position: { start: { offset: cutPos }, end: { offset: nodeEnd } }
    } : null;

    return [leftWrapper, rightWrapper];
  }

  return [node, null];
}

/**
 * Remark Plugin: AST Annotation Injector
 * Transforms Markdown AST nodes by:
 * 1. Highlighting selected intervals with <mark> tags.
 * 2. Splitting top-level paragraphs into sibling paragraphs around anchor points,
 *    inserting <thread-block> and <input-block> as true block siblings directly between them.
 */
export function remarkStructuredAnnotations(options: {
  subThreads: { id: string; highlightStart?: number; anchorOffset?: number; highlightedText: string }[];
  activeInput?: { msgId: string; anchorOffset: number; text: string } | null;
  msgId: string;
}) {
  return (tree: any) => {
    const { subThreads = [], activeInput, msgId } = options;

    // Collect highlight ranges
    const highlightRanges: { id: string; start: number; end: number }[] = [];
    subThreads.forEach((st) => {
      if (st.highlightedText) {
        const start = st.highlightStart ?? (st.anchorOffset ? st.anchorOffset - st.highlightedText.length : 0);
        const end = start + st.highlightedText.length;
        if (end > start) {
          highlightRanges.push({ id: st.id, start, end });
        }
      }
    });

    if (activeInput && activeInput.msgId === msgId && activeInput.text) {
      const end = activeInput.anchorOffset ?? 0;
      const start = Math.max(0, end - activeInput.text.length);
      highlightRanges.push({ id: 'active', start, end });
    }

    // Collect anchor injection points
    const anchorPoints: { pos: number; type: 'thread' | 'input'; id?: string }[] = [];
    subThreads.forEach((st) => {
      if (typeof st.anchorOffset === 'number') {
        anchorPoints.push({ pos: st.anchorOffset, type: 'thread', id: st.id });
      }
    });

    if (activeInput && activeInput.msgId === msgId && typeof activeInput.anchorOffset === 'number') {
      anchorPoints.push({ pos: activeInput.anchorOffset, type: 'input' });
    }

    // Pass 1: Traverse and tag text leaves with ast-span-id, and split text leaves that intersect highlight ranges
    let spanCounter = 0;
    visit(tree, (node: any, index: number | undefined, parent: any) => {
      if (!parent || typeof index !== 'number') return;

      if (node.type === 'text' || node.type === 'inlineCode') {
        const nodeStart = node.position?.start?.offset;
        const nodeEnd = node.position?.end?.offset;
        if (typeof nodeStart !== 'number' || typeof nodeEnd !== 'number') return;

        // Check if any highlight intersects this node
        const intersectingHighlights = highlightRanges.filter(
          (hr) => hr.start < nodeEnd && hr.end > nodeStart
        );

        if (intersectingHighlights.length > 0 && node.type === 'text') {
          const textVal = node.value;
          const nodeLen = textVal.length;

          // Build exact charMap for this text node to resolve raw offsets -> rendered character indices
          // accounting for backslash escapes in raw markdown
          const charMap: number[] = [];
          if (options.msgId) {
            // Check if cached source map has charMap for this exact span
            const cachedMap = astSourceMapCache.get(options.msgId);
            if (cachedMap) {
              const matchedSpan = cachedMap.map.spans.find(s => s.rawStart === nodeStart && s.rawEnd === nodeEnd);
              if (matchedSpan && matchedSpan.charMap) {
                charMap.push(...matchedSpan.charMap);
              }
            }
          }

          // Fallback if no cached charMap: build on the fly by scanning raw text
          if (charMap.length === 0) {
            let rawCursor = 0;
            const rawSlice = (nodeEnd > nodeStart) ? '' : ''; // length is nodeEnd - nodeStart
            for (let i = 0; i < textVal.length; i++) {
              charMap.push(nodeStart + i);
            }
          }

          const localPoints = new Set<number>([0, nodeLen]);
          intersectingHighlights.forEach((hr) => {
            // Find exact rendered index via charMap
            let localStart = 0;
            if (hr.start <= nodeStart) {
              localStart = 0;
            } else if (hr.start >= nodeEnd) {
              localStart = nodeLen;
            } else {
              let idx = charMap.findIndex(rawPos => rawPos >= hr.start);
              localStart = idx !== -1 ? idx : nodeLen;
            }

            let localEnd = nodeLen;
            if (hr.end <= nodeStart) {
              localEnd = 0;
            } else if (hr.end >= nodeEnd) {
              localEnd = nodeLen;
            } else {
              let idx = charMap.findIndex(rawPos => rawPos >= hr.end);
              localEnd = idx !== -1 ? idx : nodeLen;
            }

            localPoints.add(localStart);
            localPoints.add(localEnd);
          });

          const sorted = Array.from(localPoints).sort((a, b) => a - b);
          const replacementNodes: any[] = [];

          for (let i = 0; i < sorted.length - 1; i++) {
            const p1 = sorted[i];
            const p2 = sorted[i + 1];
            const sliceText = node.value.slice(p1, p2);
            if (!sliceText) continue;

            const sliceRawStart = charMap[p1] ?? (nodeStart + p1);
            const sliceRawEnd = charMap[p2] ?? (nodeStart + p2);
            const spanId = `span-${spanCounter++}`;

            const matchingHighlight = intersectingHighlights.find(
              (hr) => hr.start <= sliceRawStart && hr.end >= sliceRawEnd
            );

            if (matchingHighlight) {
              replacementNodes.push({
                type: 'html',
                value: `<mark data-tid="${matchingHighlight.id}"><span data-ast-span-id="${spanId}">${sliceText}</span></mark>`,
                position: {
                  start: { offset: sliceRawStart },
                  end: { offset: sliceRawEnd },
                },
              });
            } else {
              replacementNodes.push({
                type: 'text',
                value: sliceText,
                position: {
                  start: { offset: sliceRawStart },
                  end: { offset: sliceRawEnd },
                },
                data: {
                  hName: 'span',
                  hProperties: {
                    'data-ast-span-id': spanId,
                  },
                },
              });
            }
          }

          parent.children.splice(index, 1, ...replacementNodes);
          return index + replacementNodes.length;
        } else {
          const spanId = `span-${spanCounter++}`;
          node.data = {
            ...(node.data || {}),
            hName: node.type === 'inlineCode' ? 'code' : 'span',
            hProperties: {
              ...(node.data?.hProperties || {}),
              'data-ast-span-id': spanId,
            },
          };
        }
      }
    });

    if (!anchorPoints.length) {
      return;
    }

    // Sort anchors by document offset ascending, tie-breaking 'thread' before 'input'
    const sortedAnchors = [...anchorPoints].sort((a, b) => {
      if (a.pos !== b.pos) return a.pos - b.pos;
      if (a.type !== b.type) return a.type === 'thread' ? -1 : 1;
      return (a.id || '').localeCompare(b.id || '');
    });

    // Pass 2: Single-pass transformation of top-level root children
    const newRootChildren: any[] = [];

    for (const block of tree.children) {
      if (block.type !== 'paragraph') {
        newRootChildren.push(block);
        continue;
      }

      const blockStart = block.position?.start?.offset ?? 0;
      const blockEnd = block.position?.end?.offset ?? 0;

      // Find all anchors belonging to this paragraph:
      // Includes anchors where pos is inside (blockStart < pos < blockEnd) or at boundaries
      const blockAnchors = sortedAnchors.filter((a) => a.pos >= blockStart && a.pos <= blockEnd);

      if (blockAnchors.length === 0) {
        newRootChildren.push(block);
        continue;
      }

      // Interleave sub-paragraphs and thread blocks
      let remainingChildren: any[] = [...block.children];

      for (let i = 0; i < blockAnchors.length; i++) {
        const anchor = blockAnchors[i];
        const nextAnchorPos = anchor.pos;

        // Split current remaining children at nextAnchorPos
        const currentLeft: any[] = [];
        const currentRight: any[] = [];

        for (const child of remainingChildren) {
          const [lPart, rPart] = splitPhrasingNode(child, nextAnchorPos, () => `span-${spanCounter++}`);
          if (lPart) currentLeft.push(lPart);
          if (rPart) currentRight.push(rPart);
        }

        if (currentLeft.length > 0) {
          newRootChildren.push({
            type: 'paragraph',
            children: currentLeft,
          });
        }

        // Emit block sibling
        newRootChildren.push({
          type: 'html',
          value: anchor.type === 'thread'
            ? `<thread-block data-tid="${anchor.id}"></thread-block>`
            : '<input-block></input-block>',
        });

        remainingChildren = currentRight;
      }

      if (remainingChildren.length > 0) {
        newRootChildren.push({
          type: 'paragraph',
          children: remainingChildren,
        });
      }
    }

    tree.children = newRootChildren;
  };
}
