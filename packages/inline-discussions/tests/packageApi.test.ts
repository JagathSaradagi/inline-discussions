import { describe, it, expect } from 'vitest';
import {
  buildAstSourceMap,
  getCachedAstSourceMap,
  reconstructTree,
  findAndAddMessageFlat,
  InlineThreadMessage,
  zefinaSanitizeSchema,
} from '../src';

describe('@zefina/inline-discussions Public API Contract', () => {
  it('exports pure AST functions without host dependencies', () => {
    const markdown = '## Title\n\nThis is paragraph one.\n\nAnd paragraph two.';
    const map = buildAstSourceMap(markdown);
    expect(map.rawContent).toBe(markdown);
    expect(map.spans.length).toBeGreaterThan(0);
    expect(map.spanMap.has('span-0')).toBe(true);
  });

  it('exports sanitize schema allowing custom tags and attributes', () => {
    expect(zefinaSanitizeSchema.tagNames).toContain('mark');
    expect(zefinaSanitizeSchema.tagNames).toContain('thread-block');
    expect(zefinaSanitizeSchema.tagNames).toContain('input-block');
    expect(zefinaSanitizeSchema.attributes?.['*']).toContain('data-tid');
  });

  it('reconstructs recursive trees with generic messages', () => {
    const rawNodes: InlineThreadMessage[] = [
      {
        id: 'msg-1',
        content: 'Root response text',
        authorRole: 'assistant',
        timestamp: 100,
        subThreads: [
          {
            id: 'thread-a',
            anchorOffset: 18,
            messages: []
          }
        ]
      },
      {
        id: 'msg-2',
        parentId: 'msg-1',
        threadId: 'thread-a',
        content: 'Inline question',
        authorRole: 'user',
        timestamp: 105
      }
    ];

    const tree = reconstructTree(rawNodes);
    expect(tree.length).toBe(1);
    expect(tree[0].id).toBe('msg-1');
    expect(tree[0].subThreads?.[0].messages.length).toBe(1);
    expect(tree[0].subThreads?.[0].messages[0].id).toBe('msg-2');
  });

  it('handles immediate injection for new thread creation', () => {
    const nodes: InlineThreadMessage[] = [
      {
        id: 'root-msg',
        content: 'The primary architecture is modular.',
        authorRole: 'assistant',
        subThreads: []
      }
    ];

    const selectedText = 'modular';
    const domOffset = 35;

    const { nodes: updated, subThreadId } = findAndAddMessageFlat(
      nodes,
      'root-msg',
      domOffset,
      selectedText,
      null
    );

    expect(subThreadId).toBeTruthy();
    expect(updated[0].subThreads?.length).toBe(1);
    expect(updated[0].subThreads?.[0].id).toBe(subThreadId);
    expect(updated[0].subThreads?.[0].anchorOffset).toBe(35);
  });
});
