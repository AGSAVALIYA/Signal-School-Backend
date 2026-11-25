/* VS Code (macOS, Dark Modern) replica driven by a deterministic clock.
   The renderer calls __load(...) once, then __step(ms) per video frame and screenshots when __dirty is set. */
(() => {
  const $ = (s) => document.querySelector(s);
  const LH = 20;
  const FS = 14;
  const MENU = 24;
  let CW = 8.4; // measured char width

  // ---------- deterministic randomness ----------
  let seed = 7;
  const rnd = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // ---------- clock & coroutines ----------
  let T = 0;
  let dirty = true;
  const procs = [];
  const mark = () => (dirty = true);
  const spawn = (gen) => procs.push({ gen, wake: T });
  function runProcs() {
    for (const p of [...procs]) {
      let guard = 0;
      while (p.wake <= T + 1e-6 && guard++ < 1000) {
        const r = p.gen.next();
        if (r.done) {
          procs.splice(procs.indexOf(p), 1);
          break;
        }
        const v = r.value;
        p.wake = v === 'frame' || !v ? T + 0.001 : T + v;
      }
    }
  }
  const ease = {
    io: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    out: (p) => 1 - Math.pow(1 - p, 3),
    quad: (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
  };
  function* tween(ms, fn, e = ease.io) {
    const start = T;
    for (;;) {
      const p = Math.min(1, (T - start) / ms);
      fn(e(p), p);
      mark();
      if (p >= 1) return;
      yield 'frame';
    }
  }

  // ---------- icons ----------
  let ICONS = {};
  const svg = (name) => {
    const i = ICONS.icons[name] || ICONS.icons[ICONS.aliases?.[name]?.parent] || ICONS.icons.file;
    const w = i.width || ICONS.width || 16;
    const h = i.height || ICONS.height || 16;
    return `<svg viewBox="0 0 ${w} ${h}">${i.body}</svg>`;
  };
  const FILE_ICON = (path) => {
    const base = path.split('/').pop().toLowerCase();
    const named = {
      'package.json': 'nodejs',
      'package-lock.json': 'nodejs',
      '.nvmrc': 'nodejs',
      dockerfile: 'docker',
      'docker-compose.yml': 'docker',
      '.dockerignore': 'docker',
      '.gitignore': 'git',
      '.gitattributes': 'git',
      license: 'license',
      'readme.md': 'readme',
      'changelog.md': 'changelog',
      'contributing.md': 'contributing',
      'agents.md': 'markdown',
      'eslint.config.js': 'eslint',
      '.prettierrc': 'prettier',
      '.env.example': 'tune',
      'vite.config.js': 'vite',
      'playwright.config.js': 'playwright',
      'vercel.json': 'vercel',
      'ci.yml': 'github-actions-workflow',
      'index.html': 'html',
    };
    if (named[base]) return named[base];
    if (/\.test\.jsx$/.test(base)) return 'test-jsx';
    if (/\.(test|spec)\.js$/.test(base)) return 'test-js';
    const ext = base.split('.').pop();
    return (
      {
        js: 'javascript',
        mjs: 'javascript',
        jsx: 'react',
        json: 'json',
        md: 'markdown',
        sql: 'database',
        yml: 'yaml',
        yaml: 'yaml',
        sh: 'console',
        png: 'image',
        jpg: 'image',
        ico: 'favicon',
        pdf: 'pdf',
        xlsx: 'table',
        csv: 'table',
        html: 'html',
        css: 'css',
        py: 'python',
        conf: 'nginx',
        template: 'nginx',
      }[ext] || 'document'
    );
  };
  const FOLDER_ICON = (name, open) => {
    const map = {
      src: 'folder-src',
      config: 'folder-config',
      db: 'folder-database',
      migrations: 'folder-migrations',
      models: 'folder-database',
      middlewares: 'folder-middleware',
      modules: 'folder-components',
      utils: 'folder-utils',
      tests: 'folder-test',
      test: 'folder-test',
      e2e: 'folder-test',
      scripts: 'folder-scripts',
      docs: 'folder-docs',
      docker: 'folder-docker',
      '.github': 'folder-github',
      workflows: 'folder-gh-workflows',
      screenshots: 'folder-images',
      img: 'folder-images',
      api: 'folder-api',
      app: 'folder-app',
      theme: 'folder-theme',
      icons: 'folder-svg',
      i18n: 'folder-i18n',
      locales: 'folder-i18n',
      shared: 'folder-shared',
      components: 'folder-components',
      hooks: 'folder-hook',
      public: 'folder-public',
      features: 'folder-features',
      auth: 'folder-secure',
      demo: 'folder-mock',
      'manual-qa': 'folder-test',
      'test-files': 'folder-resource',
    };
    const base = map[name] || 'folder-base';
    const n = open ? `${base}-open` : base;
    return ICONS.icons[n] ? n : open ? 'folder-base-open' : 'folder-base';
  };

  // ---------- state ----------
  const st = {
    repo: null,
    files: {},
    root: null,
    rows: [],
    treeScroll: 0,
    treeSel: null,
    tabs: [],
    active: null,
    scroll: 0,
    caret: { line: 1, col: 0 },
    sel: null,
    focus: 'tree',
    mouse: { x: 1000, y: 500, kind: 'arrow', down: false },
    panelH: 0,
    term: [],
    termCursor: false,
    quick: null,
    clockBase: 0,
  };
  const byPath = new Map();

  function buildTree(paths) {
    const root = { name: '', path: '', dir: true, children: [], expanded: true, depth: -1 };
    byPath.clear();
    for (const p of paths) {
      const parts = p.split('/');
      let node = root;
      parts.forEach((part, i) => {
        const path = parts.slice(0, i + 1).join('/');
        let child = node.children.find((c) => c.name === part);
        if (!child) {
          child = { name: part, path, dir: i < parts.length - 1, children: [], expanded: false, depth: i, parent: node };
          node.children.push(child);
          byPath.set(path, child);
        }
        node = child;
      });
    }
    const sort = (n) => {
      n.children.sort((a, b) => (a.dir !== b.dir ? (a.dir ? -1 : 1) : a.name.toLowerCase().localeCompare(b.name.toLowerCase(), 'en')));
      n.children.forEach(sort);
    };
    sort(root);
    return root;
  }

  function flatten() {
    const out = [];
    const walk = (n) => n.children.forEach((c) => (out.push(c), c.dir && c.expanded && walk(c)));
    walk(st.root);
    st.rows = out;
  }

  // ---------- rendering ----------
  const treeEl = $('#tree');
  function renderTree() {
    flatten();
    const hover = hoverRowPath();
    treeEl.innerHTML = st.rows
      .map((n) => {
        const cls = ['row'];
        if (st.treeSel === n.path) cls.push('sel');
        if (st.treeSel === n.path && st.focus === 'tree') cls.push('focus');
        if (hover === n.path && st.treeSel !== n.path) cls.push('hover');
        const tw = n.dir ? `<i class="codicon codicon-chevron-${n.expanded ? 'down' : 'right'}"></i>` : '';
        const ic = n.dir ? svg(FOLDER_ICON(n.name, n.expanded)) : svg(FILE_ICON(n.path));
        return `<div class="${cls.join(' ')}" data-path="${n.path}" style="padding-left:${4 + n.depth * 8}px"><span class="tw">${tw}</span><span class="ic">${ic}</span><span class="lb">${esc(n.name)}</span></div>`;
      })
      .join('');
    treeEl.style.transform = `translateY(${-st.treeScroll}px)`;
    mark();
  }
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function hoverRowPath() {
    const vp = $('#tree-vp').getBoundingClientRect();
    const { x, y } = st.mouse;
    if (x < vp.left || x > vp.right || y < vp.top || y > vp.bottom) return null;
    const i = Math.floor((y - vp.top + st.treeScroll) / 22);
    return st.rows[i]?.path ?? null;
  }
  let lastHover = null;
  function updateHover() {
    const h = hoverRowPath();
    if (h !== lastHover) {
      lastHover = h;
      renderTree();
    }
    const sb = $('#sidebar').getBoundingClientRect();
    $('#sidebar').classList.toggle('hover', st.mouse.x >= sb.left && st.mouse.x <= sb.right && st.mouse.y >= sb.top && st.mouse.y <= sb.bottom);
    const ed = $('#editor').getBoundingClientRect();
    const inEd = st.mouse.x >= ed.left && st.mouse.x <= ed.right && st.mouse.y >= ed.top && st.mouse.y <= ed.bottom;
    $('#editor').classList.toggle('hover', inEd && !!st.active);
    const cv = $('#code-vp').getBoundingClientRect();
    const kind = st.active && !st.quick && st.mouse.x >= cv.left && st.mouse.x <= cv.right && st.mouse.y >= cv.top && st.mouse.y <= cv.bottom ? 'text' : 'arrow';
    if (kind !== st.mouse.kind) {
      st.mouse.kind = kind;
      drawCursor();
    }
  }

  function renderTabs() {
    $('#tabs').innerHTML = st.tabs
      .map(
        (t) =>
          `<div class="tab ${t.path === st.active ? 'active' : ''} ${t.preview ? 'preview' : ''}" data-path="${t.path}"><span class="ic">${svg(FILE_ICON(t.path))}</span><span class="nm">${esc(t.path.split('/').pop())}</span><span class="x"><i class="codicon codicon-close"></i></span></div>`,
      )
      .join('');
    mark();
  }

  function symbolAt(line) {
    const f = st.files[st.active];
    if (!f?.lines) return null;
    const text = (i) => (f.lines[i] || []).map((t) => t[0]).join('');
    for (let i = line - 1; i >= 0; i -= 1) {
      const s = text(i);
      let m;
      if ((m = s.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\*?\s+(\w+)/))) return { name: m[1], kind: 'fn' };
      if ((m = s.match(/^(?:export\s+)?const\s+(\w+)\s*=\s*(?:\(|async|memo|\w+\s*=>|\(\{)/))) return { name: m[1], kind: 'fn' };
      if ((m = s.match(/^(?:export\s+)?const\s+(\w+)/))) return { name: m[1], kind: 'var' };
      if ((m = s.match(/^router\.(get|post|put|patch|delete)\(\s*$/))) return { name: `router.${m[1]}() callback`, kind: 'fn' };
      if ((m = s.match(/^router\.(get|post|put|patch|delete)\('([^']+)'/))) return { name: `router.${m[1]}('${m[2]}') callback`, kind: 'fn' };
      if ((m = s.match(/^CREATE TABLE (\w+)/))) return null;
      if (/^\S/.test(s) && i < line - 1 && /^[}\])]/.test(s)) return null;
    }
    return null;
  }

  function renderCrumbs() {
    if (!st.active) {
      $('#crumbs').innerHTML = '';
      return;
    }
    const parts = st.active.split('/');
    let html = parts
      .map((p, i) =>
        i === parts.length - 1 ? `<span class="cb"><span class="ic">${svg(FILE_ICON(st.active))}</span>${esc(p)}</span>` : `<span class="cb">${esc(p)}</span>`,
      )
      .join('<i class="codicon codicon-chevron-right"></i>');
    const sym = symbolAt(st.caret.line);
    if (sym)
      html += `<i class="codicon codicon-chevron-right"></i><span class="cb"><i class="codicon codicon-symbol-${sym.kind === 'fn' ? 'method' : 'variable'} sym ${sym.kind === 'var' ? 'var' : ''}"></i>${esc(sym.name)}</span>`;
    $('#crumbs').innerHTML = html;
    mark();
  }

  function renderStatus() {
    const f = st.files[st.active];
    let pos = `Ln ${st.caret.line}, Col ${st.caret.col + 1}`;
    if (st.sel) {
      const n = selectedChars();
      if (n) pos += ` (${n} selected)`;
    }
    $('#st-pos').textContent = st.active ? pos : '';
    $('#st-lang').innerHTML = f ? `<i class="codicon codicon-bracket"></i>&nbsp;${f.langName}` : '';
    document.querySelectorAll('.sr > span').forEach((e, i) => (e.style.display = st.active || i >= 5 ? '' : 'none'));
    mark();
  }

  const lineText = (l) => (st.files[st.active]?.lines?.[l - 1] || []).map((t) => t[0]).join('');
  function selectedChars() {
    const s = normSel();
    if (!s) return 0;
    if (s.a.line === s.b.line) return s.b.col - s.a.col;
    let n = lineText(s.a.line).length - s.a.col + 1;
    for (let l = s.a.line + 1; l < s.b.line; l += 1) n += lineText(l).length + 1;
    return n + s.b.col;
  }
  function normSel() {
    if (!st.sel) return null;
    const { a, b } = st.sel;
    return a.line < b.line || (a.line === b.line && a.col <= b.col) ? { a, b } : { a: b, b: a };
  }

  // Editor
  const vpH = () => $('#code-vp').clientHeight;
  function openFile(path, { preview = true } = {}) {
    const f = st.files[path];
    if (!f) throw new Error(`no file ${path}`);
    const existing = st.tabs.find((t) => t.path === path);
    if (!existing) {
      const pi = st.tabs.findIndex((t) => t.preview);
      const tab = { path, preview };
      if (pi >= 0 && preview) st.tabs.splice(pi, 1, tab);
      else {
        const ai = st.tabs.findIndex((t) => t.path === st.active);
        st.tabs.splice(ai + 1, 0, tab);
      }
      while (st.tabs.length > 6) st.tabs.splice(st.tabs.findIndex((t) => t.path !== path), 1);
    } else if (!preview) existing.preview = false;
    st.active = path;
    st.scroll = f.scroll || 0;
    st.caret = f.caret || { line: 1, col: 0 };
    st.sel = null;
    renderTabs();
    renderFile();
    renderCrumbs();
    renderStatus();
  }

  function renderFile() {
    const f = st.files[st.active];
    $('#welcome').style.display = f ? 'none' : 'flex';
    const lines = f?.lines || [];
    $('#lines').innerHTML = lines
      .map(
        (toks, i) =>
          `<div class="l" data-l="${i + 1}">${toks
            .map(([t, c, fs]) => `<span style="color:${c}${fs & 1 ? ';font-style:italic' : ''}${fs & 2 ? ';font-weight:700' : ''}">${esc(t)}</span>`)
            .join('')}</div>`,
      )
      .join('');
    $('#gutter').innerHTML = lines.map((_, i) => `<div class="ln" data-l="${i + 1}">${i + 1}</div>`).join('');
    // indent guides
    const ind = lines.map((toks) => {
      const s = toks.map((t) => t[0]).join('');
      return s.trim() ? s.match(/^ */)[0].length : -1;
    });
    const eff = ind.slice();
    for (let i = 0; i < eff.length; i += 1) {
      if (eff[i] >= 0) continue;
      let p = i - 1;
      while (p >= 0 && ind[p] < 0) p -= 1;
      let n = i + 1;
      while (n < ind.length && ind[n] < 0) n += 1;
      eff[i] = Math.min(p >= 0 ? ind[p] : 0, n < ind.length ? ind[n] : 0);
    }
    let g = '';
    eff.forEach((w, i) => {
      for (let lv = 0; lv * 2 < w; lv += 1) g += `<div class="ig" style="left:${lv * 2 * CW}px;top:${i * LH}px"></div>`;
    });
    $('#guides').innerHTML = g;
    drawMinimap();
    placeEditor();
  }

  function drawMinimap() {
    const f = st.files[st.active];
    const c = $('#minimap');
    const h = $('#editor').clientHeight;
    const dpr = 1.2;
    const total = (f?.lines?.length || 0) * 2;
    c.width = 90 * dpr;
    c.height = Math.max(1, Math.min(total, h)) * dpr;
    c.style.height = `${Math.min(total, h)}px`;
    st.mmTotal = total;
    st.mmH = h;
    if (!f?.lines) return;
    const off = document.createElement('canvas');
    off.width = 90 * dpr;
    off.height = total * dpr;
    const ctx = off.getContext('2d');
    ctx.scale(dpr, dpr);
    f.lines.forEach((toks, i) => {
      let col = 0;
      for (const [t, color] of toks) {
        for (let k = 0; k < t.length; k += 1) {
          if (t[k] !== ' ' && col < 88) {
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.55;
            ctx.fillRect(col, i * 2, 1, 2);
          }
          col += 1;
        }
      }
    });
    st.mmCanvas = off;
  }

  function maxScroll() {
    const n = st.files[st.active]?.lines?.length || 0;
    return Math.max(0, (n - 1) * LH - 0);
  }

  function placeEditor() {
    const f = st.files[st.active];
    const y = -st.scroll;
    $('#code').style.transform = `translateY(${y}px)`;
    $('#gutter').style.transform = `translateY(${y}px)`;
    // current line + caret
    document.querySelectorAll('.l.cur, .ln.cur').forEach((e) => e.classList.remove('cur'));
    const focus = st.focus === 'editor';
    $('#editor').classList.toggle('focus', focus);
    if (f?.lines) {
      const showCur = focus && !st.sel;
      if (showCur) document.querySelector(`.l[data-l="${st.caret.line}"]`)?.classList.add('cur');
      document.querySelector(`.ln[data-l="${st.caret.line}"]`)?.classList.add('cur');
    }
    const caret = $('#caret');
    const blinkOn = Math.floor((T - (st.caretT || 0)) / 500) % 2 === 0;
    caret.style.display = f?.lines && focus && blinkOn ? 'block' : 'none';
    caret.style.left = `${st.caret.col * CW}px`;
    caret.style.top = `${(st.caret.line - 1) * LH}px`;
    // selection
    const s = normSel();
    let html = '';
    if (s) {
      for (let l = s.a.line; l <= s.b.line; l += 1) {
        const len = lineText(l).length;
        const c0 = l === s.a.line ? s.a.col : 0;
        const c1 = l === s.b.line ? s.b.col : len + 1;
        if (c1 > c0) html += `<div class="selb" style="left:${c0 * CW}px;width:${(c1 - c0) * CW}px;top:${(l - 1) * LH}px"></div>`;
      }
    }
    $('#sel-layer').innerHTML = html;
    // minimap
    const c = $('#minimap');
    if (st.mmCanvas) {
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      const viewLines = vpH() / LH;
      const totalLines = st.mmTotal / 2;
      const mmViewLines = st.mmH / 2;
      const ratio = totalLines > viewLines ? st.scroll / LH / Math.max(1, totalLines - viewLines + 0.0001) : 0;
      const mmOff = Math.max(0, Math.min(1, ratio)) * Math.max(0, totalLines - mmViewLines) * 2;
      st.mmOff = mmOff;
      ctx.drawImage(st.mmCanvas, 0, mmOff * 1.2, c.width, c.height, 0, 0, c.width, c.height);
      const sl = $('#mm-slider');
      sl.style.top = `${(st.scroll / LH) * 2 - mmOff}px`;
      sl.style.height = `${viewLines * 2}px`;
    }
    // scrollbar
    const n = f?.lines?.length || 0;
    const contentH = n * LH + vpH() - LH;
    const th = $('#vthumb');
    if (contentH > vpH()) {
      const h = Math.max(20, (vpH() / contentH) * vpH());
      th.style.height = `${h}px`;
      th.style.top = `${(st.scroll / (contentH - vpH())) * (vpH() - h)}px`;
      th.style.display = 'block';
    } else th.style.display = 'none';
    mark();
  }

  // Terminal
  function renderTerm() {
    const vis = Math.max(1, Math.floor((st.panelH - 35 - 12) / 18));
    const lines = st.term.slice(-vis);
    $('#term').innerHTML = `<div>${lines.map((l, i) => l + (i === lines.length - 1 && st.termCursor ? '<span class="tcur"></span>' : '')).join('\n')}</div>`;
    mark();
  }
  function setPanel(h) {
    st.panelH = h;
    $('#panel').style.height = `${h}px`;
    $('#tb-panel').className = `codicon codicon-layout-panel${h ? '' : '-off'}`;
    renderTerm();
    if (st.active) {
      drawMinimap();
      placeEditor();
    }
  }

  // Quick open
  function renderQuick() {
    const q = st.quick;
    $('#quick').style.display = q ? 'block' : 'none';
    if (!q) return mark();
    $('#q-text').textContent = q.text;
    $('#q-ph').style.display = q.text ? 'none' : '';
    $('#q-caret').style.visibility = Math.floor((T - q.t0) / 500) % 2 === 0 ? 'visible' : 'hidden';
    const items = quickItems(q.text);
    q.items = items;
    $('#q-list').innerHTML = items
      .map((it, i) => {
        const name = it.path.split('/').pop();
        const dir = it.path.split('/').slice(0, -1).join('/');
        let label = '';
        for (let k = 0; k < name.length; k += 1) label += it.hits.includes(k) ? `<b>${esc(name[k])}</b>` : esc(name[k]);
        return `<div class="qi ${i === 0 ? 'on' : ''}"><span class="ic">${svg(FILE_ICON(it.path))}</span><span>${label}</span><span class="desc">${esc(dir)}</span>${
          !q.text && i === 0 ? '<span class="tag">recently opened</span>' : ''
        }</div>`;
      })
      .join('');
    mark();
  }
  function quickItems(text) {
    const paths = Object.keys(st.files);
    if (!text) {
      const recent = [...st.tabs.map((t) => t.path)].reverse();
      return recent.slice(0, 8).map((path) => ({ path, hits: [] }));
    }
    const q = text.toLowerCase();
    const scored = [];
    for (const path of paths) {
      const name = path.split('/').pop().toLowerCase();
      const idx = name.indexOf(q);
      if (idx >= 0) {
        scored.push({ path, score: 1000 - name.length - (idx ? 50 : 0) - path.length * 0.1, hits: [...Array(q.length).keys()].map((k) => idx + k) });
        continue;
      }
      // subsequence on the name
      const hits = [];
      let j = 0;
      for (let k = 0; k < name.length && j < q.length; k += 1) if (name[k] === q[j]) hits.push(k), (j += 1);
      if (j === q.length) scored.push({ path, score: 500 - name.length - path.length * 0.1, hits });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 9);
  }

  // Cursor
  const ARROW = `<svg width="20" height="26" viewBox="0 0 20 26" style="left:-2px;top:-2px"><path d="M2.5 2.2 L2.5 20.6 L6.9 16.5 L9.9 23.4 L13.2 22 L10.3 15.3 L16.4 15.3 Z" fill="#000" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
  const IBEAM = `<svg width="12" height="22" viewBox="0 0 12 22" style="left:-6px;top:-11px"><path d="M2 2.5 Q6 2.5 6 5 Q6 2.5 10 2.5 M6 5 L6 17 M2 19.5 Q6 19.5 6 17 Q6 19.5 10 19.5" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><path d="M2 2.5 Q6 2.5 6 5 Q6 2.5 10 2.5 M6 5 L6 17 M2 19.5 Q6 19.5 6 17 Q6 19.5 10 19.5" fill="none" stroke="#000" stroke-width="1.4" stroke-linecap="round"/></svg>`;
  function drawCursor() {
    const c = $('#cursor');
    c.innerHTML = st.mouse.kind === 'text' ? IBEAM : ARROW;
    placeCursor();
  }
  function placeCursor() {
    const s = st.mouse.down ? 0.9 : 1;
    $('#cursor').style.transform = `translate(${st.mouse.x}px, ${st.mouse.y}px) scale(${s})`;
    $('#cursor').style.display = st.mouse.hidden ? 'none' : 'block';
    mark();
  }
  function setMouse(x, y) {
    st.mouse.x = x;
    st.mouse.y = y;
    placeCursor();
    updateHover();
  }
  function* moveTo(x, y, msOverride) {
    const x0 = st.mouse.x;
    const y0 = st.mouse.y;
    const d = Math.hypot(x - x0, y - y0);
    if (d < 1) return;
    const ms = msOverride ?? Math.min(1100, Math.max(320, 260 + d * 0.55));
    const bend = (rnd() - 0.5) * 0.25 * d;
    const nx = -(y - y0) / d;
    const ny = (x - x0) / d;
    const cx = (x0 + x) / 2 + nx * bend;
    const cy = (y0 + y) / 2 + ny * bend;
    yield* tween(ms, (e) => {
      const u = 1 - e;
      setMouse(u * u * x0 + 2 * u * e * cx + e * e * x, u * u * y0 + 2 * u * e * cy + e * e * y);
    });
  }
  function* press() {
    st.mouse.down = true;
    placeCursor();
    yield 70;
    st.mouse.down = false;
    placeCursor();
  }

  // ---------- geometry ----------
  const rectOf = (el) => el.getBoundingClientRect();
  function rowY(path) {
    const i = st.rows.findIndex((r) => r.path === path);
    const vp = rectOf($('#tree-vp'));
    return { i, y: vp.top + i * 22 - st.treeScroll + 11, vp };
  }
  function textXY(line, col) {
    const cv = rectOf($('#code-vp'));
    return { x: cv.left + col * CW, y: cv.top + (line - 1) * LH - st.scroll + LH / 2, cv };
  }
  function posFromMouse() {
    const cv = rectOf($('#code-vp'));
    const line = Math.max(1, Math.min(st.files[st.active].lines.length, Math.floor((st.mouse.y - cv.top + st.scroll) / LH) + 1));
    const col = Math.max(0, Math.min(lineText(line).length, Math.round((st.mouse.x - cv.left) / CW)));
    return { line, col };
  }

  // ---------- actions ----------
  function* ensureRowVisible(path, wheel = true) {
    const vp = rectOf($('#tree-vp'));
    const { i } = rowY(path);
    const top = i * 22;
    let target = st.treeScroll;
    if (top < st.treeScroll + 22) target = Math.max(0, top - 44);
    if (top + 22 > st.treeScroll + vp.height - 22) target = top - vp.height + 88;
    target = Math.max(0, Math.min(target, Math.max(0, st.rows.length * 22 - vp.height + 22)));
    if (Math.abs(target - st.treeScroll) < 1) return;
    if (wheel) {
      const inside = st.mouse.x > vp.left && st.mouse.x < vp.right && st.mouse.y > vp.top && st.mouse.y < vp.bottom;
      if (!inside) yield* moveTo(vp.left + 120, vp.top + vp.height * 0.5);
      const from = st.treeScroll;
      yield* tween(Math.min(900, 300 + Math.abs(target - from) * 1.2), (e) => {
        st.treeScroll = from + (target - from) * e;
        renderTree();
      });
    } else {
      st.treeScroll = target;
      renderTree();
    }
  }
  function* clickRow(path, { dbl = false } = {}) {
    yield* ensureRowVisible(path);
    const { y, vp } = rowY(path);
    const n = byPath.get(path);
    const x = vp.left + 4 + n.depth * 8 + 16 + 22 + Math.min(60, n.name.length * 3.5) + (rnd() - 0.5) * 10;
    yield* moveTo(x, y + (rnd() - 0.5) * 4);
    yield 90 + rnd() * 80;
    yield* press();
    st.focus = 'tree';
    st.treeSel = path;
    if (n.dir) {
      n.expanded = !n.expanded;
      renderTree();
    } else {
      openFile(path, { preview: !dbl });
      renderTree();
      if (dbl) {
        yield 110;
        yield* press();
      }
    }
    placeEditor();
  }
  function* expandPath(path, open = true) {
    const parts = path.split('/');
    for (let i = 1; i <= parts.length; i += 1) {
      const p = parts.slice(0, i).join('/');
      const n = byPath.get(p);
      if (!n?.dir) continue;
      if (i < parts.length && n.expanded) continue;
      if (i === parts.length && n.expanded === open) continue;
      if (i < parts.length && !n.expanded) {
        yield* clickRow(p);
        yield 250 + rnd() * 150;
        continue;
      }
      yield* clickRow(p);
    }
  }
  function revealInTree(path) {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i += 1) byPath.get(parts.slice(0, i).join('/')).expanded = true;
    st.treeSel = path;
    renderTree();
  }

  function* scrollEditorTo(line, { at = 3, ms } = {}) {
    const vp = vpH();
    const target = Math.max(0, Math.min(maxScroll(), (line - 1 - at) * LH));
    const ed = rectOf($('#code-vp'));
    const inside = st.mouse.x > ed.left && st.mouse.x < ed.right && st.mouse.y > ed.top && st.mouse.y < ed.bottom;
    if (!inside) yield* moveTo(ed.left + Math.min(ed.width - 60, 560 + rnd() * 140), ed.top + vp * (0.45 + rnd() * 0.15));
    const from = st.scroll;
    if (Math.abs(target - from) < 1) return;
    const dur = ms ?? Math.min(1400, 380 + Math.abs(target - from) * 0.55);
    yield* tween(
      dur,
      (e) => {
        st.scroll = from + (target - from) * e;
        placeEditor();
      },
      ease.quad,
    );
    st.files[st.active].scroll = st.scroll;
  }
  function visibleRange() {
    const first = Math.floor(st.scroll / LH) + 1;
    return [first, first + Math.floor(vpH() / LH) - 1];
  }
  function* ensureLines(l1, l2) {
    const [a, b] = visibleRange();
    if (l1 >= a + 1 && l2 <= b - 1) return;
    const span = l2 - l1 + 1;
    const fit = Math.floor(vpH() / LH);
    const at = span >= fit - 2 ? 1 : Math.max(1, Math.min(5, Math.floor((fit - span) / 3)));
    yield* scrollEditorTo(l1, { at });
  }
  function* selectLines(l1, l2, c1 = null, c2 = null) {
    yield* ensureLines(l1, l2);
    const startCol = c1 ?? lineText(l1).match(/^ */)[0].length;
    const endCol = c2 ?? lineText(l2).length;
    const p0 = textXY(l1, startCol);
    yield* moveTo(p0.x - 1, p0.y + 1);
    yield 120 + rnd() * 80;
    st.mouse.down = true;
    placeCursor();
    st.focus = 'editor';
    st.caretT = T;
    st.sel = { a: { line: l1, col: startCol }, b: { line: l1, col: startCol } };
    st.caret = { line: l1, col: startCol };
    renderTree();
    const p1 = textXY(l2, endCol);
    const ms = Math.min(1300, 380 + Math.abs(l2 - l1) * 55 + Math.abs(p1.x - p0.x) * 0.3);
    yield* tween(ms, (e) => {
      setMouse(p0.x + (p1.x - p0.x) * e, p0.y + (p1.y - p0.y) * ease.out(e));
      const pos = posFromMouse();
      st.sel.b = pos;
      st.caret = { ...pos };
      placeEditor();
      renderStatus();
    });
    st.sel.b = { line: l2, col: endCol };
    st.caret = { line: l2, col: endCol };
    st.mouse.down = false;
    placeCursor();
    placeEditor();
    renderStatus();
    renderCrumbs();
  }
  function* clickText(line, col) {
    yield* ensureLines(line, line);
    const p = textXY(line, col);
    yield* moveTo(p.x, p.y);
    yield 80;
    yield* press();
    st.focus = 'editor';
    st.sel = null;
    st.caret = { line, col: Math.min(col, lineText(line).length) };
    st.caretT = T;
    renderTree();
    placeEditor();
    renderStatus();
    renderCrumbs();
  }
  function* pointAt(line, col) {
    yield* ensureLines(line, line);
    const p = textXY(line, col ?? lineText(line).match(/^ */)[0].length);
    yield* moveTo(p.x, p.y + 2);
  }
  function* quickOpen(path, query) {
    st.quick = { text: '', t0: T };
    renderQuick();
    yield 450 + rnd() * 200;
    for (const ch of query) {
      st.quick.text += ch;
      renderQuick();
      yield 75 + rnd() * 70;
    }
    yield 500;
    const first = st.quick.items[0]?.path;
    if (first !== path) console.warn('quick open mismatch', first, path);
    st.quick = null;
    renderQuick();
    st.focus = 'editor';
    st.caretT = T;
    openFile(path, { preview: true });
    revealInTree(path);
    yield* ensureRowVisible(path, false);
    placeEditor();
  }

  // Terminal
  function* termOpen(h = 300) {
    st.termCursor = true;
    if (!st.term.length) st.term = [prompt()];
    yield* tween(1, () => setPanel(h));
  }
  const prompt = () =>
    `<span style="color:#23d18b;font-weight:700">➜</span>  <span style="color:#29b8db;font-weight:700">${esc(st.repo.title)}</span> <span style="color:#3b8eea;font-weight:700">git:(</span><span style="color:#f14c4c;font-weight:700">main</span><span style="color:#3b8eea;font-weight:700">)</span> `;
  function* termType(cmd) {
    const base = st.term[st.term.length - 1];
    let typed = '';
    for (const ch of cmd) {
      typed += ch;
      st.term[st.term.length - 1] = base + esc(typed);
      renderTerm();
      yield 55 + rnd() * 60;
    }
    yield 350;
    st.term.push('');
    renderTerm();
  }
  function* termOut(lines, perLine = 40) {
    if (st.term[st.term.length - 1] === '') st.term.pop();
    for (const l of lines) {
      const [html, ms] = Array.isArray(l) ? l : [l, perLine];
      st.term.push(html);
      renderTerm();
      yield ms;
    }
  }
  function* termPrompt() {
    st.term.push('');
    st.term.push(prompt());
    renderTerm();
  }

  // Overlays
  function* banner(kicker, title, hold = 4200) {
    const b = $('#banner');
    $('#bn-kicker').textContent = kicker;
    $('#bn-title').textContent = title;
    yield* tween(420, (e) => {
      b.style.opacity = e;
      b.style.transform = `translateY(${(1 - e) * 14}px)`;
    }, ease.out);
    yield hold;
    yield* tween(380, (e) => {
      b.style.opacity = 1 - e;
      b.style.transform = `translateY(${e * 6}px)`;
    });
  }
  function* card({ kicker = '', title = '', sub = '', chips = [], logo = true, hold = 3000, fadeIn = 0, fadeOut = 700, stay = false }) {
    const c = $('#card');
    $('#cd-kicker').textContent = kicker;
    $('#cd-title').textContent = title;
    $('#cd-sub').textContent = sub;
    $('#cd-logo').style.display = logo ? '' : 'none';
    $('#cd-chips').innerHTML = chips.map((x) => `<span>${esc(x)}</span>`).join('');
    c.style.display = 'flex';
    st.mouse.hidden = true;
    placeCursor();
    if (fadeIn) yield* tween(fadeIn, (e) => (c.style.opacity = e));
    else {
      c.style.opacity = 1;
      mark();
    }
    if (stay) return;
    yield hold;
    st.mouse.hidden = false;
    placeCursor();
    if (fadeOut) yield* tween(fadeOut, (e) => (c.style.opacity = 1 - e));
    c.style.opacity = 0;
    c.style.display = 'none';
    mark();
  }
  function* cardHide(ms = 700) {
    const c = $('#card');
    st.mouse.hidden = false;
    placeCursor();
    yield* tween(ms, (e) => (c.style.opacity = 1 - e));
    c.style.display = 'none';
    mark();
  }

  function setRepo(key) {
    const data = window.__DATA[key];
    st.repo = data;
    st.files = data.files;
    for (const f of Object.values(st.files)) {
      delete f.scroll;
      delete f.caret;
    }
    st.root = buildTree(Object.keys(data.files));
    st.tabs = [];
    st.active = null;
    st.treeSel = null;
    st.treeScroll = 0;
    st.term = [];
    st.sel = null;
    st.focus = 'tree';
    $('#cc-title').textContent = data.title;
    $('#sb-root').textContent = data.title.toUpperCase();
    setPanel(0);
    renderTree();
    renderTabs();
    renderFile();
    renderCrumbs();
    renderStatus();
  }

  const ACTIONS = {
    repo: function* (a) {
      setRepo(a.key);
    },
    wait: function* (a) {
      yield a.ms;
    },
    move: function* (a) {
      yield* moveTo(a.x, a.y, a.ms);
    },
    moveRow: function* (a) {
      yield* ensureRowVisible(a.path);
      const { y, vp } = rowY(a.path);
      const n = byPath.get(a.path);
      yield* moveTo(vp.left + 4 + n.depth * 8 + 50 + rnd() * 20, y);
    },
    expand: function* (a) {
      yield* expandPath(a.path, true);
    },
    collapse: function* (a) {
      const n = byPath.get(a.path);
      if (n.expanded) yield* clickRow(a.path);
    },
    collapseAll: function* () {
      const r = rectOf($('#collapse-all'));
      yield* moveTo(r.left + 8, r.top + 8);
      yield 120;
      yield* press();
      for (const n of byPath.values()) n.expanded = false;
      st.treeScroll = 0;
      renderTree();
    },
    open: function* (a) {
      const parent = a.path.split('/').slice(0, -1).join('/');
      if (parent) yield* expandPath(parent, true);
      yield 150 + rnd() * 100;
      yield* clickRow(a.path, { dbl: a.pin });
    },
    quick: function* (a) {
      yield* quickOpen(a.path, a.q || a.path.split('/').pop());
    },
    scroll: function* (a) {
      yield* scrollEditorTo(a.line, { at: a.top ?? 3, ms: a.ms });
    },
    select: function* (a) {
      yield* selectLines(a.from, a.to ?? a.from, a.c1, a.c2);
    },
    point: function* (a) {
      yield* pointAt(a.line, a.col);
    },
    clickText: function* (a) {
      yield* clickText(a.line, a.col ?? 0);
    },
    deselect: function* () {
      if (!st.sel) return;
      const { b } = normSel();
      yield* clickText(b.line, Math.min(lineText(b.line).length, b.col));
    },
    termOpen: function* (a) {
      yield* termOpen(a.h);
    },
    termType: function* (a) {
      yield* termType(a.cmd);
    },
    termOut: function* (a) {
      yield* termOut(a.lines, a.per);
    },
    termPrompt: function* () {
      yield* termPrompt();
    },
    termClose: function* () {
      setPanel(0);
      st.termCursor = false;
    },
    hideMouse: function* () {
      st.mouse.hidden = true;
      placeCursor();
    },
    showMouse: function* () {
      st.mouse.hidden = false;
      placeCursor();
    },
    banner: function* (a) {
      yield* banner(a.kicker, a.title, a.hold);
    },
    card: function* (a) {
      yield* card(a);
    },
    cardHide: function* (a) {
      yield* cardHide(a.ms);
    },
  };
  const OVERLAY = new Set(['banner', 'card', 'cardHide']);

  function* channel(actions) {
    for (const a of actions) {
      if (a.at > T) yield a.at - T;
      else if (T - a.at > 900 && a.tagged) console.warn(`late ${Math.round(T - a.at)}ms: ${a.scene} ${a.do} ${a.path || a.from || ''}`);
      if (!ACTIONS[a.do]) throw new Error(`unknown action ${a.do}`);
      yield* ACTIONS[a.do](a);
    }
  }

  function updateClock() {
    const d = new Date(st.clockBase + T);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const mons = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let h = d.getHours();
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const txt = `${days[d.getDay()]} ${d.getDate()} ${mons[d.getMonth()]}  ${h}:${String(d.getMinutes()).padStart(2, '0')} ${ap}`;
    const el = $('#clock');
    if (el.textContent !== txt) {
      el.textContent = txt;
      mark();
    }
  }

  // ---------- public API ----------
  window.__load = async ({ icons, apple, data, actions, startRepo, t0 = 0, clock, mouse, state }) => {
    ICONS = icons;
    window.__DATA = data;
    $('#apple-path').setAttribute('d', apple);
    await document.fonts.ready;
    await Promise.all(['14px "JetBrains Mono"', '13px Inter', '13px "Noto Sans Devanagari"', '13px "Noto Sans Gujarati"', '16px codicon'].map((f) => document.fonts.load(f)));
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${FS}px "JetBrains Mono"`;
    CW = ctx.measureText('MMMMMMMMMM').width / 10;
    st.clockBase = clock;
    setRepo(startRepo);
    if (mouse) setMouse(mouse.x, mouse.y);
    drawCursor();
    T = 0;
    procs.length = 0;
    const main = actions.filter((a) => !OVERLAY.has(a.do));
    const over = actions.filter((a) => OVERLAY.has(a.do));
    spawn(channel(main));
    spawn(channel(over));
    // fast-forward to t0 (segment rendering): run the timeline without capturing
    if (state) Object.assign(st, state);
    while (T < t0) step(Math.min(1000 / 30, t0 - T));
    dirty = true;
    return { CW };
  };
  function step(ms) {
    T += ms;
    runProcs();
    updateClock();
    if (st.focus === 'editor' && st.active) {
      const on = Math.floor((T - (st.caretT || 0)) / 500) % 2 === 0;
      if (on !== st.lastBlink) {
        st.lastBlink = on;
        placeEditor();
      }
    }
    if (st.quick) {
      const on = Math.floor((T - st.quick.t0) / 500) % 2 === 0;
      if (on !== st.qBlink) {
        st.qBlink = on;
        renderQuick();
      }
    }
  }
  window.__step = (ms) => {
    dirty = false;
    step(ms);
    return { dirty, T, procs: procs.length };
  };
  window.__peek = () => ({ T, procs: procs.length, active: st.active, scroll: st.scroll, mouse: st.mouse });
})();
