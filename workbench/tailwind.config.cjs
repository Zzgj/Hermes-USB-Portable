const guide = require('./resources/style-guide.json');
module.exports = {content: ['./index.html','./src/**/*.{ts,tsx}'], darkMode: 'class', theme: {extend: {
  ...guide.theme,
  colors: {...guide.theme.colors, canvas: 'var(--canvas)', panel: 'var(--panel)', ink: 'var(--ink)', muted: 'var(--muted)', line: 'var(--line)', rail: 'var(--rail)'},
  fontFamily: {sans: ['Inter','Segoe UI','Microsoft YaHei','sans-serif'], mono: ['JetBrains Mono','Consolas','monospace']}
}}};
