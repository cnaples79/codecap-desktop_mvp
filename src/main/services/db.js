const { v4: uuidv4 } = require('uuid');
const { readFileSync, writeFileSync, existsSync } = require('fs');
const path = require('path');

let snippets = [];
let dbFilePath;

function initDatabase(userDataPath) {
  dbFilePath = path.join(userDataPath, 'snippets.json');
  if (existsSync(dbFilePath)) {
    try {
      const data = readFileSync(dbFilePath, 'utf8');
      snippets = JSON.parse(data);
    } catch (err) {
      console.warn('Failed to parse snippets.json, starting fresh.', err);
      snippets = [];
    }
  } else {
    snippets = [];
    persist();
  }
}

function persist() {
  try {
    writeFileSync(dbFilePath, JSON.stringify(snippets, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write snippets file', err);
  }
}

function saveSnippet(snippet) {
  const now = Date.now();
  let record;
  if (snippet.id) {
    const index = snippets.findIndex(s => s.id === snippet.id);
    if (index >= 0) {
      record = { ...snippets[index], ...snippet, updatedAt: now };
      snippets[index] = record;
    } else {
      record = {
        id: snippet.id,
        title: snippet.title || 'Untitled',
        body: snippet.body || '',
        category: snippet.category || 'code',
        tags: snippet.tags || [],
        createdAt: now,
        updatedAt: now,
        aiSummary: snippet.aiSummary,
        aiTags: snippet.aiTags,
        language: snippet.language
      };
      snippets.unshift(record);
    }
  } else {
    record = {
      id: uuidv4(),
      title: snippet.title || 'Untitled',
      body: snippet.body || '',
      category: snippet.category || 'code',
      tags: snippet.tags || [],
      createdAt: now,
      updatedAt: now,
      aiSummary: snippet.aiSummary,
      aiTags: snippet.aiTags,
      language: snippet.language
    };
    snippets.unshift(record);
  }
  persist();
  return record;
}

function getAllSnippets() {
  return snippets.slice().sort((a, b) => b.createdAt - a.createdAt);
}

function searchSnippets(query) {
  const q = query.toLowerCase();
  return snippets.filter(s => s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q)).sort((a, b) => b.createdAt - a.createdAt);
}

module.exports = { initDatabase, saveSnippet, getAllSnippets, searchSnippets };