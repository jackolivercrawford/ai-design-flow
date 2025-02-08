import React, { useEffect, useRef } from 'react';

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

      // Build the custom theme style block using your colorScheme.
      // Note: DaisyUI uses CSS variables like --p (primary), --s (secondary),
      // --a (accent), --base-100 (background), and --base-content (text).
      const customThemeStyle = colorScheme
        ? `
          <style>
            :root {
              --p: ${colorScheme.primary};
              --primary: ${colorScheme.primary};
              --p-content: #ffffff;
              --s: ${colorScheme.secondary};
              --secondary: ${colorScheme.secondary};
              --s-content: #ffffff;
              --a: ${colorScheme.accent};
              --accent: ${colorScheme.accent};
              --a-content: #ffffff;
              --base-100: ${colorScheme.background};
              --base-content: ${colorScheme.text};
            }
          </style>
        `
        : '';

      // Build the HTML content for the iframe.
      // IMPORTANT: Place the customThemeStyle right after the DaisyUI link so that it overrides the default colors.
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <!-- Load Tailwind CSS -->
            <script src="https://cdn.tailwindcss.com"></script>
            <!-- Load DaisyUI (must be loaded after Tailwind) -->
            <link href="https://cdn.jsdelivr.net/npm/daisyui@2.51.5/dist/full.css" rel="stylesheet">
            ${customThemeStyle}
            <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
            <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
            <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
            <style>
              body { margin: 0; padding: 1rem; }
            </style>
          </head>
          <body>
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
          <div style="padding: 1rem; color: red;">
            <h2 style="font-size: 1.25rem; font-weight: 600;">Error Rendering Preview</h2>
            <pre style="font-size: 0.875rem; overflow:auto;">
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
