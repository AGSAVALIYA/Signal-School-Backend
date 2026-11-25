// Tokenizes both repositories with Shiki (VS Code's own TextMate grammars + Dark+ theme) for the editor replica.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHighlighter } from 'shiki';

const REPOS = {
  backend: { dir: '/home/user/Signal-School-Backend', title: 'Signal-School-Backend' },
  frontend: { dir: '/home/user/Signal-School-Frontend', title: 'Signal-School-Frontend' },
};

const LANG = (p) => {
  const base = p.split('/').pop();
  if (base === 'Dockerfile') return ['docker', 'Docker'];
  if (base === '.prettierrc') return ['json', 'JSON'];
  if (base.startsWith('.env')) return ['dotenv', 'Properties'];
  if (base === '.gitignore' || base === '.dockerignore') return ['text', 'Ignore'];
  const ext = base.includes('.') ? base.split('.').pop() : '';
  return (
    {
      js: ['javascript', 'JavaScript'],
      mjs: ['javascript', 'JavaScript'],
      cjs: ['javascript', 'JavaScript'],
      jsx: ['jsx', 'JavaScript JSX'],
      json: ['json', 'JSON'],
      md: ['markdown', 'Markdown'],
      sql: ['sql', 'SQL'],
      yml: ['yaml', 'YAML'],
      yaml: ['yaml', 'YAML'],
      sh: ['shellscript', 'Shell Script'],
      html: ['html', 'HTML'],
      css: ['css', 'CSS'],
      py: ['python', 'Python'],
      conf: ['nginx', 'Nginx'],
      template: ['nginx', 'Nginx'],
    }[ext] || ['text', 'Plain Text']
  );
};
const BINARY = /\.(png|jpe?g|ico|pdf|xlsx|gif|woff2?)$/i;
const SKIP_CONTENT = /package-lock\.json$/;

const hl = await createHighlighter({
  themes: ['dark-plus'],
  langs: ['javascript', 'jsx', 'json', 'markdown', 'sql', 'yaml', 'docker', 'shellscript', 'html', 'css', 'python', 'nginx', 'dotenv'],
});

const NON_CODE = new Set(['#CE9178', '#6A9955', '#D16969', '#D7BA7D']);
const BRACKETS = ['#FFD700', '#DA70D6', '#179FFF'];

function tokenize(code, lang) {
  if (lang === 'text') return code.split('\n').map((l) => (l ? [[l, '#CCCCCC', 0]] : []));
  const { tokens } = hl.codeToTokens(code, { lang, theme: 'dark-plus' });
  let depth = 0;
  const colorBrackets = lang === 'javascript' || lang === 'jsx' || lang === 'json' || lang === 'css';
  if (lang === 'json')
    for (const line of tokens)
      line.forEach((t, i) => {
        const next = line.slice(i + 1).find((n) => n.content.trim());
        if ((t.color || '').toUpperCase() === '#CE9178' && next && next.content.trim().startsWith(':')) t.color = '#9CDCFE';
      });
  return tokens.map((line) => {
    const out = [];
    for (const t of line) {
      const color = (t.color || '#D4D4D4').toUpperCase();
      if (!colorBrackets || NON_CODE.has(color) || !/[()[\]{}]/.test(t.content)) {
        out.push([t.content, color, t.fontStyle || 0]);
        continue;
      }
      for (const part of t.content.split(/([()[\]{}])/)) {
        if (!part) continue;
        if ('([{'.includes(part)) {
          out.push([part, BRACKETS[depth % 3], 0]);
          depth += 1;
        } else if (')]}'.includes(part)) {
          depth = Math.max(0, depth - 1);
          out.push([part, BRACKETS[depth % 3], 0]);
        } else out.push([part, color, t.fontStyle || 0]);
      }
    }
    return out;
  });
}

mkdirSync('data', { recursive: true });
for (const [key, repo] of Object.entries(REPOS)) {
  const paths = execSync('git ls-files', { cwd: repo.dir, encoding: 'utf8' }).trim().split('\n');
  const files = {};
  for (const p of paths) {
    const [lang, langName] = LANG(p);
    const entry = { lang, langName };
    if (!BINARY.test(p) && !SKIP_CONTENT.test(p)) {
      const code = readFileSync(`${repo.dir}/${p}`, 'utf8').replace(/\r\n/g, '\n').replace(/\n$/, '');
      if (code.split('\n').length < 2500) entry.lines = tokenize(code, lang);
    }
    files[p] = entry;
  }
  writeFileSync(`data/${key}.json`, JSON.stringify({ key, title: repo.title, files }));
  console.log(key, paths.length, 'files');
}
