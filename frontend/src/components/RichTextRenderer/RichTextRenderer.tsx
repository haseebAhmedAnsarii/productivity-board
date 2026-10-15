import './RichTextRenderer.css';
import React from 'react';

/**
 * Strips HTML and Markdown formatting to extract a clean single-line plain-text snippet
 * for compact display on Kanban cards, table cells, and list rows.
 */
export const stripRichTextToSnippet = (content?: string | null): string => {
  if (!content) return '';
  return content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Heal any corrupted attribute leakage before stripping
    .replace(/\[blank["']\s+rel=["'][^"']*["'][^>]*>\s*([^\]]+)\]\([^)]+\)/gi, '$1')
    .replace(/(<a\b[^>]*>)\s*blank["']\s+rel=["'][^"']*["'][^>]*>\s*/gi, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/-\s+\[[ xX]\]\s+/g, '')
    .replace(/[-*+]\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Parses markdown syntax and sanitizes HTML tags to produce safe, fully clickable rich HTML markup.
 * Uses strict HTML-tag protection so markdown formatting rules never mutate HTML attributes or existing tags.
 */
export const parseAndSanitizeRichText = (rawContent?: string | null): string => {
  if (!rawContent || !rawContent.trim()) return '';

  let text = rawContent;

  // 1. Heal any prior corrupted attribute leakage in markdown or HTML
  // e.g. [blank" rel="noopener noreferrer" title="https://a.com">a](https://a.com/) -> [a](https://a.com/)
  text = text.replace(
    /\[blank["']\s+rel=["'][^"']*["'][^>]*>\s*([^\]]+)\]/gi,
    '[$1]'
  );
  // e.g. <a ...>blank" rel="noopener noreferrer" title="...">a</a> -> <a ...>a</a>
  text = text.replace(
    /(<a\b[^>]*>)\s*blank["']\s+rel=["'][^"']*["'][^>]*>\s*/gi,
    '$1'
  );

  // 2. Preserve fenced code blocks so code contents are untouched
  const codeBlocks: string[] = [];
  text = text.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, (_match, _lang, code) => {
    const placeholder = `\uE002CODE_BLOCK_${codeBlocks.length}\uE003`;
    codeBlocks.push(`<pre><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim()}</code></pre>`);
    return placeholder;
  });

  // 3. Protect ALL existing HTML tags so markdown regexes NEVER touch HTML tags or attributes
  const htmlTags: string[] = [];
  text = text.replace(/<[^>]+>/g, (tag) => {
    const placeholder = `\uE000HTML_TAG_${htmlTags.length}\uE001`;
    htmlTags.push(tag);
    return placeholder;
  });

  // 4. Convert markdown links: [text](url)
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+|[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // 5. Convert markdown headers (#, ##, ###) at start of lines
  text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // 6. Convert blockquotes (> quote)
  text = text.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

  // 7. Convert horizontal rules (---, ***, ___)
  text = text.replace(/^(?:---|---|\*\*\*|___)\s*$/gim, '<hr />');

  // 8. Convert task checklists (- [ ] or - [x])
  text = text.replace(
    /^[-*]\s+\[ \]\s+(.*)$/gim,
    '<li class="rich-checklist-item"><input type="checkbox" disabled /> <span>$1</span></li>'
  );
  text = text.replace(
    /^[-*]\s+\[[xX]\]\s+(.*)$/gim,
    '<li class="rich-checklist-item"><input type="checkbox" checked disabled /> <span style="text-decoration: line-through; opacity: 0.8;">$1</span></li>'
  );

  // 9. Convert unordered lists (- or *)
  text = text.replace(/^[-*]\s+(?!\[[ xX]\])(.*)$/gim, '<li>$1</li>');

  // 10. Convert ordered lists (1. )
  text = text.replace(/^\d+\.\s+(.*)$/gim, '<li data-ordered="true">$1</li>');

  // 11. Wrap newly created consecutive <li> (that are not already wrapped in <ul> or <ol>)
  text = text.replace(/(<li[\s\S]*?<\/li>\s*)+/gi, (match) => {
    if (match.includes('rich-checklist-item')) {
      return `<ul class="rich-checklist">${match}</ul>`;
    }
    if (match.includes('data-ordered="true"')) {
      return `<ol>${match.replace(/ data-ordered="true"/g, '')}</ol>`;
    }
    return `<ul>${match}</ul>`;
  });

  // 12. Convert bold (**text** or __text__)
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(?:^|\W)__([^_]+)__(?=\W|$)/g, (match, p1) => {
    const prefix = match.startsWith('__') ? '' : match[0];
    return `${prefix}<strong>${p1}</strong>`;
  });

  // 13. Convert italic (*text* or _text_)
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  text = text.replace(/(?:^|\W)_([^_]+)_(?=\W|$)/g, (match, p1) => {
    const prefix = match.startsWith('_') ? '' : match[0];
    return `${prefix}<em>${p1}</em>`;
  });

  // 14. Convert strikethrough (~~text~~)
  text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  // 15. Convert highlight (==text==)
  text = text.replace(/==([^=]+)==/g, '<mark>$1</mark>');

  // 16. Convert inline code (`code`)
  text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // 17. Restore fenced code blocks
  codeBlocks.forEach((block, idx) => {
    text = text.replace(`\uE002CODE_BLOCK_${idx}\uE003`, block);
  });

  // 18. Restore protected HTML tags
  text = text.replace(/\uE000HTML_TAG_(\d+)\uE001/g, (_match, idStr) => {
    return htmlTags[parseInt(idStr, 10)];
  });

  // 19. Wrap plain paragraphs if no block tags exist
  const hasBlocks = /<(p|div|h[1-6]|ul|ol|li|blockquote|pre|hr)\b/i.test(text);
  if (!hasBlocks) {
    const paragraphs = text.split(/\n{2,}/);
    text = paragraphs
      .map((p) => {
        const trimmed = p.trim();
        if (!trimmed) return '';
        return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`;
      })
      .filter(Boolean)
      .join('');
  }

  // 20. Normalize and validate all <a> tags safely
  text = text.replace(/<a\b([^>]*)>(.*?)<\/a>/gi, (_match, attrs, linkBody) => {
    const hrefMatch = attrs.match(/href=["']([^"']*)["']/i);
    let href = hrefMatch ? hrefMatch[1].trim() : '#';
    if (
      href !== '#' &&
      !/^https?:\/\//i.test(href) &&
      !/^mailto:/i.test(href) &&
      !href.startsWith('#') &&
      !href.startsWith('/')
    ) {
      href = `https://${href}`;
    }

    // Clean any residual attribute string that might have leaked into inner text
    const cleanBody = linkBody.replace(/^blank["']\s+rel=["'][^"']*["'][^>]*>\s*/i, '');
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" title="${href}">${cleanBody}</a>`;
  });

  // 21. Security Sanitization: Remove dangerous script, style, iframe tags and inline event handlers
  text = text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/href=["']javascript:[^"']*["']/gi, 'href="#"');

  return text;
};

interface RichTextRendererProps {
  content?: string | null;
  className?: string;
  placeholder?: string;
}

export const RichTextRenderer: React.FC<RichTextRendererProps> = ({
  content,
  className = '',
  placeholder = 'No description provided.',
}) => {
  if (!content || !content.trim()) {
    return <div className={`rich-text-placeholder ${className}`}>{placeholder}</div>;
  }

  const sanitizedHtml = parseAndSanitizeRichText(content);

  return (
    <div
      className={`rich-text-rendered-body ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      onClick={(e) => {
        // Ensure link clicks open properly even in containers
        const target = e.target as HTMLElement;
        const link = target.closest('a');
        if (link && link.href) {
          e.stopPropagation();
        }
      }}
    />
  );
};
