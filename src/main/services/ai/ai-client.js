async function summarizeText(text) {
  const trimmed = text.trim();
  if (trimmed.length <= 200) return trimmed;
  return trimmed.slice(0, 200).trimEnd() + '…';
}

async function suggestTags(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4);
  const seen = new Set();
  const tags = [];
  for (const word of words) {
    if (!seen.has(word)) {
      seen.add(word);
      tags.push(word);
      if (tags.length === 3) break;
    }
  }
  return tags;
}

async function detectLanguage(text) {
  const codeTokens = ['{', '}', ';', 'function', 'def', 'public', '#include'];
  for (const token of codeTokens) {
    if (text.includes(token)) {
      return 'code';
    }
  }
  return 'plain';
}

module.exports = { summarizeText, suggestTags, detectLanguage };