const https = require('https');

let openRouterApiKey = null;
let aiSettings = {
  enabled: true,
  explainCode: true,
  summarizeText: true,
  suggestTags: true,
  model: 'moonshotai/kimi-k2:free'
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
      temperature: 0.7,
      top_p: 1.0
    };

    // Debug logging (uncomment if needed)
    // console.log('OpenRouter API Request:', { model: payload.model, messageCount: messages.length, maxTokens: maxTokens });

    const data = Buffer.from(JSON.stringify(payload, null, 2));
    const timeout = setTimeout(() => {
      req.destroy();
      reject(new Error('Request timeout - OpenRouter API took too long to respond'));
    }, 60000); // 60 second timeout for AI
    
    const req = https.request({
      method: 'POST',
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://codecap.app',
        'X-Title': 'CodeCap Desktop',
        'Content-Length': data.length
      }
    }, (res) => {
      clearTimeout(timeout);
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        // Debug logging (uncomment if needed)
        // console.log('OpenRouter API Response Status:', res.statusCode);
        // console.log('OpenRouter API Response Headers:', res.headers);
        
        try {
          const json = JSON.parse(body);
          // console.log('OpenRouter API Response Body:', JSON.stringify(json, null, 2));
          
          if (res.statusCode === 200 && json.choices && json.choices.length > 0) {
            const choice = json.choices[0];
            if (choice.message && choice.message.content) {
              const content = choice.message.content.trim();
              if (!content || content.length === 0) {
                // console.error('Empty content from OpenRouter:', choice);
                reject(new Error('AI returned empty response'));
              } else {
                // console.log('OpenRouter Success - Content length:', content.length);
                resolve(content);
              }
            } else {
              // console.error('Invalid choice structure:', choice);
              reject(new Error('Invalid response structure from OpenRouter API'));
            }
          } else if (res.statusCode === 401) {
            reject(new Error('Invalid API key. Please check your OpenRouter API key.'));
          } else if (res.statusCode === 429) {
            reject(new Error('Rate limit exceeded. Please try again in a moment.'));
          } else if (res.statusCode === 400) {
            const errorMsg = json.error?.message || 'Bad request to OpenRouter API';
            reject(new Error(`Bad request: ${errorMsg}`));
          } else if (json.error) {
            reject(new Error(`OpenRouter API error: ${json.error.message || json.error.code || 'Unknown error'}`));
          } else {
            // console.error('Unexpected response:', { status: res.statusCode, body: body.substring(0, 500) });
            reject(new Error(`HTTP ${res.statusCode}: ${body.substring(0, 200)}`));
          }
        } catch (e) {
          // console.error('Failed to parse OpenRouter response:', e, 'Body:', body.substring(0, 500));
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => {
      clearTimeout(timeout);
      // console.error('OpenRouter request error:', err);
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
        role: 'user',
        content: `Please explain what this code does. Be clear and concise, focusing on the main functionality and any important concepts. Keep your explanation under 200 words.\n\nCode to explain:\n\`\`\`\n${codeText}\n\`\`\``
      }
    ];

    return await callOpenRouter(messages, 800);
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
        role: 'user',
        content: `Please provide a concise summary of the following text in 1-2 sentences. Focus on the main points and purpose:\n\n${text}`
      }
    ];

    const result = await callOpenRouter(messages, 600);
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
        role: 'user',
        content: `Please suggest 3-5 relevant tags for this ${context} content. Return only the tags as a comma-separated list with no explanations.\n\nContent:\n${text.substring(0, 2000)}`
      }
    ];

    const response = await callOpenRouter(messages, 300);
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