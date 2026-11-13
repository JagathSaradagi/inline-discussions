import { defaultSchema } from 'rehype-sanitize';

/**
 * Zefina Markdown Sanitization Schema (SEC-05)
 *
 * Configures rehype-sanitize to strictly permit:
 * 1. Safe default markdown elements (headings, paragraphs, lists, tables, code blocks, links, images).
 * 2. Zefina custom AST annotations (<mark>, <thread-block>, <input-block>).
 * 3. Required attributes for recursive threading:
 *    - data-tid (and camelCase dataTid)
 *    - data-ast-span-id (and camelCase dataAstSpanId)
 *    - role, tabIndex / tabindex
 *    - aria-expanded, aria-label (and camelCase variants)
 *    - className / class
 *
 * Strictly strips:
 * - <script>, <iframe>, <object>, <embed>, <style>, <form>, <svg>, <math>, etc.
 * - All inline DOM event handlers (onclick, onerror, onload, etc.)
 * - All inline style attributes
 * - Dangerous protocols in href/src (javascript:, vbscript:, data:, etc.)
 *   Only http, https, and mailto are permitted for links; http and https for images.
 */
export const zefinaSanitizeSchema: typeof defaultSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'mark',
    'thread-block',
    'input-block',
  ],
  attributes: {
    ...defaultSchema.attributes,
    '*': [
      ...((defaultSchema.attributes && defaultSchema.attributes['*']) || []),
      'dataTid',
      'data-tid',
      'dataAstSpanId',
      'data-ast-span-id',
      'ariaExpanded',
      'aria-expanded',
      'ariaLabel',
      'aria-label',
      'role',
      'tabIndex',
      'tabindex',
      'className',
      'class',
    ],
    mark: [
      'dataTid',
      'data-tid',
      'dataAstSpanId',
      'data-ast-span-id',
      'ariaExpanded',
      'aria-expanded',
      'ariaLabel',
      'aria-label',
      'role',
      'tabIndex',
      'tabindex',
      'className',
      'class',
    ],
    'thread-block': [
      'dataTid',
      'data-tid',
    ],
    'input-block': [],
    span: [
      ...((defaultSchema.attributes && defaultSchema.attributes['span']) || []),
      'dataAstSpanId',
      'data-ast-span-id',
      'className',
      'class',
    ],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https'],
  },
};
