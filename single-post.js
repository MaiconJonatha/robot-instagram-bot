const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');

const INSTAGRAM_USER = process.env.INSTAGRAM_USER || 'autouonouomioiuioiuis_neiwis';
const INSTAGRAM_PASS = process.env.INSTAGRAM_PASS;
const GOOGLE_COOKIES = process.env.GOOGLE_COOKIES;

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

// Allow forcing an index via POST_INDEX env var, otherwise random
const idx = process.env.POST_INDEX !== undefined
  ? parseInt(process.env.POST_INDEX, 10) % PROMPTS.length
  : Math.floor(Math.random() * PROMPTS.length);

const prompt = PROMPTS[idx];
const caption = CAPTIONS[idx];

async function run() {
  console.log(`[${new Date().toISOString()}] Starting single post (index=${idx})...`);
  console.log(`Prompt: ${prompt}`);

  if (!INSTAGRAM_PASS) { console.error('Missing INSTAGRAM_PASS env var'); process.exit(1); }
  if (!GOOGLE_COOKIES) { console.error('Missing GOOGLE_COOKIES env var'); process.exit(1); }

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

    const cookies = JSON.parse(GOOGLE_COOKIES);
    await context.addCookies(cookies);
    console.log(`Loaded ${cookies.length} Google cookies`);

    const page = await context.newPage();

    console.log('Opening Google Flow...');
    await page.goto(FLOW_PROJECT, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(4000);

    if (page.url().includes('accounts.google.com')) {
      throw new Error('Google session expired — update GOOGLE_COOKIES env var');
    }

    console.log('Typing prompt...');
    const promptInput = await page.$('textarea, [contenteditable="true"], [placeholder*="criar"], [placeholder*="create"], [placeholder*="prompt"]')
      || await page.$('div[role="textbox"]');

    if (promptInput) {
      await promptInput.click();
    } else {
      await page.click('[data-testid*="prompt"], .prompt-input, [aria-label*="prompt"]').catch(() => {});
    }

    await page.waitForTimeout(1000);
    await page.keyboard.type(prompt, { delay: 30 });
    await page.waitForTimeout(1500);

    // Try to click a submit/generate button (Portuguese and English)
    console.log('Looking for generate button...');
    const generateBtn = await page.$(
      'button:has-text("Criar"), button:has-text("Gerar"), button:has-text("Create"), button:has-text("Generate"), button[type="submit"], button[aria-label*="rompt"], button[aria-label*="Criar"], button[aria-label*="Gerar"]'
    ).catch(() => null);
    if (generateBtn) {
      console.log('Clicking generate button');
      await generateBtn.click();
    } else {
      console.log('No button found, trying Enter');
      await page.keyboard.press('Enter');
    }

    console.log('Waiting for image generation (up to 3 min)...');
    await page.waitForTimeout(25000);

    // Screenshot right after submit so we can see state
    await page.screenshot({ path: '/tmp/flow_after_submit.png', fullPage: true }).catch(() => {});

    const isAvatar = (src) => /\/a\/|avatar|profile/i.test(src || '');
    const findGeneratedImage = async () => {
      // Get all images, filter out avatars, pick the largest
      const imgs = await page.$$eval('img', (nodes) =>
        nodes.map((n) => ({
          src: n.src || '',
          alt: n.alt || '',
          w: n.naturalWidth || n.width || 0,
          h: n.naturalHeight || n.height || 0,
        }))
      ).catch(() => []);
      const candidates = imgs.filter(
        (im) => im.src && !/\/a\/|avatar|profile|googleusercontent\.com\/a\//i.test(im.src) && im.w >= 200 && im.h >= 200
      );
      candidates.sort((a, b) => b.w * b.h - a.w * a.h);
      return candidates[0];
    };

    let found = null;
    for (let i = 0; i < 16; i++) {
      found = await findGeneratedImage();
      if (found) {
        console.log(`Found generated image: ${found.src.slice(0, 100)} (${found.w}x${found.h})`);
        break;
      }
      console.log(`Attempt ${i + 1}/16: no generated image yet, waiting 10s...`);
      await page.waitForTimeout(10000);
    }

    if (!found) {
      await page.screenshot({ path: '/tmp/flow_failure.png', fullPage: true }).catch(() => {});
      console.log('Saved debug screenshot to /tmp/flow_failure.png');
      throw new Error('No generated image found after 3 min wait');
    }

    // Click the actual image element matching that src
    const generatedImg = await page.evaluateHandle((targetSrc) => {
      return Array.from(document.querySelectorAll('img')).find((img) => img.src === targetSrc);
    }, found.src);
    if (!generatedImg || !(await generatedImg.asElement())) {
      throw new Error('Could not locate generated image element to click');
    }

    await generatedImg.click();
    await page.waitForTimeout(2000);

    console.log('Downloading image...');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.click('button:has-text("Baixar"), button:has-text("Download"), [aria-label*="Download"], [aria-label*="Baixar"]'),
    ]);

    await page.waitForTimeout(1000);
    const qualityOption = await page.$('text=2K, text=1K, text=HD').catch(() => null);
    if (qualityOption) await qualityOption.click();

    imagePath = await download.path();
    console.log(`Image downloaded to: ${imagePath}`);

    console.log('Opening Instagram...');
    const igPage = await context.newPage();
    await igPage.goto('https://www.instagram.com/', { waitUntil: 'networkidle', timeout: 60000 });
    await igPage.waitForTimeout(3000);

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

    console.log(`[${new Date().toISOString()}] ✅ Post published successfully! Caption: ${caption}`);

  } catch (err) {
    console.error(`[${new Date().toISOString()}] ❌ Error:`, err.message);
    process.exit(1);
  } finally {
    await browser.close();
    if (imagePath && fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  }
}

run();
