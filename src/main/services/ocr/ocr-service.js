const Tesseract = require('tesseract.js');

async function performOcr(buffer, languages = 'eng') {
  try {
    const { data } = await Tesseract.recognize(buffer, languages);
    return data.text.trim();
  } catch (err) {
    console.error('Tesseract OCR error:', err);
    return '';
  }
}

module.exports = { performOcr };