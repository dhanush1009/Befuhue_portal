/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: [
    '@tiptap/extension-mention',
    '@tiptap/suggestion',
    '@react-pdf/renderer',
    '@react-pdf/reconciler',
    '@react-pdf/layout',
    '@react-pdf/primitives',
    '@react-pdf/font',
    '@react-pdf/image',
    '@react-pdf/textkit',
    '@react-pdf/fns',
  ],
};

export default nextConfig;
