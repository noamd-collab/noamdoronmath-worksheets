/// <reference types="astro/client" />

declare module '*.html?raw' {
  const html: string;
  export default html;
}

declare module '*.b64?raw' {
  const packed: string;
  export default packed;
}
