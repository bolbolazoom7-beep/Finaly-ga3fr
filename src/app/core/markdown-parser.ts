import katex from 'katex';

/**
 * Advanced rich content and markdown parser for Ja3far AI.
 * Handles:
 * - Code blocks with copy button, syntax look, and language indicator
 * - KaTeX LaTeX mathematical equations ($inline$ and $$block$$)
 * - Tables with responsive mobile-friendly scrolling
 * - Callout boxes (Notes, Warnings, Tips, Important)
 * - Safe interactive links (blocks javascript:, adds target="_blank" rel="noopener noreferrer")
 * - Headings, lists, bold, italics, blockquotes, inline code
 */

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(rawUrl: string): string {
  try {
    const trimmed = rawUrl.trim();
    if (/^(?:javascript|vbscript|data):/i.test(trimmed)) {
      return '#';
    }
    if (/^(?:https?:\/\/|mailto:)/i.test(trimmed)) {
      return trimmed;
    }
    // Relative link
    if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
      return trimmed;
    }
    return `https://${trimmed}`;
  } catch {
    return '#';
  }
}

export function parseMarkdown(text: string): string {
  if (!text) return '';

  const protectedPlaceholders: { placeholder: string; html: string }[] = [];
  let placeholderCounter = 0;

  // 1. Extract and render multi-line code blocks ```lang ... ```
  let processed = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const language = (lang || 'code').trim();
    const rawCode = code.trimEnd();
    const escapedCode = escapeHtml(rawCode);
    const placeholder = `%%CODE_BLOCK_${placeholderCounter++}%%`;
    const blockHtml = `
<div class="my-3 rounded-xl overflow-hidden border border-white/10 dark:border-white/10 light:border-black/10 bg-[#16161D] dark:bg-[#16161D] light:bg-[#F3EFE9] text-left shadow-sm" dir="ltr">
  <div class="flex items-center justify-between px-3.5 py-1.5 bg-[#1F1F28] dark:bg-[#1F1F28] light:bg-[#E8E3DA] border-b border-white/5 dark:border-white/5 light:border-black/5 text-xs text-[#A6A2B3] dark:text-[#A6A2B3] light:text-[#5E5A69]">
    <div class="flex items-center gap-1.5">
      <span class="w-2.5 h-2.5 rounded-full bg-rose-500/70 inline-block"></span>
      <span class="w-2.5 h-2.5 rounded-full bg-amber-500/70 inline-block"></span>
      <span class="w-2.5 h-2.5 rounded-full bg-emerald-500/70 inline-block"></span>
      <span class="font-mono font-medium ml-1 text-[11px] text-[#A994F7] uppercase">${escapeHtml(language)}</span>
    </div>
    <button type="button" class="copy-code-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-sans font-medium text-[#E6E4EC] dark:text-[#E6E4EC] light:text-stone-800 hover:bg-white/10 dark:hover:bg-white/10 light:hover:bg-black/5 transition-colors cursor-pointer" data-code="${encodeURIComponent(rawCode)}">
      <span class="material-icons" style="font-size: 13px;">content_copy</span>
      <span>نسخ</span>
    </button>
  </div>
  <pre class="p-4 text-xs font-mono overflow-x-auto text-[#E6E4EC] dark:text-[#E6E4EC] light:text-stone-900 leading-relaxed"><code>${escapedCode}</code></pre>
</div>`;
    protectedPlaceholders.push({ placeholder, html: blockHtml });
    return placeholder;
  });

  // 2. Extract and render LaTeX Block Equations: $$ equation $$
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_, mathEquation) => {
    const rawEquation = mathEquation.trim();
    let rendered = '';
    try {
      rendered = katex.renderToString(rawEquation, {
        displayMode: true,
        throwOnError: false,
      });
    } catch {
      rendered = `<div class="font-mono text-center my-2 text-sm text-[#A994F7]">${escapeHtml(rawEquation)}</div>`;
    }
    const placeholder = `%%MATH_BLOCK_${placeholderCounter++}%%`;
    const html = `<div class="my-3 py-2 px-3 overflow-x-auto rounded-xl bg-white/5 dark:bg-white/5 light:bg-black/5 text-center" dir="ltr">${rendered}</div>`;
    protectedPlaceholders.push({ placeholder, html });
    return placeholder;
  });

  // 3. Extract and render LaTeX Inline Equations: $ equation $
  processed = processed.replace(/\$([^$\n]+?)\$/g, (_, mathEquation) => {
    const rawEquation = mathEquation.trim();
    let rendered = '';
    try {
      rendered = katex.renderToString(rawEquation, {
        displayMode: false,
        throwOnError: false,
      });
    } catch {
      rendered = `<span class="font-mono text-xs text-[#A994F7]">${escapeHtml(rawEquation)}</span>`;
    }
    const placeholder = `%%MATH_INLINE_${placeholderCounter++}%%`;
    protectedPlaceholders.push({ placeholder, html: `<span class="inline-math mx-0.5" dir="ltr">${rendered}</span>` });
    return placeholder;
  });

  // 4. Escape general HTML to prevent XSS
  processed = escapeHtml(processed);

  // 5. Parse Markdown Tables
  const tableRegex = /((?:^|\n)\|[^\n]+\|\n\|[\s-:]+\|\n(?:\|[^\n]+\|\n?)+)/g;
  processed = processed.replace(tableRegex, (match) => {
    const lines = match.trim().split('\n');
    if (lines.length < 3) return match;

    const headerLine = lines[0];
    const dataLines = lines.slice(2);

    const parseRow = (line: string) =>
      line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());

    const headers = parseRow(headerLine);
    const rows = dataLines.map((l) => parseRow(l));

    let tableHtml = `
<div class="my-3 overflow-x-auto rounded-xl border border-white/10 dark:border-white/10 light:border-black/10 shadow-sm">
  <table class="w-full text-xs md:text-sm text-right border-collapse">
    <thead>
      <tr class="bg-white/5 dark:bg-white/5 light:bg-black/5 border-b border-white/10 dark:border-white/10 light:border-black/10">`;

    for (const h of headers) {
      tableHtml += `<th class="px-3.5 py-2.5 font-semibold text-[#A994F7]">${h}</th>`;
    }
    tableHtml += `</tr></thead><tbody class="divide-y divide-white/5 dark:divide-white/5 light:divide-black/5">`;

    for (const row of rows) {
      tableHtml += `<tr class="hover:bg-white/5 dark:hover:bg-white/5 light:hover:bg-black/5 transition-colors">`;
      for (const cell of row) {
        tableHtml += `<td class="px-3.5 py-2 text-inherit">${cell}</td>`;
      }
      tableHtml += `</tr>`;
    }

    tableHtml += `</tbody></table></div>`;

    const placeholder = `%%TABLE_BLOCK_${placeholderCounter++}%%`;
    protectedPlaceholders.push({ placeholder, html: tableHtml });
    return placeholder;
  });

  // 6. Callout Blocks: > [!NOTE], > [!WARNING], > [!TIP], > [!IMPORTANT]
  processed = processed.replace(
    /^&gt;\s*\[!(NOTE|INFO|TIP|WARNING|CAUTION|IMPORTANT)\]\s*(.*)$/gim,
    (_, type, title) => {
      const calloutType = type.toUpperCase();
      let icon = 'info';
      let borderClass = 'border-[#8BCFC2]';
      let bgClass = 'bg-[#8BCFC2]/10';
      let textClass = 'text-[#8BCFC2]';
      let label = title || 'ملاحظة';

      if (calloutType === 'WARNING' || calloutType === 'CAUTION') {
        icon = 'warning_amber';
        borderClass = 'border-amber-400';
        bgClass = 'bg-amber-400/10';
        textClass = 'text-amber-300';
        label = title || 'تنبيه هام';
      } else if (calloutType === 'TIP') {
        icon = 'lightbulb';
        borderClass = 'border-[#A994F7]';
        bgClass = 'bg-[#A994F7]/10';
        textClass = 'text-[#A994F7]';
        label = title || 'نصيحة مفيدة';
      } else if (calloutType === 'IMPORTANT') {
        icon = 'priority_high';
        borderClass = 'border-rose-400';
        bgClass = 'bg-rose-400/10';
        textClass = 'text-rose-300';
        label = title || 'هام للغاية';
      }

      return `<div class="my-2.5 p-3 rounded-xl border-r-4 ${borderClass} ${bgClass} text-xs md:text-sm flex items-start gap-2.5">
        <span class="material-icons shrink-0 ${textClass}" style="font-size: 18px;">${icon}</span>
        <div class="flex-1 font-medium ${textClass}">${label}</div>
      </div>`;
    }
  );

  // 7. Regular blockquotes
  processed = processed.replace(
    /^&gt;\s*(.*$)/gim,
    '<blockquote class="border-r-2 border-[#A994F7] pr-3 my-2 text-xs md:text-sm text-[#A6A2B3] dark:text-[#A6A2B3] light:text-stone-600 italic bg-white/[0.02] dark:bg-white/[0.02] light:bg-black/[0.02] py-1 rounded-l">$1</blockquote>'
  );

  // 8. Inline code: `code`
  processed = processed.replace(/`([^`]+)`/g, (_, code) => {
    return `<code class="px-1.5 py-0.5 mx-0.5 rounded-md bg-white/10 dark:bg-white/10 light:bg-black/10 text-[#A994F7] dark:text-[#A994F7] light:text-[#7C5CE6] font-mono text-xs font-semibold">${code}</code>`;
  });

  // 9. Interactive links: [title](url)
  processed = processed.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, textLabel, url) => {
      const cleanUrl = sanitizeUrl(url);
      return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-baseline gap-0.5 text-[#A994F7] dark:text-[#A994F7] light:text-[#7C5CE6] hover:underline font-medium cursor-pointer break-all"><span>${textLabel}</span><span class="material-icons text-[10px] inline-block opacity-70">open_in_new</span></a>`;
    }
  );

  // 10. Auto-detect raw valid URLs and make them clickable (https://... or http://...)
  // Skip already replaced placeholders
  processed = processed.replace(
    /(https?:\/\/[^\s<>"']+)/gi,
    (matchedUrl) => {
      if (matchedUrl.includes('%%')) return matchedUrl;
      const cleanUrl = sanitizeUrl(matchedUrl);
      return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="text-[#8BCFC2] dark:text-[#8BCFC2] light:text-teal-700 hover:underline font-mono text-xs break-all inline-flex items-baseline gap-0.5"><span>${matchedUrl}</span><span class="material-icons text-[10px] inline-block opacity-70">open_in_new</span></a>`;
    }
  );

  // 11. Headers
  processed = processed.replace(
    /^#### (.*$)/gim,
    '<h5 class="text-xs md:text-sm font-bold text-[#8BCFC2] dark:text-[#8BCFC2] light:text-teal-700 mt-2.5 mb-1">$1</h5>'
  );
  processed = processed.replace(
    /^### (.*$)/gim,
    '<h4 class="text-sm md:text-base font-bold text-[#8BCFC2] dark:text-[#8BCFC2] light:text-teal-700 mt-3 mb-1.5">$1</h4>'
  );
  processed = processed.replace(
    /^## (.*$)/gim,
    '<h3 class="text-base md:text-lg font-bold text-[#A994F7] dark:text-[#A994F7] light:text-[#7C5CE6] mt-3.5 mb-2">$1</h3>'
  );
  processed = processed.replace(
    /^# (.*$)/gim,
    '<h2 class="text-lg md:text-xl font-bold text-white dark:text-white light:text-stone-900 mt-4 mb-2">$1</h2>'
  );

  // 12. Bold & Italic
  processed = processed.replace(
    /\*\*([^*]+)\*\*/g,
    '<strong class="font-bold text-white dark:text-white light:text-stone-900">$1</strong>'
  );
  processed = processed.replace(
    /\*([^*]+)\*/g,
    '<em class="italic text-inherit opacity-90">$1</em>'
  );

  // 13. Lists
  processed = processed.replace(
    /^\s*[-*]\s+(.*)$/gim,
    '<li class="my-1 text-xs md:text-sm list-disc list-inside leading-relaxed">$1</li>'
  );
  processed = processed.replace(
    /^\s*(\d+)\.\s+(.*)$/gim,
    '<li class="my-1 text-xs md:text-sm list-decimal list-inside leading-relaxed">$2</li>'
  );

  // 14. Paragraphs and line breaks
  processed = processed.replace(/\n\n+/g, '</p><p class="my-2.5">');
  processed = processed.replace(/\n/g, '<br/>');

  // 15. Restore protected elements
  for (const item of protectedPlaceholders) {
    processed = processed.replace(item.placeholder, item.html);
  }

  return `<div class="leading-relaxed text-xs md:text-sm break-words">${processed}</div>`;
}
