const https = require('https');

function slugify(text) {
  return String(text || 'snippet')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'snippet';
}

const EXT_MAP = {
  javascript: 'js', typescript: 'ts', python: 'py', go: 'go', ruby: 'rb',
  java: 'java', csharp: 'cs', cpp: 'cpp', c: 'c', rust: 'rs', php: 'php',
  swift: 'swift', kotlin: 'kt', scala: 'scala', shell: 'sh', bash: 'sh',
  html: 'html', css: 'css', json: 'json', yaml: 'yml', yml: 'yml', md: 'md',
  text: 'txt'
};

function langToExt(lang) {
  if (!lang) return 'txt';
  const key = String(lang).toLowerCase();
  return EXT_MAP[key] || 'txt';
}

function formatMarkdown(snippets, { includeTitle = true, includeMeta = false, language = 'auto' }) {
  const parts = [];
  for (const s of snippets) {
    if (includeTitle && s.title) parts.push(`## ${s.title}`);
    if (includeMeta) {
      const meta = [];
      if (s.tags?.length) meta.push(`tags: ${s.tags.join(', ')}`);
      if (s.createdAt) meta.push(`created: ${new Date(s.createdAt).toLocaleString()}`);
      if (s.updatedAt) meta.push(`updated: ${new Date(s.updatedAt).toLocaleString()}`);
      if (meta.length) parts.push(`> ${meta.join(' | ')}`);
    }
    const lang = language === 'auto' ? (s.language || '') : language;
    parts.push('```' + (lang || ''));
    parts.push(s.body || '');
    parts.push('```');
    parts.push('');
  }
  return parts.join('\n');
}

function formatPlain(snippets, { includeTitle = true, includeMeta = false }) {
  const parts = [];
  for (const s of snippets) {
    if (includeTitle && s.title) parts.push(s.title);
    if (includeMeta) {
      const meta = [];
      if (s.tags?.length) meta.push(`tags: ${s.tags.join(', ')}`);
      if (s.createdAt) meta.push(`created: ${new Date(s.createdAt).toLocaleString()}`);
      if (s.updatedAt) meta.push(`updated: ${new Date(s.updatedAt).toLocaleString()}`);
      if (meta.length) parts.push(meta.join(' | '));
    }
    parts.push(s.body || '');
    parts.push('');
  }
  return parts.join('\n');
}

function formatCode(snippets, { includeTitle = false, language = 'auto' }) {
  const parts = [];
  for (const s of snippets) {
    if (includeTitle && s.title) parts.push(`// ${s.title}`);
    const lang = language === 'auto' ? (s.language || '') : language;
    parts.push('```' + (lang || ''));
    parts.push(s.body || '');
    parts.push('```');
    parts.push('');
  }
  return parts.join('\n');
}

function formatJson(snippets) {
  const arr = snippets.map(s => ({
    id: s.id,
    title: s.title,
    body: s.body,
    language: s.language,
    tags: s.tags,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt
  }));
  return JSON.stringify(arr, null, 2);
}

function formatForShare(snippets, opts) {
  const options = {
    format: 'markdown',
    includeTitle: true,
    includeMeta: false,
    combine: true,
    language: 'auto',
    ...opts
  };
  const format = options.format;
  if (options.combine || snippets.length <= 1 || format === 'json') {
    let content = '';
    if (format === 'markdown') content = formatMarkdown(snippets, options);
    else if (format === 'plain') content = formatPlain(snippets, options);
    else if (format === 'code') content = formatCode(snippets, options);
    else if (format === 'json') content = formatJson(snippets);
    const defaultName = (() => {
      const base = snippets[0]?.title ? slugify(snippets[0].title) : 'snippets';
      if (format === 'markdown') return base + '.md';
      if (format === 'plain') return base + '.txt';
      if (format === 'code') {
        const lang = options.language === 'auto' ? snippets[0]?.language : options.language;
        return base + '.' + langToExt(lang);
      }
      if (format === 'json') return base + '.json';
      return base + '.txt';
    })();
    return { content, defaultName };
  }
  // multi-file
  const filesMap = {};
  for (const s of snippets) {
    let content = '';
    if (format === 'markdown') content = formatMarkdown([s], options);
    else if (format === 'plain') content = formatPlain([s], options);
    else if (format === 'code') content = formatCode([s], options);
    else if (format === 'json') content = JSON.stringify([s], null, 2);
    const ext = format === 'markdown' ? 'md' : format === 'plain' ? 'txt' : format === 'json' ? 'json' : langToExt(options.language === 'auto' ? s.language : options.language);
    const name = `${slugify(s.title || s.id)}.${ext}`;
    filesMap[name] = content;
  }
  return { filesMap };
}

function createGist({ filesMap, description = 'Shared via CodeCap', public: isPublic = false, token }) {
  return new Promise((resolve, reject) => {
    const payload = {
      description,
      public: !!isPublic,
      files: Object.fromEntries(Object.entries(filesMap).map(([name, content]) => [name, { content }]))
    };
    const data = Buffer.from(JSON.stringify(payload));
    const req = https.request({
      method: 'POST',
      hostname: 'api.github.com',
      path: '/gists',
      headers: {
        'User-Agent': 'CodeCap',
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Authorization': `token ${token}`
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 201) {
          try {
            const json = JSON.parse(body);
            resolve({ url: json.html_url, id: json.id });
          } catch (e) {
            resolve({ url: null, id: null });
          }
        } else {
          let message = `GitHub API error ${res.statusCode}`;
          try { message += ': ' + (JSON.parse(body).message || body); } catch {}
          reject(new Error(message));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

module.exports = {
  formatForShare,
  createGist,
  langToExt,
  slugify
};
