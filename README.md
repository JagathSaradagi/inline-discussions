# @zefina/inline-discussions

> **Recursive discussions, anchored directly inside AI-generated Markdown responses.**

Traditional AI chat interfaces force users to ask follow-up questions at the very bottom of a conversation—even when their doubt concerns one particular sentence in a long response.

`@zefina/inline-discussions` solves this by placing discussions **where the question originates**. Users can select any passage in an AI-generated Markdown response, open an inline input at that exact sentence, and create nested, recursive discussions without modifying or breaking the original Markdown response.

---

## Features

- 🎯 **Precise Text Anchoring**: Maps browser DOM selections back to exact raw Markdown source offsets using AST character maps.
- 🌳 **Sibling-Block AST Injection**: Splits Markdown paragraphs into valid sibling blocks at anchor boundaries. Original Markdown source text remains completely immutable.
- 🔄 **Recursive Threading**: Supports infinite nesting of discussions inside discussions (discussions branching from discussions).
- 🧩 **Zero-Host Lock-In**: Decoupled from any database, AI model, or backend. The host application retains complete control over AI dispatch, persistence, and auth.
- 🛡️ **HTML Sanitization**: Built-in strict rehype sanitization permitting custom discussion nodes (`<mark>`, `<thread-block>`, `<input-block>`) while stripping unsafe tags and scripts.
- ⚡ **Lightweight & Fast**: Message-scoped LRU AST cache prevents redundant mdast parsing during typing and re-renders.

---

## Architecture Overview

```
Browser Selection (DOM Range)
       │
       ▼
useInlineSelection()
       │ Queries [data-ast-span-id]
       ▼
AstSourceMap (charMap lookup)
       │ Computes rawStart & rawEnd offsets
       ▼
reconstructTree() / findAndAddMessageFlat()
       │ Creates/injects subthread at anchorOffset
       ▼
remarkStructuredAnnotations() (Single-pass AST Transform)
       │ Splits phrasing nodes & paragraph blocks
       ▼
InlineDiscussionViewer
       │ Renders Markdown with inline <thread-block> and <input-block>
       ▼
Rendered DOM (Interactive, recursive threads)
```

### The Sibling-Block Injection Pattern
To maintain valid HTML and avoid putting block-level discussion containers inside inline `<p>` tags, the AST compiler splits the parent paragraph into sibling paragraphs:

```markdown
Paragraph A: "Distributed systems require consensus algorithms."
[ <thread-block data-tid="t-123"> ... discussion messages ... </thread-block> ]
Paragraph B: "Raft provides an understandable alternative to Paxos."
```

---

## Installation

```bash
npm install @zefina/inline-discussions react-markdown
```

### Peer Dependencies
- `react`: `^18.0.0 || ^19.0.0`
- `react-dom`: `^18.0.0 || ^19.0.0`

---

## Quick Start

```tsx
import React, { useState, useRef } from 'react';
import {
  InlineDiscussionViewer,
  useInlineSelection,
  useThreadExpansion,
  reconstructTree,
  findAndAddMessageFlat,
  InlineThreadMessage,
} from '@zefina/inline-discussions';

export function ChatResponse() {
  const [messages, setMessages] = useState<InlineThreadMessage[]>([
    {
      id: 'msg-1',
      authorRole: 'assistant',
      content: 'Distributed systems require consensus algorithms to achieve fault tolerance.',
      subThreads: [],
    },
  ]);

  const [activeInput, setActiveInput] = useState(null);
  const { expandedThreads, toggleThread, expandThread } = useThreadExpansion();
  const containerRef = useRef(null);

  // Hook captures DOM selections and converts them to source offsets
  const { handleMouseUp } = useInlineSelection({
    containerRef,
    getContentForMessage: (msgId) => messages.find(m => m.id === msgId)?.content,
    onSelectRange: ({ msgId, anchorOffset, selectedText }) => {
      setActiveInput({ msgId, anchorOffset, text: selectedText });
    },
  });

  const handlePostDoubt = (parentMsgId, anchorOffset, text, question) => {
    const userMsg = {
      id: crypto.randomUUID(),
      content: question,
      authorRole: 'user',
      timestamp: Date.now(),
    };

    const { nodes, subThreadId } = findAndAddMessageFlat(
      messages,
      parentMsgId,
      anchorOffset,
      text,
      userMsg
    );

    setMessages(nodes);
    setActiveInput(null);
    if (subThreadId) expandThread(subThreadId);
  };

  const tree = reconstructTree(messages);

  return (
    <div ref={containerRef} onMouseUp={handleMouseUp} className="chat-container">
      {tree.map((msg) => (
        <InlineDiscussionViewer
          key={msg.id}
          message={msg}
          activeInput={activeInput}
          expandedThreadIds={expandedThreads}
          onToggleThread={toggleThread}
          renderInput={(input) => (
            <div className="custom-input-box">
              <span>Clarifying: "{input.text}"</span>
              <input
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePostDoubt(input.msgId, input.anchorOffset, input.text, e.currentTarget.value);
                  }
                }}
                placeholder="Ask about this sentence..."
              />
            </div>
          )}
        />
      ))}
    </div>
  );
}
```

---

## Supported Markdown Structures

| Structure | Supported | Notes |
| :--- | :---: | :--- |
| Paragraphs | ✅ | Native sibling-block splitting |
| Bold / Italic / Strikethrough | ✅ | Formatting wrappers preserved across splits |
| Inline Code (`` `code` ``) | ✅ | Precision character mapping |
| Headings (`#`, `##`, etc.) | ✅ | Anchored at block boundary |
| Unordered / Ordered Lists | ✅ | Subthreads attach cleanly to list items |
| Code Blocks (fenced) | ⚠️ | Anchors attach to whole block boundary |
| Markdown Tables | ⚠️ | Anchors attach to cell or whole table boundary |

---

## License & Commercial Terms

`@zefina/inline-discussions` is dual-licensed:

1. **Open Source (GNU AGPL-3.0)**: Free for non-commercial, academic, and open-source applications under the terms of the GNU Affero General Public License v3.0. Any application or service distributing or hosting this engine over a network must make its complete source code available under AGPL-3.0.
2. **Commercial License**: For startups, enterprises, and closed-source commercial SaaS applications wishing to embed the engine into proprietary products without AGPL-3.0 copyleft obligations. Includes custom design system integration support and enterprise SLA guarantees.

**For commercial licensing and enterprise integration sprints:**  
Contact **Jagath Saradagi** at `jagathsaradagi@gmail.com`

---

## Citation

If you use or reference this architecture in academic research, HCI projects, or publications, please cite:

```bibtex
@software{saradagi2026inline,
  author = {Saradagi, Jagath},
  title = {In-Situ Recursive Discussion Engine for AI Markdown Responses},
  year = {2026},
  url = {https://github.com/JagathSaradagi/inline-discussions}
}
```

Copyright © 2026 [Jagath Saradagi](https://github.com/JagathSaradagi). All rights reserved.
