
export const htmlToJSX = (html: string): string => {
  let jsx = html;

  // Replace class with className
  jsx = jsx.replace(/class=/g, 'className=');

  // Replace for with htmlFor
  jsx = jsx.replace(/for=/g, 'htmlFor=');

  // Close common void tags
  const voidTags = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
  
  voidTags.forEach(tag => {
    // Regex to match <tag ... > (without />) and replace with <tag ... />
    // This is a basic approximation and might not cover all edge cases perfectly
    const regex = new RegExp(`<(${tag})\\b([^>]*)(?<!/)>`, 'gi');
    jsx = jsx.replace(regex, '<$1$2 />');
  });

  // Replace comments
  jsx = jsx.replace(/<!--([\s\S]*?)-->/g, '{/*$1*/}');

  // Handle style strings (simplistic approach: just warn or wrap? React expects object)
  // For this utility, we'll assume the AI generates Tailwind classes predominantly.
  // Converting inline style strings to objects is complex regex; we'll assume users handle that if present.
  
  // Return wrapper for direct copy-paste valid component
  return `export default function GeneratedComponent() {
  return (
    <>
${jsx
  .split('\n')
  .map(line => '      ' + line)
  .join('\n')}
    </>
  );
}`;
};
