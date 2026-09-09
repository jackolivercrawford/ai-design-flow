import type { MockupVersion } from "@/types";

const themeTokens = {
  primary: "p",
  "primary-focus": "pf",
  "primary-content": "pc",
  secondary: "s",
  "secondary-focus": "sf",
  "secondary-content": "sc",
  accent: "a",
  "accent-focus": "af",
  "accent-content": "ac",
  neutral: "n",
  "neutral-focus": "nf",
  "neutral-content": "nc",
  "base-100": "b1",
  "base-200": "b2",
  "base-300": "b3",
  "base-content": "bc",
};

// DaisyUI 2 expects HSL channels in its custom properties, not hex strings.
function hslChannels(hex: string) {
  const [r, g, b] = [1, 3, 5].map(
    (index) => parseInt(hex.slice(index, index + 2), 16) / 255,
  );
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (delta !== 0) {
    hue =
      max === r
        ? ((g - b) / delta) % 6
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }
  return `${hue} ${saturation * 100}% ${lightness * 100}%`;
}

export function previewDocument(
  code: string,
  colorScheme?: MockupVersion["mockupData"]["colorScheme"],
) {
  // Isolation is enforced by the iframe sandbox, not by rewriting untrusted APIs.
  const component = code
    .replace(/^\s*import[\s\S]*?from\s*['"][^'"]+['"];?\s*$/gm, "")
    .replace(/export\s+default\s+/, "const __Preview = ")
    .replace(/export\s+(?=const|function|class)/g, "");
  const source = JSON.stringify(component).replace(/</g, "\\u003c");
  const theme = Object.entries(themeTokens)
    .map(([name, variable]) => {
      const color = colorScheme?.[name];
      return color && /^#[0-9a-f]{6}$/i.test(color)
        ? `--${variable}:${hslChannels(color)};`
        : "";
    })
    .join("");
  return `<!DOCTYPE html><html lang="en" data-theme="custom"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.tailwindcss.com; style-src 'unsafe-inline' https://cdn.jsdelivr.net; img-src data: https:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<title>Protosynthetic prototype</title>
<script src="https://cdn.tailwindcss.com"></script><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/daisyui@2.51.5/dist/full.css">
<script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script><script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script><script src="https://unpkg.com/@babel/standalone@7.26.9/babel.min.js"></script>
<style>[data-theme="custom"]{${theme}}body{margin:0;font-family:system-ui,sans-serif;color:hsl(var(--bc));background:hsl(var(--b1))}button,input,select{font:inherit}button{cursor:pointer}:focus-visible{outline:3px solid hsl(var(--p));outline-offset:3px}</style>
</head><body><div id="root" role="main"><p style="padding:24px">Loading prototype...</p></div><script>
function showError(message){document.getElementById('root').textContent='Preview could not load: '+message;}
window.addEventListener('error',function(event){showError(event.message || 'A required preview resource is unavailable.');});
try {
const source=${source};
const transformed=Babel.transform(source,{filename:'prototype.tsx',presets:['react','typescript']}).code;
const Component=new Function('React', 'const {useState,useEffect,useRef,useMemo,useCallback,useContext,useReducer}=React;'+transformed+';return __Preview;')(React);
class PreviewBoundary extends React.Component{constructor(p){super(p);this.state={error:null};}static getDerivedStateFromError(error){return {error:error.message};}render(){return this.state.error?React.createElement('p',null,'Preview error: '+this.state.error):this.props.children;}}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(PreviewBoundary,null,React.createElement(Component)));
}catch(error){showError(error.message);}
</script></body></html>`;
}
