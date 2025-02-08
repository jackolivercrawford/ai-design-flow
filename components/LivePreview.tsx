import React, { useEffect, useRef } from 'react';

interface LivePreviewProps {
  code: string;
  colorScheme?: {
    primary: string;
    'primary-focus': string;
    'primary-content': string;
    secondary: string;
    'secondary-focus': string;
    'secondary-content': string;
    accent: string;
    'accent-focus': string;
    'accent-content': string;
    neutral: string;
    'neutral-focus': string;
    'neutral-content': string;
    'base-100': string;
    'base-200': string;
    'base-300': string;
    'base-content': string;
    info: string;
    success: string;
    warning: string;
    error: string;
  };
}

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

const LivePreview: React.FC<LivePreviewProps> = ({ code, colorScheme }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !code) return;

    try {
      // Clean up previous content
      while (containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild);
      }

      // Create an iframe for the preview
      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      containerRef.current.appendChild(iframe);

      // Transform the code:
      // 1. Remove import statements (React is provided globally)
      let transformedCode = code;
      transformedCode = transformedCode.replace(/import\s+{([^}]+)}\s+from\s+['"]react['"];?/g, '');
      transformedCode = transformedCode.replace(/import\s+React\s*,?\s*{([^}]+)}\s+from\s+['"]react['"];?/g, '');
      transformedCode = transformedCode.replace(/import\s+.*?from\s+['"].*?['"];?\n?/g, '');
      // 2. Remove export statements
      transformedCode = transformedCode.replace(/export\s+default\s+/, '');
      transformedCode = transformedCode.replace(/export\s+/, '');
      // 3. Remove inline type assertions
      transformedCode = transformedCode.replace(/\sas\s+\w+/g, '');

      // Escape the final code so it can be safely embedded
      const safeCode = JSON.stringify(transformedCode);

      // Build the DaisyUI theme style block using the colorScheme
      const daisyuiTheme = colorScheme
        ? `
          <style>
            [data-theme="custom"] {
              /* Primary colors */
              --p: ${colorScheme.primary};
              --pf: ${colorScheme['primary-focus']};
              --pc: ${colorScheme['primary-content']};
              
              /* Secondary colors */
              --s: ${colorScheme.secondary};
              --sf: ${colorScheme['secondary-focus']};
              --sc: ${colorScheme['secondary-content']};
              
              /* Accent colors */
              --a: ${colorScheme.accent};
              --af: ${colorScheme['accent-focus']};
              --ac: ${colorScheme['accent-content']};
              
              /* Neutral colors */
              --n: ${colorScheme.neutral};
              --nf: ${colorScheme['neutral-focus']};
              --nc: ${colorScheme['neutral-content']};
              
              /* Base colors */
              --b1: ${colorScheme['base-100']};
              --b2: ${colorScheme['base-200']};
              --b3: ${colorScheme['base-300']};
              --bc: ${colorScheme['base-content']};
              
              /* State colors */
              --in: ${colorScheme.info};
              --su: ${colorScheme.success};
              --wa: ${colorScheme.warning};
              --er: ${colorScheme.error};
            }
          </style>
        `
        : '';

      // Build the HTML content for the iframe
      const html = `
        <!DOCTYPE html>
        <html data-theme="custom">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://cdn.jsdelivr.net/npm/daisyui@2.51.5/dist/full.css" rel="stylesheet">
            ${daisyuiTheme}
            <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
            <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
            <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
            <style>
              body { margin: 0; padding: 1rem; }
              * { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
            </style>
          </head>
          <body data-theme="custom">
            <div id="root"></div>
            <script type="text/babel" data-presets="react,typescript">
              // Dummy type definitions to avoid runtime errors
              window.FormEvent = function(target) { return {}; };
              window.ChangeEvent = function(target) { return {}; };
              window.MouseEvent = function(target) { return {}; };

              // Prepend React hook destructuring so hooks are available
              const prelude = "const { useState, useEffect, useRef, useMemo, useCallback, useContext, useReducer } = React;";
              
              // Retrieve the safe, escaped code string
              const code = ${safeCode};

              // Combine the prelude with the generated code
              const fullCode = prelude + code;

              // Transpile the code with Babel
              const transformed = Babel.transform(fullCode, { filename: 'file.tsx', presets: ['react', 'typescript'] }).code;
              eval(transformed);

              // Locate and render the main component
              const components = Object.values(window).filter(
                val => typeof val === 'function' && /^[A-Z]/.test(val?.name || '')
              );
              const MainComponent = components[components.length - 1];
              if (MainComponent) {
                const root = ReactDOM.createRoot(document.getElementById('root'));
                root.render(
                  <React.StrictMode>
                    <MainComponent />
                  </React.StrictMode>
                );
              } else {
                document.getElementById('root').innerHTML =
                  '<div style="padding: 1rem; color: red;">No React component found in the code</div>';
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
