import React, { useEffect, useRef } from 'react';

// Helper function to adjust hex colors
function adjustColor(hex: string, amount: number): string {
  try {
    // Remove the hash if present
    hex = hex.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Adjust each component
    const adjustComponent = (c: number) => {
      const newC = Math.min(255, Math.max(0, c + amount));
      const hexComponent = newC.toString(16);
      return hexComponent.length === 1 ? '0' + hexComponent : hexComponent;
    };
    
    // Convert back to hex
    return '#' + adjustComponent(r) + adjustComponent(g) + adjustComponent(b);
  } catch {
    // Return a fallback color if there's any error
    return amount > 0 ? '#3B82F6' : '#1E40AF';
  }
}

interface LivePreviewProps {
  code: string;
  colorScheme?: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
}

const LivePreview: React.FC<LivePreviewProps> = ({ code, colorScheme }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !code) return;

    try {
      // Remove any previous content
      while (containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild);
      }

      // Create a new iframe for sandboxed preview
      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      containerRef.current.appendChild(iframe);

      // Transform the code:
      // 1. Remove import statements (React will be provided as a global)
      let transformedCode = code;
      transformedCode = transformedCode.replace(/import\s+{([^}]+)}\s+from\s+['"]react['"];?/g, '');
      transformedCode = transformedCode.replace(/import\s+React\s*,?\s*{([^}]+)}\s+from\s+['"]react['"];?/g, '');
      transformedCode = transformedCode.replace(/import\s+.*?from\s+['"].*?['"];?\n?/g, '');
      
      // 2. Remove export statements (keep the component definition)
      transformedCode = transformedCode.replace(/export\s+default\s+/, '');
      transformedCode = transformedCode.replace(/export\s+/, '');
      
      // 3. Remove inline type assertions (e.g. " as ElevatorMode")
      transformedCode = transformedCode.replace(/\sas\s+\w+/g, '');

      // Escape the final code so it can be safely embedded
      const safeCode = JSON.stringify(transformedCode);

      // Build the HTML content for the iframe
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
            <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
            <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
            <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
            <style>
              body { margin: 0; padding: 1rem; }
              * { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
              
              /* Custom color scheme */
              :root {
                --color-primary: ${colorScheme?.primary || '#1D4ED8'};
                --color-secondary: ${colorScheme?.secondary || '#64748B'};
                --color-accent: ${colorScheme?.accent || '#F59E0B'};
                --color-background: ${colorScheme?.background || '#F3F4F6'};
                --color-text: ${colorScheme?.text || '#111827'};
                
                --color-primary-light: ${colorScheme?.primary ? adjustColor(colorScheme.primary, 20) : '#3B82F6'};
                --color-primary-dark: ${colorScheme?.primary ? adjustColor(colorScheme.primary, -20) : '#1E40AF'};
                --color-secondary-light: ${colorScheme?.secondary ? adjustColor(colorScheme.secondary, 20) : '#94A3B8'};
                --color-secondary-dark: ${colorScheme?.secondary ? adjustColor(colorScheme.secondary, -20) : '#475569'};
                --color-accent-light: ${colorScheme?.accent ? adjustColor(colorScheme.accent, 20) : '#FBBF24'};
                --color-accent-dark: ${colorScheme?.accent ? adjustColor(colorScheme.accent, -20) : '#D97706'};
              }
              
              /* Text colors */
              .text-primary { color: var(--color-primary); }
              .text-primary-light { color: var(--color-primary-light); }
              .text-primary-dark { color: var(--color-primary-dark); }
              .text-secondary { color: var(--color-secondary); }
              .text-secondary-light { color: var(--color-secondary-light); }
              .text-secondary-dark { color: var(--color-secondary-dark); }
              .text-accent { color: var(--color-accent); }
              .text-accent-light { color: var(--color-accent-light); }
              .text-accent-dark { color: var(--color-accent-dark); }
              .text-text { color: var(--color-text); }
              
              /* Background colors */
              .bg-primary { background-color: var(--color-primary); }
              .bg-primary-light { background-color: var(--color-primary-light); }
              .bg-primary-dark { background-color: var(--color-primary-dark); }
              .bg-secondary { background-color: var(--color-secondary); }
              .bg-secondary-light { background-color: var(--color-secondary-light); }
              .bg-secondary-dark { background-color: var(--color-secondary-dark); }
              .bg-accent { background-color: var(--color-accent); }
              .bg-accent-light { background-color: var(--color-accent-light); }
              .bg-accent-dark { background-color: var(--color-accent-dark); }
              .bg-background { background-color: var(--color-background); }
              
              /* Border colors */
              .border-primary { border-color: var(--color-primary); }
              .border-primary-light { border-color: var(--color-primary-light); }
              .border-primary-dark { border-color: var(--color-primary-dark); }
              .border-secondary { border-color: var(--color-secondary); }
              .border-secondary-light { border-color: var(--color-secondary-light); }
              .border-secondary-dark { border-color: var(--color-secondary-dark); }
              .border-accent { border-color: var(--color-accent); }
              .border-accent-light { border-color: var(--color-accent-light); }
              .border-accent-dark { border-color: var(--color-accent-dark); }
              
              /* Hover states */
              .hover\\:text-primary:hover { color: var(--color-primary); }
              .hover\\:text-primary-light:hover { color: var(--color-primary-light); }
              .hover\\:text-primary-dark:hover { color: var(--color-primary-dark); }
              .hover\\:text-secondary:hover { color: var(--color-secondary); }
              .hover\\:text-accent:hover { color: var(--color-accent); }
              
              .hover\\:bg-primary:hover { background-color: var(--color-primary); }
              .hover\\:bg-primary-light:hover { background-color: var(--color-primary-light); }
              .hover\\:bg-primary-dark:hover { background-color: var(--color-primary-dark); }
              .hover\\:bg-secondary:hover { background-color: var(--color-secondary); }
              .hover\\:bg-accent:hover { background-color: var(--color-accent); }
              
              /* Focus states */
              .focus\\:border-primary:focus { border-color: var(--color-primary); }
              .focus\\:border-accent:focus { border-color: var(--color-accent); }
              .focus\\:ring-primary:focus { --tw-ring-color: var(--color-primary); }
              .focus\\:ring-accent:focus { --tw-ring-color: var(--color-accent); }
              
              /* Active states */
              .active\\:bg-primary-dark:active { background-color: var(--color-primary-dark); }
              .active\\:bg-secondary-dark:active { background-color: var(--color-secondary-dark); }
              .active\\:bg-accent-dark:active { background-color: var(--color-accent-dark); }
              
              /* Disabled states */
              .disabled\\:bg-gray-300:disabled { background-color: #D1D5DB; }
              .disabled\\:text-gray-500:disabled { color: #6B7280; }
              
              /* Additional utility classes for transitions */
              .transition { transition-property: all; transition-duration: 200ms; }
              .transition-colors { transition-property: background-color, border-color, color, fill, stroke; transition-duration: 200ms; }
            </style>
          </head>
          <body>
            <div id="root"></div>
            <script type="text/babel" data-presets="react,typescript">
              // Dummy type definitions as functions to avoid runtime errors
              window.FormEvent = function(target) { return {}; };
              window.ChangeEvent = function(target) { return {}; };
              window.MouseEvent = function(target) { return {}; };

              // Retrieve the safe, escaped code string
              const code = ${safeCode};

              // Evaluate the generated code so that the component is defined
              eval(code);

              // Find and render the main component
              const components = Object.values(window).filter(
                val => typeof val === 'function' && /^[A-Z]/.test(val?.name || '')
              );
              const MainComponent = components[components.length - 1];
              if (MainComponent) {
                const root = ReactDOM.createRoot(document.getElementById('root'));
                root.render(
                  <React.StrictMode>
                    <ErrorBoundary>
                      <MainComponent />
                    </ErrorBoundary>
                  </React.StrictMode>
                );
              } else {
                document.getElementById('root').innerHTML =
                  '<div class="p-4 text-red-600 bg-red-50 rounded-lg">No React component found in the code</div>';
              }
            </script>
          </body>
        </html>
      `;

      const iframeDoc = iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(html);
        iframeDoc.close();
      }
    } catch (error) {
      console.error('Error rendering preview:', error);
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div class="p-4 text-red-600 bg-red-50 rounded-lg">
            <h2 class="text-lg font-semibold mb-2">Error Rendering Preview</h2>
            <pre class="text-sm overflow-auto">
              ${error instanceof Error ? error.message : 'Unknown error occurred'}
            </pre>
          </div>
        `;
      }
    }
  }, [code, colorScheme]);

  return (
    <div ref={containerRef} className="w-full h-full bg-white">
      <div className="flex items-center justify-center h-full text-gray-400">
        Loading preview...
      </div>
    </div>
  );
};

export default LivePreview;