const https = require('https');

let openRouterApiKey = null;
let aiSettings = {
  enabled: true,
  explainCode: true,
  summarizeText: true,
  suggestTags: true,
  model: 'deepseek/deepseek-r1-0528:free'
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
    throw new Error('OpenRouter API key not configured. Please add your API key in AI Settings.');
  }

  if (!aiSettings.enabled) {
    throw new Error('AI processing is disabled in settings.');
  }

  return new Promise((resolve, reject) => {
    const payload = {
      model: aiSettings.model,
      messages: messages,
      max_tokens: maxTokens,
      temperature: 0.3
    };

    const data = Buffer.from(JSON.stringify(payload));
    const timeout = setTimeout(() => {
      req.destroy();
      reject(new Error('Request timeout - OpenRouter API took too long to respond'));
    }, 30000); // 30 second timeout
    
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
      clearTimeout(timeout);
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode === 200 && json.choices && json.choices[0]) {
            const content = json.choices[0].message.content.trim();
            if (!content) {
              reject(new Error('AI returned empty response'));
            } else {
              resolve(content);
            }
          } else if (res.statusCode === 401) {
            reject(new Error('Invalid API key. Please check your OpenRouter API key.'));
          } else if (res.statusCode === 429) {
            reject(new Error('Rate limit exceeded. Please try again in a moment.'));
          } else if (json.error) {
            reject(new Error(`OpenRouter API error: ${json.error.message || json.error.code || 'Unknown error'}`));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body.substring(0, 200)}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => {
      clearTimeout(timeout);
      if (err.code === 'ENOTFOUND') {
        reject(new Error('Network error: Unable to reach OpenRouter API'));
      } else if (err.code === 'ECONNREFUSED') {
        reject(new Error('Connection refused: OpenRouter API is unavailable'));
      } else {
        reject(new Error(`Network error: ${err.message}`));
      }
    });
    
    req.write(data);
    req.end();
  });
}

async function explainCode(codeText) {
  if (!aiSettings.enabled || !aiSettings.explainCode) {
    throw new Error('AI code explanation is disabled in settings');
  }

  if (!codeText || codeText.trim().length === 0) {
    throw new Error('No code provided to explain');
  }

  if (codeText.length > 5000) {
    throw new Error('Code snippet is too long (max 5000 characters)');
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
    throw error; // Re-throw to let calling code handle it
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
    throw new Error('No content to summarize');
  }

  if (text.length > 10000) {
    throw new Error('Text is too long to summarize (max 10000 characters)');
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

    const result = await callOpenRouter(messages, 200);
    return result || 'Summary could not be generated';
  } catch (error) {
    console.error('AI text summarization failed:', error);
    // For summarization, fall back to simple truncation instead of throwing
    const trimmed = text.trim();
    if (trimmed.length <= 200) return trimmed;
    return trimmed.slice(0, 200).trimEnd() + '… (AI summarization failed)';
  }
}

async function suggestTags(text, context = 'general') {
  if (!aiSettings.enabled || !aiSettings.suggestTags) {
    // Fallback to simple keyword extraction
    return getKeywordTags(text);
  }

  if (!text || text.trim().length === 0) {
    return [];
  }

  if (text.length > 8000) {
    throw new Error('Text is too long for tag suggestion (max 8000 characters)');
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
    if (!response) return getKeywordTags(text);
    
    const tags = response.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0 && tag.length < 30);
    return tags.slice(0, 5); // Limit to 5 tags
  } catch (error) {
    console.error('AI tag suggestion failed:', error);
    // Fallback to simple keyword extraction
    return getKeywordTags(text);
  }
}

function getKeywordTags(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4 && w.length < 20);
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