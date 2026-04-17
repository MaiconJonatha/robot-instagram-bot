const { chromium } = require('playwright');
const cron = require('node-cron');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const INSTAGRAM_USER = process.env.INSTAGRAM_USER || 'autouonouomioiuioiuis_neiwis';
const INSTAGRAM_PASS = process.env.INSTAGRAM_PASS;

const PROMPTS = [
  'futuristic humanoid robot chrome armor neon blue lights high-tech laboratory cinematic 8K',
  'advanced AI robot glowing red eyes cyberpunk city night rain reflections dramatic lighting photorealistic',
  'sleek white robot assistant holographic displays floating around clean modern design studio lighting ultra detailed',
  'giant mecha robot futuristic city skyline sunset epic scale cinematic ultra realistic',
  'android robot human-like metallic face close-up portrait hyperrealistic dramatic lighting',
  'robot scientist high-tech lab holograms test tubes photorealistic 8K cinematic',
  'stealth robot shadows neon purple lights cyberpunk atmosphere ultra realistic',
  'friendly AI robot companion glowing blue core minimalist white design studio lighting',
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

function downloadImage(prompt) {
  return new Promise((resolve, reject) => {
    const encoded = encodeURIComponent(prompt);
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=1080&height=1080&nologo=true&seed=${Date.now()}`;
    const tmpFile = path.join(os.tmpdir(), `robot_${Date.now()}.jpg`);
    const file = fs.createWriteStream(tmpFile);

    const request = https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        https.get(response.headers.location, (r) => r.pipe(file));
      } else {
        response.pipe(file);
      }
      file.on('finish', () => {
        file.close();
        resolve(tmpFile);
      });
    });

    request.on('error', reject);
    request.setTimeout(60000, () => {
      request.destroy();
      reject(new Error('Image download timeout'));
    });
  });
}

async function generateAndPost() {
  console.log(`[${new Date().toISOString()}] Starting auto post...`);

  const idx = Math.floor(Math.random() * PROMPTS.length);
  const prompt = PROMPTS[idx];
  const caption = CAPTIONS[idx];

  let imagePath;
  try {
    console.log(`Generating image: ${prompt}`);
    imagePath = await downloadImage(prompt);
    console.log(`Image saved to: ${imagePath}`);
  } catch (err) {
    console.error('Image generation failed:', err.message);
    return;
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

    // Login if needed
    const needsLogin = await page.isVisible('input[name="username"]').catch(() => false)
      || await page.isVisible('text=Log in').catch(() => false);

    if (needsLogin) {
      console.log('Logging into Instagram...');
      await page.fill('input[name="username"]', INSTAGRAM_USER);
      await page.fill('input[name="password"]', INSTAGRAM_PASS);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(8000);

      // Dismiss "Save login info" prompt if present
      const saveBtn = await page.$('text=Not now').catch(() => null)
        || await page.$('text=Not Now').catch(() => null);
      if (saveBtn) await saveBtn.click().catch(() => {});
      await page.waitForTimeout(2000);

      // Dismiss notifications prompt if present
      const notNow = await page.$('text=Not Now').catch(() => null);
      if (notNow) await notNow.click().catch(() => {});
      await page.waitForTimeout(2000);
    }

    // Create new post
    console.log('Creating new post...');
    await page.click('[aria-label="New post"]');
    await page.waitForTimeout(2000);

    // Select "Post" option if menu appears
    const postOption = await page.$('text=Post').catch(() => null);
    if (postOption) {
      await postOption.click();
      await page.waitForTimeout(1000);
    }

    const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 15000 });
    await fileInput.setInputFiles(imagePath);
    await page.waitForTimeout(4000);

    // Click Next twice
    await page.click('text=Next').catch(() => page.click('[aria-label="Next"]'));
    await page.waitForTimeout(2000);
    await page.click('text=Next').catch(() => page.click('[aria-label="Next"]'));
    await page.waitForTimeout(2000);

    // Write caption
    const captionBox = await page.$('[aria-label="Write a caption..."]')
      || await page.$('textarea[placeholder]');
    if (captionBox) {
      await captionBox.click();
      await page.keyboard.type(caption, { delay: 30 });
    }
    await page.waitForTimeout(1000);

    // Share
    await page.click('text=Share').catch(() => page.click('[aria-label="Share"]'));
    await page.waitForTimeout(15000);

    console.log(`[${new Date().toISOString()}] Post published successfully!`);

  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error:`, err.message);
  } finally {
    await browser.close();
    // Clean up temp image
    if (imagePath && fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }
}

// Schedule: 8h, 12h, 17h, 20h London (BST = UTC+1)
// UTC: 7h, 11h, 16h, 19h
cron.schedule('0 7 * * *', generateAndPost, { timezone: 'UTC' });
cron.schedule('0 11 * * *', generateAndPost, { timezone: 'UTC' });
cron.schedule('0 16 * * *', generateAndPost, { timezone: 'UTC' });
cron.schedule('0 19 * * *', generateAndPost, { timezone: 'UTC' });

console.log('🤖 Robot Instagram Bot started!');
console.log('Scheduled posts: 8h, 12h, 17h, 20h London time');
