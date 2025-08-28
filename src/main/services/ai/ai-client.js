const https = require('https');

let openRouterApiKey = null;
let aiSettings = {
  enabled: true,
  explainCode: true,
  summarizeText: true,
  suggestTags: true,
  model: 'deepseek/deepseek-r1'
};

function setOpenRouterKey(apiKey) {
  openRouterApiKey = apiKey;
}

function setAiSettings(settings) {
  aiSettings = { ...aiSettings, ...settings };
}

function getAiSettings() {
  return { ...aiSettings };
}

async function callOpenRouter(messages, maxTokens = 500) {
  if (!openRouterApiKey) {
    throw new Error('OpenRouter API key not configured');
  }

  return new Promise((resolve, reject) => {
    const payload = {
      model: aiSettings.model,
      messages: messages,
      max_tokens: maxTokens,
      temperature: 0.3
    };

    const data = Buffer.from(JSON.stringify(payload));
    const req = https.request({
      method: 'POST',
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'HTTP-Referer': 'https://codecap.desktop',
        'X-Title': 'CodeCap Desktop'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode === 200 && json.choices && json.choices[0]) {
            resolve(json.choices[0].message.content.trim());
          } else {
            reject(new Error(`OpenRouter API error: ${json.error?.message || body}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse OpenRouter response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function explainCode(codeText) {
  if (!aiSettings.enabled || !aiSettings.explainCode) {
    return 'AI code explanation is disabled';
  }

  if (!codeText || codeText.trim().length === 0) {
    return 'No code provided to explain';
  }

  try {
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful programming assistant. Explain code snippets clearly and concisely. Focus on what the code does, key concepts, and any notable patterns or potential issues. Keep explanations under 200 words.'
      },
      {
        role: 'user',
        content: `Please explain this code:\n\n${codeText}`
      }
    ];

    return await callOpenRouter(messages, 300);
  } catch (error) {
    console.error('AI code explanation failed:', error);
    return `Code explanation failed: ${error.message}`;
  }
}

async function summarizeText(text) {
  if (!aiSettings.enabled || !aiSettings.summarizeText) {
    // Fallback to simple truncation
    const trimmed = text.trim();
    if (trimmed.length <= 200) return trimmed;
    return trimmed.slice(0, 200).trimEnd() + '…';
  }

  if (!text || text.trim().length === 0) {
    return 'No content to summarize';
  }

  try {
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful assistant that creates concise summaries. Summarize the given text in 1-2 sentences, capturing the main points and purpose. Keep it under 150 words.'
      },
      {
        role: 'user',
        content: `Please summarize this text:\n\n${text}`
      }
    ];

    return await callOpenRouter(messages, 200);
  } catch (error) {
    console.error('AI text summarization failed:', error);
    // Fallback to simple truncation
    const trimmed = text.trim();
    if (trimmed.length <= 200) return trimmed;
    return trimmed.slice(0, 200).trimEnd() + '…';
  }
}

async function suggestTags(text, context = 'general') {
  if (!aiSettings.enabled || !aiSettings.suggestTags) {
    // Fallback to simple keyword extraction
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

  if (!text || text.trim().length === 0) {
    return [];
  }

  try {
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful assistant that suggests relevant tags for content. Analyze the text and suggest 3-5 relevant, concise tags that describe the main topics, technologies, or concepts. Return only the tags as a comma-separated list, no explanations.'
      },
      {
        role: 'user',
        content: `Please suggest tags for this ${context} content:\n\n${text}`
      }
    ];

    const response = await callOpenRouter(messages, 100);
    const tags = response.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0);
    return tags.slice(0, 5); // Limit to 5 tags
  } catch (error) {
    console.error('AI tag suggestion failed:', error);
    // Fallback to simple keyword extraction
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
}

async function detectLanguage(text) {
  const codeTokens = ['{', '}', ';', 'function', 'def', 'public', '#include', 'import', 'const', 'var', 'let', 'class', 'interface', 'struct'];
  for (const token of codeTokens) {
    if (text.includes(token)) {
      return 'code';
    }
  }
  return 'plain';
}

module.exports = { 
  summarizeText, 
  suggestTags, 
  detectLanguage, 
  explainCode,
  setOpenRouterKey,
  setAiSettings,
  getAiSettings
};