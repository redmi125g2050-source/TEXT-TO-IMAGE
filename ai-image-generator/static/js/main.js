// ── Element refs ──────────────────────────────────────────────
const promptInput      = document.getElementById('prompt-input');
const generateBtn      = document.getElementById('generate-btn');
const regenerateBtn    = document.getElementById('regenerate-btn');
const downloadBtn      = document.getElementById('download-btn');
const loader           = document.getElementById('loader');
const errorBox         = document.getElementById('error-box');
const errorText        = document.getElementById('error-text');
const resultCard       = document.getElementById('result-card');
const resultImage      = document.getElementById('result-image');
const resultPromptText = document.getElementById('result-prompt-text');
const chips            = document.querySelectorAll('.chip');

// Stores the latest generated image URL for downloading
let currentImageUrl = '';

// ── Event Listeners ───────────────────────────────────────────
generateBtn.addEventListener('click', generateImage);
regenerateBtn.addEventListener('click', generateImage);
downloadBtn.addEventListener('click', downloadImage);

promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') generateImage();
});

chips.forEach(chip => {
  chip.addEventListener('click', () => {
    promptInput.value = chip.dataset.prompt;
    promptInput.focus();
  });
});

// ── Helpers ───────────────────────────────────────────────────
function setLoading(state) {
  loader.classList.toggle('active', state);
  generateBtn.disabled = state;
  generateBtn.textContent = state ? 'Generating…' : 'Generate →';
}

function showError(msg) {
  errorBox.classList.add('active');
  errorText.textContent = msg;
  resultCard.classList.remove('active');
}

function hideError() {
  errorBox.classList.remove('active');
}

// Safely parse JSON — never crashes on HTML error pages
async function safeParseJSON(response) {
  const raw = await response.text();
  try {
    return JSON.parse(raw);
  } catch {
    const preview = raw.slice(0, 200).trim();
    throw new Error(`Server error (HTTP ${response.status}). Response was not JSON:\n${preview}`);
  }
}

// ── Generate ──────────────────────────────────────────────────
async function generateImage() {
  const prompt = promptInput.value.trim();

  if (!prompt) {
    promptInput.focus();
    return;
  }

  hideError();
  resultCard.classList.remove('active');
  setLoading(true);

  try {
    const response = await fetch('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    const data = await safeParseJSON(response);

    if (!response.ok) {
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }

    currentImageUrl = data.image_url;
    resultPromptText.textContent = `"${data.prompt}"`;
    resultImage.src = currentImageUrl;

    resultImage.onload = () => {
      resultCard.classList.add('active');
    };

    resultImage.onerror = () => {
      // Image URL exists but couldn't render — still show the card
      resultCard.classList.add('active');
    };

  } catch (err) {
    showError(err.message || 'An unexpected error occurred. Check your API key and try again.');
  } finally {
    setLoading(false);
  }
}

// ── Download ──────────────────────────────────────────────────
async function downloadImage() {
  if (!currentImageUrl) return;

  downloadBtn.textContent = '⏳ Downloading…';
  downloadBtn.disabled = true;

  try {
    const response = await fetch('/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: currentImageUrl }),
    });

    if (!response.ok) throw new Error('Download failed');

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;

    const safeName = promptInput.value
      .trim()
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase()
      .slice(0, 30);

    a.download = `textlens_${safeName}_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

  } catch {
    // Fallback: open in new tab so user can save manually
    window.open(currentImageUrl, '_blank');
  } finally {
    downloadBtn.textContent = '↓ Download';
    downloadBtn.disabled = false;
  }
}