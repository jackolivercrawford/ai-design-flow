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
    [key: string]: string;
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

// Helper function to convert hex to HSL for DaisyUI
function hexToHSL(hex: string): string {
  // Remove the hash if present
  hex = hex.replace('#', '');
  
  // Convert hex to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  // Convert to degrees and percentages
  const hDeg = Math.round(h * 360);
  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);

  return `${hDeg} ${sPct}% ${lPct}%`;
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
      // 2. Remove export statements but preserve the component name
      const exportMatch = transformedCode.match(/export\s+default\s+(\w+)/);
      const componentName = exportMatch ? exportMatch[1] : null;
      transformedCode = transformedCode.replace(/export\s+default\s+\w+;?/, '');
      transformedCode = transformedCode.replace(/export\s+/, '');
      // 3. Remove inline type assertions
      transformedCode = transformedCode.replace(/\sas\s+\w+/g, '');

      // Escape the final code so it can be safely embedded
      const safeCode = JSON.stringify(transformedCode);

      // Build the DaisyUI theme style block using the colorScheme
      const daisyuiTheme = colorScheme
        ? `
          <script>
            tailwind.config = {
              theme: {
                extend: {},
              },
              daisyui: {
                styled: true,
                themes: false,
                base: true,
                utils: true,
                logs: false,
                rtl: false
              }
            }
          </script>
          <style>
            [data-theme="custom"] {
              /* Primary colors */
              --p: ${hexToHSL(colorScheme.primary)} !important;
              --pf: ${hexToHSL(colorScheme['primary-focus'])} !important;
              --pc: ${hexToHSL(colorScheme['primary-content'])} !important;
              
              /* Secondary colors */
              --s: ${hexToHSL(colorScheme.secondary)} !important;
              --sf: ${hexToHSL(colorScheme['secondary-focus'])} !important;
              --sc: ${hexToHSL(colorScheme['secondary-content'])} !important;
              
              /* Accent colors */
              --a: ${hexToHSL(colorScheme.accent)} !important;
              --af: ${hexToHSL(colorScheme['accent-focus'])} !important;
              --ac: ${hexToHSL(colorScheme['accent-content'])} !important;
              
              /* Neutral colors */
              --n: ${hexToHSL(colorScheme.neutral)} !important;
              --nf: ${hexToHSL(colorScheme['neutral-focus'])} !important;
              --nc: ${hexToHSL(colorScheme['neutral-content'])} !important;
              
              /* Base colors */
              --b1: ${hexToHSL(colorScheme['base-100'])} !important;
              --b2: ${hexToHSL(colorScheme['base-200'])} !important;
              --b3: ${hexToHSL(colorScheme['base-300'])} !important;
              --bc: ${hexToHSL(colorScheme['base-content'])} !important;
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

              try {
                // Transpile the code with Babel
                const transformed = Babel.transform(fullCode, { 
                  filename: 'file.tsx', 
                  presets: ['react', 'typescript'],
                  retainLines: true
                }).code;
                
                // Evaluate the transformed code
                eval(transformed);

                // Try to find the component using the exported name first
                let MainComponent = ${componentName ? componentName : 'null'};
                
                // If not found by name, try to find it by scanning window object
                if (!MainComponent) {
                  const components = Object.values(window).filter(
                    val => typeof val === 'function' && 
                          /^[A-Z]/.test(val?.name || '') &&
                          val.toString().includes('React.createElement')
                  );
                  MainComponent = components[components.length - 1];
                }

                if (MainComponent) {
                  const root = ReactDOM.createRoot(document.getElementById('root'));
                  root.render(
                    <React.StrictMode>
                      <MainComponent />
                    </React.StrictMode>
                  );
                } else {
                  document.getElementById('root').innerHTML =
                    '<div style="padding: 1rem; color: red;">No React component found in the code. Please ensure the code includes a properly named React component with a default export.</div>';
                }
              } catch (error) {
                document.getElementById('root').innerHTML =
                  '<div style="padding: 1rem; color: red;">Error evaluating component: ' + error.message + '</div>';
                console.error('Component evaluation error:', error);
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
