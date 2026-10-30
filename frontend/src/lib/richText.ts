// Free text quotation pages are stored as HTML; this keeps only the formatting the editor offers.

const ALLOWED_TAGS = new Set([
  'P', 'BR', 'DIV', 'SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'FONT',
  'H1', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'HR',
  'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH',
]);
const ALLOWED_ATTRS: Record<string, string[]> = {
  FONT: ['size'],
  TD: ['colspan', 'rowspan'],
  TH: ['colspan', 'rowspan'],
};
// Elements whose content is dropped entirely, not just unwrapped
const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'META', 'LINK', 'TITLE']);

const cleanStyle = (style: string) => {
  const align = /text-align\s*:\s*(left|right|center|justify)/i.exec(style);
  return align ? `text-align: ${align[1].toLowerCase()}` : '';
};

const cleanNode = (node: Node) => {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.COMMENT_NODE) {
      child.remove();
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as HTMLElement;
    if (DROP_TAGS.has(el.tagName)) {
      el.remove();
      continue;
    }
    cleanNode(el);
    if (!ALLOWED_TAGS.has(el.tagName)) {
      el.replaceWith(...Array.from(el.childNodes));
      continue;
    }
    const keep = ALLOWED_ATTRS[el.tagName] || [];
    const style = cleanStyle(el.getAttribute('style') || '');
    for (const attr of Array.from(el.attributes)) {
      if (!keep.includes(attr.name.toLowerCase())) el.removeAttribute(attr.name);
    }
    if (style) el.setAttribute('style', style);
  }
};

/** Strips scripts, links, images and unknown formatting, keeping text styles, lists, tables and alignment. */
export const sanitizeRichText = (html: string): string => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  cleanNode(doc.body);
  return doc.body.innerHTML;
};

/** True when a page has no visible text or table */
export const isRichTextEmpty = (html: string) => {
  if (!html) return true;
  if (/<(table|hr)\b/i.test(html)) return false;
  return !html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
};
