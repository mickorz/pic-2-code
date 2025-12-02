

export interface AuditIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  element?: string;
}

export const scanHTML = (html: string): { score: number; issues: AuditIssue[] } => {
  const issues: AuditIssue[] = [];
  let score = 100;

  if (!html) return { score: 0, issues: [] };

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 1. Check images for alt attributes
  const images = doc.querySelectorAll('img');
  images.forEach((img, idx) => {
    if (!img.hasAttribute('alt') || img.getAttribute('alt')?.trim() === '') {
      score -= 5;
      issues.push({
        id: `img-alt-${idx}`,
        severity: 'error',
        message: 'Image missing alt attribute',
        element: img.outerHTML.substring(0, 50) + '...'
      });
    }
  });

  // 2. Check buttons for accessible names
  const buttons = doc.querySelectorAll('button');
  buttons.forEach((btn, idx) => {
    const text = btn.textContent?.trim();
    const label = btn.getAttribute('aria-label');
    const labelledBy = btn.getAttribute('aria-labelledby');
    
    if (!text && !label && !labelledBy) {
      score -= 10;
      issues.push({
        id: `btn-label-${idx}`,
        severity: 'error',
        message: 'Button missing accessible name (text or aria-label)',
        element: btn.outerHTML.substring(0, 50) + '...'
      });
    }
  });

  // 3. Check inputs for labels
  const inputs = doc.querySelectorAll('input:not([type="hidden"]), textarea, select');
  inputs.forEach((input, idx) => {
    const id = input.getAttribute('id');
    const label = id ? doc.querySelector(`label[for="${id}"]`) : null;
    const ariaLabel = input.getAttribute('aria-label');
    
    if (!label && !ariaLabel) {
      score -= 5;
      issues.push({
        id: `input-label-${idx}`,
        severity: 'warning',
        message: 'Form input missing associated label',
        element: input.outerHTML.substring(0, 50) + '...'
      });
    }
  });

  // 4. Semantic Landmarks
  if (!doc.querySelector('main')) {
    score -= 5;
    issues.push({ id: 'landmark-main', severity: 'info', message: 'Consider adding a <main> landmark' });
  }
  if (!doc.querySelector('h1')) {
    score -= 5;
    issues.push({ id: 'heading-h1', severity: 'info', message: 'Page should ideally have one <h1> heading' });
  }

  // 5. Link Safety
  const links = doc.querySelectorAll('a[target="_blank"]');
  links.forEach((link, idx) => {
    const rel = link.getAttribute('rel');
    if (!rel || !rel.includes('noopener') || !rel.includes('noreferrer')) {
      score -= 2;
      issues.push({
        id: `link-safe-${idx}`,
        severity: 'warning',
        message: 'External links should have rel="noopener noreferrer"',
        element: link.outerHTML.substring(0, 50) + '...'
      });
    }
  });

  // 6. Contrast Checks (Basic Tailwind Heuristics)
  const allElements = doc.querySelectorAll('*');
  allElements.forEach((el, idx) => {
    const cls = el.getAttribute('class') || '';
    
    // Check for light gray text on white/light backgrounds
    // Common tailwind light backgrounds: bg-white, bg-gray-50, bg-slate-50, etc.
    const hasLightBg = cls.includes('bg-white') || cls.includes('bg-gray-50') || cls.includes('bg-slate-50') || cls.includes('bg-zinc-50');
    // Common tailwind light text: text-gray-100 to text-gray-400
    const hasLightText = /\btext-(gray|slate|zinc|neutral|stone)-(100|200|300|400)\b/.test(cls);

    if (hasLightBg && hasLightText) {
      score -= 5;
      issues.push({
        id: `contrast-light-${idx}`,
        severity: 'warning',
        message: 'Potential low contrast: Light text on light background detected.',
        element: el.outerHTML.substring(0, 50) + '...'
      });
    }

    // Check for dark text on dark backgrounds (if explicit)
    // Common tailwind dark backgrounds
    const hasDarkBg = cls.includes('bg-gray-900') || cls.includes('bg-black') || cls.includes('bg-slate-900') || cls.includes('bg-zinc-900');
    // Common tailwind dark text
    const hasDarkText = /\btext-(gray|slate|zinc|neutral|stone)-(600|700|800|900)\b/.test(cls);
     
    if (hasDarkBg && hasDarkText) {
      score -= 5;
      issues.push({
        id: `contrast-dark-${idx}`,
        severity: 'warning',
        message: 'Potential low contrast: Dark text on dark background detected.',
        element: el.outerHTML.substring(0, 50) + '...'
      });
    }
  });

  return { score: Math.max(0, score), issues };
};