const { chromium } = require('playwright');
const cron = require('node-cron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const INSTAGRAM_USER = process.env.INSTAGRAM_USER || 'autouonouomioiuioiuis_neiwis';
const INSTAGRAM_PASS = process.env.INSTAGRAM_PASS;
const GOOGLE_COOKIES = process.env.GOOGLE_COOKIES; // JSON array of Google cookies

const FLOW_PROJECT = 'https://labs.google/fx/pt/tools/flow/project/92966078-bb72-4c7b-aaf4-5c99bfe05549';

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

async function generateAndPost() {
  console.log(`[${new Date().toISOString()}] Starting auto post...`);

  const idx = Math.floor(Math.random() * PROMPTS.length);
  const prompt = PROMPTS[idx];
  const caption = CAPTIONS[idx];

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    downloadsPath: os.tmpdir(),
  });

  let imagePath = null;

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 },
      acceptDownloads: true,
    });

    // Load Google session cookies
    if (GOOGLE_COOKIES) {
      const cookies = JSON.parse(GOOGLE_COOKIES);
      await context.addCookies(cookies);
      console.log(`Loaded ${cookies.length} Google cookies`);
    }

    const page = await context.newPage();

    // === STEP 1: Generate image with Google Flow ===
    console.log('Opening Google Flow...');
    await page.goto(FLOW_PROJECT, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(4000);

    // Check if we're logged in (Google may redirect to login)
    if (page.url().includes('accounts.google.com')) {
      throw new Error('Google session expired — update GOOGLE_COOKIES env var');
    }

    // Click the prompt input area
    console.log('Typing prompt...');
    const promptInput = await page.$('textarea, [contenteditable="true"], [placeholder*="criar"], [placeholder*="create"], [placeholder*="prompt"]')
      || await page.$('div[role="textbox"]');

    if (promptInput) {
      await promptInput.click();
    } else {
      // Try clicking somewhere that looks like a text input
      await page.click('[data-testid*="prompt"], .prompt-input, [aria-label*="prompt"]').catch(() => {});
    }

    await page.waitForTimeout(1000);
    await page.keyboard.type(prompt, { delay: 30 });
    await page.keyboard.press('Enter');

    // Wait for image generation (up to 90 seconds)
    console.log('Waiting for image generation...');
    await page.waitForTimeout(15000);

    // Wait for an image to appear
    let generatedImg = null;
    for (let i = 0; i < 6; i++) {
      generatedImg = await page.$('img[src*="labs.google"], img[src*="storage.googleapis"]').catch(() => null);
      if (generatedImg) break;
      await page.waitForTimeout(10000);
    }

    if (!generatedImg) {
      throw new Error('No generated image found after waiting');
    }

    // Click on the image to open it
    await generatedImg.click();
    await page.waitForTimeout(2000);

    // Download the image
    console.log('Downloading image...');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.click('button:has-text("Baixar"), button:has-text("Download"), [aria-label*="Download"], [aria-label*="Baixar"]'),
    ]);

    await page.waitForTimeout(1000);

    // Select quality if prompted
    const qualityOption = await page.$('text=2K, text=1K, text=HD').catch(() => null);
    if (qualityOption) await qualityOption.click();

    imagePath = await download.path();
    console.log(`Image downloaded to: ${imagePath}`);

    // === STEP 2: Post to Instagram ===
    console.log('Opening Instagram...');
    const igPage = await context.newPage();
    await igPage.goto('https://www.instagram.com/', { waitUntil: 'networkidle', timeout: 60000 });
    await igPage.waitForTimeout(3000);

    // Login if needed
    const needsLogin = await igPage.isVisible('input[name="username"]').catch(() => false);
    if (needsLogin) {
      console.log('Logging into Instagram...');
      await igPage.fill('input[name="username"]', INSTAGRAM_USER);
      await igPage.fill('input[name="password"]', INSTAGRAM_PASS);
      await igPage.click('button[type="submit"]');
      await igPage.waitForTimeout(8000);

      const notNow = await igPage.$('text=Not now, text=Not Now').catch(() => null);
      if (notNow) await notNow.click().catch(() => {});
      await igPage.waitForTimeout(2000);

      const notNow2 = await igPage.$('text=Not Now').catch(() => null);
      if (notNow2) await notNow2.click().catch(() => {});
      await igPage.waitForTimeout(2000);
    }

    // Create new post
    await igPage.click('[aria-label="New post"]');
    await igPage.waitForTimeout(2000);

    const postOption = await igPage.$('text=Post').catch(() => null);
    if (postOption) { await postOption.click(); await igPage.waitForTimeout(1000); }

    const fileInput = await igPage.waitForSelector('input[type="file"]', { timeout: 15000 });
    await fileInput.setInputFiles(imagePath);
    await igPage.waitForTimeout(4000);

    await igPage.click('text=Next').catch(() => igPage.click('[aria-label="Next"]'));
    await igPage.waitForTimeout(2000);
    await igPage.click('text=Next').catch(() => igPage.click('[aria-label="Next"]'));
    await igPage.waitForTimeout(2000);

    const captionBox = await igPage.$('[aria-label="Write a caption..."]') || await igPage.$('textarea[placeholder]');
    if (captionBox) {
      await captionBox.click();
      await igPage.keyboard.type(caption, { delay: 30 });
    }
    await igPage.waitForTimeout(1000);

    await igPage.click('text=Share').catch(() => igPage.click('[aria-label="Share"]'));
    await igPage.waitForTimeout(15000);

    console.log(`[${new Date().toISOString()}] ✅ Post published successfully!`);

  } catch (err) {
    console.error(`[${new Date().toISOString()}] ❌ Error:`, err.message);
  } finally {
    await browser.close();
    if (imagePath && fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  }
}

// Schedule: 8h, 12h, 17h, 20h London (BST = UTC+1 → UTC: 7, 11, 16, 19)
cron.schedule('0 7 * * *', generateAndPost, { timezone: 'UTC' });
cron.schedule('0 11 * * *', generateAndPost, { timezone: 'UTC' });
cron.schedule('0 16 * * *', generateAndPost, { timezone: 'UTC' });
cron.schedule('0 19 * * *', generateAndPost, { timezone: 'UTC' });

console.log('🤖 Robot Instagram Bot started!');
console.log('Scheduled posts: 8h, 12h, 17h, 20h London time');
