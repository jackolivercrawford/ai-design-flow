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

// Function to sanitize code before processing
function sanitizeCode(code: string): string {
  // Remove any attempts to access window.parent or top
  code = code.replace(/window\.parent|window\.top|parent\.|top\./g, 'undefined');
  
  // Remove any attempts to use dangerous APIs
  code = code.replace(
    /document\.cookie|localStorage|sessionStorage|indexedDB|openDatabase|WebSocket|fetch|XMLHttpRequest|navigator\.|location\./g,
    'undefined'
  );
  
  // Remove any script tags
  code = code.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  
  // Remove any event handlers
  code = code.replace(/on\w+=/g, 'data-blocked-handler=');
  
  // Remove any attempts to create or modify script elements
  code = code.replace(/document\.createElement\(['"']script['"']\)/g, 'undefined');
  
  return code;
}

const LivePreview: React.FC<LivePreviewProps> = ({ code, colorScheme }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || !code) return;

    try {
      // Clean up previous content
      while (containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild);
      }

      // Create a sandboxed iframe
      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      
      // Set strict sandbox permissions
      iframe.sandbox.add('allow-scripts');
      iframe.sandbox.add('allow-same-origin'); // Needed for React hydration
      
      // Store iframe reference
      iframeRef.current = iframe;
      containerRef.current.appendChild(iframe);

      // Transform the code:
      // 1. Remove import statements (React is provided globally)
      let transformedCode = sanitizeCode(code);
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

      // Build the HTML content for the iframe with strict CSP
      const html = `
        <!DOCTYPE html>
        <html data-theme="custom">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta http-equiv="Content-Security-Policy" content="
              default-src 'self';
              script-src 'unsafe-eval' 'unsafe-inline' https://unpkg.com https://cdn.tailwindcss.com;
              style-src 'unsafe-inline' https://cdn.jsdelivr.net;
              connect-src 'none';
              frame-src 'none';
              object-src 'none';
              base-uri 'none';
              form-action 'none';
            ">
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
              // Set up a controlled environment
              const secureWindow = {
                // Add only safe window properties
                setTimeout,
                clearTimeout,
                setInterval,
                clearInterval,
                requestAnimationFrame,
                cancelAnimationFrame,
                // Add React-specific globals
                React,
                ReactDOM,
                // Add event constructors
                FormEvent: function(target) { return {}; },
                ChangeEvent: function(target) { return {}; },
                MouseEvent: function(target) { return {}; }
              };

              // Create secure context
              const createSecureContext = (code) => {
                const secureFunction = new Function(
                  'React',
                  'ReactDOM',
                  'window',
                  \`
                    "use strict";
                    const { useState, useEffect, useRef, useMemo, useCallback, useContext, useReducer } = React;
                    try {
                      \${code}
                      return { success: true, component: ${componentName || 'null'} };
                    } catch (error) {
                      return { success: false, error: error.message };
                    }
                  \`
                );

                return secureFunction(React, ReactDOM, secureWindow);
              };

              // Transform and execute the code
              try {
                const transformed = Babel.transform(${JSON.stringify(transformedCode)}, {
                  filename: 'component.tsx',
                  presets: ['react', 'typescript'],
                  retainLines: true
                }).code;

                // Execute in secure context with timeout
                const timeoutPromise = new Promise((_, reject) => {
                  setTimeout(() => reject(new Error('Component evaluation timed out')), 5000);
                });

                Promise.race([
                  Promise.resolve(createSecureContext(transformed)),
                  timeoutPromise
                ]).then(result => {
                  if (!result.success) {
                    throw new Error(result.error);
                  }

                  const MainComponent = result.component;
                  if (MainComponent) {
                    const root = ReactDOM.createRoot(document.getElementById('root'));
                    root.render(
                      React.createElement(
                        React.StrictMode,
                        null,
                        React.createElement(MainComponent)
                      )
                    );
                  } else {
                    document.getElementById('root').textContent = 
                      'No React component found. Please ensure the code includes a properly named React component with a default export.';
                  }
                }).catch(error => {
                  document.getElementById('root').textContent =
                    'Error evaluating component: ' + error.message;
                });
              } catch (error) {
                document.getElementById('root').textContent =
                  'Error transpiling component: ' + error.message;
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
      if (containerRef.current) {
        containerRef.current.textContent = 'Error rendering preview: ' + 
          (error instanceof Error ? error.message : 'Unknown error occurred');
      }
    }

    // Cleanup function
    return () => {
      if (iframeRef.current && containerRef.current) {
        containerRef.current.removeChild(iframeRef.current);
      }
    };
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

