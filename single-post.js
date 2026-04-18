const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');

const INSTAGRAM_USER = process.env.INSTAGRAM_USER || 'autouonouomioiuioiuis_neiwis';
const INSTAGRAM_PASS = process.env.INSTAGRAM_PASS;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const PROMPTS = [
  'A futuristic humanoid robot with chrome armor and neon blue lights in a high-tech laboratory, cinematic lighting, ultra realistic, 8K',
  'An advanced AI robot with glowing red eyes in a cyberpunk city at night, rain reflections, dramatic lighting, photorealistic',
  'A sleek white robot assistant with holographic displays floating around it, clean modern design, studio lighting, ultra detailed',
  'A giant mecha robot standing over a futuristic city skyline at sunset, epic scale, cinematic, ultra realistic',
  'An android robot with human-like metallic skin, close-up portrait, dramatic lighting, hyperrealistic, sharp focus',
  'A robot scientist in a high-tech lab surrounded by holograms and test tubes, cinematic, photorealistic, 8K',
  'A stealth combat robot emerging from shadows, neon purple accent lights, cyberpunk atmosphere, ultra realistic',
  'A friendly companion robot with a glowing blue energy core, minimalist white and silver design, studio lighting',
];

const CAPTIONS = [
  '🤖 The future is now. AI-generated humanoid robot — built from dreams and code. #AIArt #RoboticsAI #FutureTech #ArtificialIntelligence #SciFi',
  '⚡ Machines that think. Worlds that glow. Welcome to the AI era. 🌆 #CyberpunkAI #RobotArt #AIGenerated #FutureTech #Technology',
  '🧠 Intelligence reimagined. Meet your AI companion of tomorrow. ✨ #AICompanion #RobotDesign #FutureIsNow #ArtificialIntelligence #Innovation',
  '🌆 Giants of steel. Masters of tomorrow. Mecha robots ruling the skyline. 🤖 #MechaArt #GiantRobot #SciFi #AIGenerated #FutureTech',
  '👁️ Human-like. Machine-perfect. The android revolution begins. 🤖 #AndroidAI #HyperrealisticAI #RobotArt #FutureTech #AIPortrait',
  '🔬 Science meets silicon. AI robots pushing the boundaries of discovery. 🧬 #RobotScientist #AIInnovation #FutureTech #Technology',
  '🌑 From the shadows, the future emerges. Stealth AI activated. 💜 #StealthRobot #CyberpunkAI #FutureTech #AIArt',
  '💙 Built to help. Designed to inspire. The friendly face of AI. 🤖 #FriendlyRobot #AICompanion #FutureTech #Innovation #RobotArt',
];

const idx = process.env.POST_INDEX !== undefined
  ? parseInt(process.env.POST_INDEX, 10) % PROMPTS.length
  : Math.floor(Math.random() * PROMPTS.length);

const prompt = PROMPTS[idx];
const caption = CAPTIONS[idx];

async function generateImage(promptText) {
  console.log('Calling Gemini API (Imagen 3) for image...');

  // Try Imagen 3 first (highest quality)
  const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GEMINI_API_KEY}`;
  const imagenBody = JSON.stringify({
    instances: [{ prompt: promptText }],
    parameters: { sampleCount: 1, aspectRatio: '1:1' },
  });

  let res = await fetch(imagenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: imagenBody,
  });

  if (res.ok) {
    const data = await res.json();
    const b64 = data.predictions?.[0]?.bytesBase64Encoded;
    if (b64) {
      const p = path.join(os.tmpdir(), `robot_${Date.now()}.png`);
      fs.writeFileSync(p, Buffer.from(b64, 'base64'));
      console.log(`Imagen 3 image saved: ${p}`);
      return p;
    }
  } else {
    console.log(`Imagen 3 failed (${res.status}), trying Gemini 2.5 Flash Image...`);
  }

  // Fallback: Gemini 2.5 Flash Image (Nano Banana) — free tier
  const flashUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${GEMINI_API_KEY}`;
  const flashBody = JSON.stringify({
    contents: [{ parts: [{ text: promptText }] }],
  });

  res = await fetch(flashUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: flashBody,
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini Flash failed: ${res.status} ${t}`);
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find(p => p.inlineData || p.inline_data);
  if (!imgPart) throw new Error('No image in Gemini response: ' + JSON.stringify(data).slice(0, 500));

  const b64 = (imgPart.inlineData || imgPart.inline_data).data;
  const p = path.join(os.tmpdir(), `robot_${Date.now()}.png`);
  fs.writeFileSync(p, Buffer.from(b64, 'base64'));
  console.log(`Gemini Flash image saved: ${p}`);
  return p;
}

async function run() {
  console.log(`[${new Date().toISOString()}] Starting post (idx=${idx})`);
  console.log(`Prompt: ${prompt}`);

  if (!INSTAGRAM_PASS) { console.error('Missing INSTAGRAM_PASS'); process.exit(1); }
  if (!GEMINI_API_KEY) { console.error('Missing GEMINI_API_KEY'); process.exit(1); }

  let imagePath;
  try {
    imagePath = await generateImage(prompt);
  } catch (err) {
    console.error('Image generation failed:', err.message);
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();

    console.log('Opening Instagram...');
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    const needsLogin = await page.isVisible('input[name="username"]').catch(() => false);
    if (needsLogin) {
      console.log('Logging in...');
      await page.fill('input[name="username"]', INSTAGRAM_USER);
      await page.fill('input[name="password"]', INSTAGRAM_PASS);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(8000);

      for (const text of ['Not now', 'Not Now', 'Agora não']) {
        const b = await page.$(`text=${text}`).catch(() => null);
        if (b) await b.click().catch(() => {});
        await page.waitForTimeout(1500);
      }
    }

    console.log('Creating post...');
    await page.click('[aria-label="New post"], [aria-label="Nova publicação"]');
    await page.waitForTimeout(2000);

    const postBtn = await page.$('text=Post').catch(() => null);
    if (postBtn) { await postBtn.click(); await page.waitForTimeout(1000); }

    const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 15000 });
    await fileInput.setInputFiles(imagePath);
    await page.waitForTimeout(4000);

    await page.click('text=Next').catch(() => page.click('[aria-label="Next"]'));
    await page.waitForTimeout(2000);
    await page.click('text=Next').catch(() => page.click('[aria-label="Next"]'));
    await page.waitForTimeout(2000);

    const captionBox = await page.$('[aria-label="Write a caption..."]') || await page.$('textarea[placeholder]');
    if (captionBox) {
      await captionBox.click();
      await page.keyboard.type(caption, { delay: 30 });
    }
    await page.waitForTimeout(1000);

    await page.click('text=Share').catch(() => page.click('[aria-label="Share"]'));
    await page.waitForTimeout(15000);

    console.log(`[${new Date().toISOString()}] ✅ Posted: ${caption.slice(0, 60)}...`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
    if (imagePath && fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  }
}

run();
