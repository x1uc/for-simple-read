export interface SerializedRangeAnchor {
  startXPath: string;
  endXPath: string;
  startOffset: number;
  endOffset: number;
}

export interface TextQuoteAnchor {
  exact: string;
  prefix: string;
  suffix: string;
}

export interface TextAnchorPayload extends SerializedRangeAnchor, TextQuoteAnchor {}

interface TextNodeEntry {
  node: Text;
  start: number;
  end: number;
}

function isExcludedNode(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  if (parent.closest('script, style, noscript, iframe')) return true;
  return parent.closest('[data-sentence-highlight-id]') !== null;
}

function buildTextIndex(root: Element = document.body): { text: string; entries: TextNodeEntry[] } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const entries: TextNodeEntry[] = [];
  const chunks: string[] = [];

  let position = 0;
  let current: Node | null;
  while ((current = walker.nextNode())) {
    const textNode = current as Text;
    if (isExcludedNode(textNode)) {
      continue;
    }
    const value = textNode.textContent ?? '';
    if (!value) continue;

    const start = position;
    position += value.length;
    entries.push({ node: textNode, start, end: position });
    chunks.push(value);
  }

  return { text: chunks.join(''), entries };
}

function getTextNodePosition(node: Text, entries: TextNodeEntry[]): TextNodeEntry | null {
  for (const entry of entries) {
    if (entry.node === node) return entry;
  }
  return null;
}

function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}

function getGlobalOffset(container: Node, offset: number, entries: TextNodeEntry[]): number {
  if (container.nodeType === Node.TEXT_NODE) {
    const entry = getTextNodePosition(container as Text, entries);
    if (!entry) return 0;
    return entry.start + clamp(offset, 0, (container.textContent ?? '').length);
  }

  const boundary = document.createRange();
  boundary.setStart(container, clamp(offset, 0, container.childNodes.length));
  boundary.collapse(true);

  let total = 0;
  for (const entry of entries) {
    try {
      const cmp = boundary.comparePoint(entry.node, entry.node.length);
      if (cmp <= 0) {
        total += entry.node.length;
        continue;
      }
      break;
    } catch {
      break;
    }
  }

  return total;
}

function resolveBoundaryFromGlobalOffset(offset: number, entries: TextNodeEntry[]): { container: Text; offset: number } | null {
  if (entries.length === 0) return null;

  const total = entries[entries.length - 1].end;
  const normalized = clamp(offset, 0, total);

  for (const entry of entries) {
    if (normalized <= entry.end) {
      return {
        container: entry.node,
        offset: normalized - entry.start,
      };
    }
  }

  const last = entries[entries.length - 1];
  return { container: last.node, offset: last.node.length };
}

export function getNodeXPath(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentNode;
    if (!parent) return '';
    const parentPath = getNodeXPath(parent);
    if (!parentPath) return '';

    let index = 1;
    let sibling = parent.firstChild;
    while (sibling) {
      if (sibling.nodeType === Node.TEXT_NODE) {
        if (sibling === node) break;
        index += 1;
      }
      sibling = sibling.nextSibling;
    }

    return `${parentPath}/text()[${index}]`;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = node as Element;
  const parts: string[] = [];
  let current: Element | null = element;

  while (current) {
    const tagName = current.tagName.toLowerCase();
    let index = 1;
    let sibling = current.previousElementSibling;
    while (sibling) {
      if (sibling.tagName.toLowerCase() === tagName) {
        index += 1;
      }
      sibling = sibling.previousElementSibling;
    }

    parts.unshift(index > 1 ? `${tagName}[${index}]` : tagName);
    if (tagName === 'html') break;
    current = current.parentElement;
  }

  return `/${parts.join('/')}`;
}

export function getNodeByXPath(xpath: string): Node | null {
  if (!xpath) return null;
  try {
    return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  } catch (error) {
    console.warn('Invalid xpath:', xpath, error);
    return null;
  }
}

export function serializeRange(range: Range, prefixLength = 30, suffixLength = 30): TextAnchorPayload | null {
  const root = document.body;
  if (!root) return null;

  const { text, entries } = buildTextIndex(root);
  if (!text || entries.length === 0) return null;

  const startXPath = getNodeXPath(range.startContainer);
  const endXPath = getNodeXPath(range.endContainer);
  if (!startXPath || !endXPath) return null;

  const startGlobal = getGlobalOffset(range.startContainer, range.startOffset, entries);
  const endGlobal = getGlobalOffset(range.endContainer, range.endOffset, entries);

  const from = Math.min(startGlobal, endGlobal);
  const to = Math.max(startGlobal, endGlobal);
  const exact = text.slice(from, to);
  if (!exact) return null;

  const prefix = text.slice(Math.max(0, from - prefixLength), from);
  const suffix = text.slice(to, Math.min(text.length, to + suffixLength));

  return {
    startXPath,
    endXPath,
    startOffset: range.startOffset,
    endOffset: range.endOffset,
    exact,
    prefix,
    suffix,
  };
}

export function resolveRangeFromAnchor(anchor: SerializedRangeAnchor): Range | null {
  const startNode = getNodeByXPath(anchor.startXPath);
  const endNode = getNodeByXPath(anchor.endXPath);
  if (!startNode || !endNode) return null;

  try {
    const range = document.createRange();
    const startMax = startNode.nodeType === Node.TEXT_NODE ? (startNode.textContent ?? '').length : startNode.childNodes.length;
    const endMax = endNode.nodeType === Node.TEXT_NODE ? (endNode.textContent ?? '').length : endNode.childNodes.length;
    range.setStart(startNode, clamp(anchor.startOffset, 0, startMax));
    range.setEnd(endNode, clamp(anchor.endOffset, 0, endMax));
    if (range.collapsed) return null;
    return range;
  } catch {
    return null;
  }
}

function findBestMatchIndex(text: string, anchor: TextQuoteAnchor): number {
  const exact = anchor.exact;
  if (!exact) return -1;

  let fromIndex = 0;
  let bestIndex = -1;
  let bestScore = -1;

  while (true) {
    const found = text.indexOf(exact, fromIndex);
    if (found === -1) break;

    let score = 0;
    if (!anchor.prefix || text.slice(Math.max(0, found - anchor.prefix.length), found) === anchor.prefix) {
      score += 2;
    }
    const suffixStart = found + exact.length;
    if (!anchor.suffix || text.slice(suffixStart, suffixStart + anchor.suffix.length) === anchor.suffix) {
      score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = found;
      if (score === 4) break;
    }

    fromIndex = found + 1;
  }

  return bestIndex;
}

export function resolveRangeFromTextQuote(anchor: TextQuoteAnchor): Range | null {
  const root = document.body;
  if (!root || !anchor.exact) return null;

  const { text, entries } = buildTextIndex(root);
  if (!text || entries.length === 0) return null;

  const startIndex = findBestMatchIndex(text, anchor);
  if (startIndex === -1) return null;

  const endIndex = startIndex + anchor.exact.length;
  const start = resolveBoundaryFromGlobalOffset(startIndex, entries);
  const end = resolveBoundaryFromGlobalOffset(endIndex, entries);
  if (!start || !end) return null;

  try {
    const range = document.createRange();
    range.setStart(start.container, start.offset);
    range.setEnd(end.container, end.offset);
    if (range.collapsed) return null;
    return range;
  } catch {
    return null;
  }
}
