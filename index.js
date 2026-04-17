const { chromium } = require('playwright');
const cron = require('node-cron');

const INSTAGRAM_USER = process.env.INSTAGRAM_USER || 'autouonouomioiuioiuis_neiwis';
const INSTAGRAM_PASS = process.env.INSTAGRAM_PASS;
const GOOGLE_COOKIES = process.env.GOOGLE_COOKIES; // JSON string of cookies
const FLOW_PROJECT = 'https://labs.google/fx/pt/tools/flow/project/92966078-bb72-4c7b-aaf4-5c99bfe05549';

const PROMPTS = [
  'A futuristic humanoid robot with chrome armor and neon blue lights in a high-tech lab, cinematic, 8K',
  'An advanced AI robot with glowing red eyes in a cyberpunk city at night, photorealistic, dramatic lighting',
  'A sleek white robot assistant surrounded by holographic displays, clean modern design, ultra detailed',
  'A giant mecha robot over a futuristic city skyline at sunset, epic scale, cinematic',
  'An android robot with human-like metallic face, close-up portrait, hyperrealistic, dramatic lighting',
  'A robot scientist in a high-tech lab with holograms and test tubes, photorealistic, 8K',
  'A stealth robot emerging from shadows, neon purple lights, cyberpunk atmosphere, ultra realistic',
  'A friendly AI robot companion with glowing blue core, minimalist white design, studio lighting',
];

const CAPTIONS = [
  '🤖 The future is now. AI-generated humanoid robot — built from dreams and code. #AIArt #RoboticsAI #FutureTech #ArtificialIntelligence #GeminiAI #SciFi',
  '⚡ Machines that think. Worlds that glow. Welcome to the AI era. 🌆 #CyberpunkAI #RobotArt #AIGenerated #FutureTech #Technology',
  '🧠 Intelligence reimagined. Meet your AI companion of tomorrow. ✨ #AICompanion #RobotDesign #FutureIsNow #ArtificialIntelligence #Innovation',
  '🌆 Giants of steel. Masters of tomorrow. Mecha robots ruling the skyline. 🤖 #MechaArt #GiantRobot #SciFi #AIGenerated #FutureTech',
  '👁️ Human-like. Machine-perfect. The android revolution begins. 🤖 #AndroidAI #HyperrealisticAI #RobotArt #FutureTech #AIPortrait',
  '🔬 Science meets silicon. AI robots pushing the boundaries of discovery. 🧬 #RobotScientist #AIInnovation #FutureTech #Technology',
  '🌑 From the shadows, the future emerges. Stealth AI activated. 💜 #StealthRobot #CyberpunkAI #FutureTech #AIArt #GeminiFlow',
  '💙 Built to help. Designed to inspire. The friendly face of AI. 🤖 #FriendlyRobot #AICompanion #FutureTech #Innovation #RobotArt',
];

async function generateAndPost() {
  console.log(`[${new Date().toISOString()}] Starting auto post...`);

  const idx = Math.floor(Math.random() * PROMPTS.length);
  const prompt = PROMPTS[idx];
  const caption = CAPTIONS[idx];

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 },
    });

    // Load Google cookies if provided
    if (GOOGLE_COOKIES) {
      const cookies = JSON.parse(GOOGLE_COOKIES);
      await context.addCookies(cookies);
    }

    const page = await context.newPage();

    // Step 1: Open Flow and generate image
    console.log('Opening Google Flow...');
    await page.goto(FLOW_PROJECT, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Click prompt input and type
    await page.click('text=O que você quer criar?');
    await page.keyboard.type(prompt);
    await page.keyboard.press('Enter');

    // Wait for generation
    console.log('Generating image...');
    await page.waitForTimeout(30000);

    // Click on generated image
    const img = await page.waitForSelector('img[src*="labs.google"]', { timeout: 60000 });
    await img.click();
    await page.waitForTimeout(2000);

    // Download 1K
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('text=Baixar'),
    ]);
    await page.waitForTimeout(1000);
    await page.click('text=1K');
    const path = await download.path();
    console.log(`Image saved to: ${path}`);

    // Step 2: Post to Instagram
    console.log('Opening Instagram...');
    const igPage = await context.newPage();
    await igPage.goto('https://www.instagram.com/', { waitUntil: 'networkidle', timeout: 60000 });
    await igPage.waitForTimeout(3000);

    // Login if needed
    if (await igPage.isVisible('text=Log in') || await igPage.isVisible('input[name="username"]')) {
      console.log('Logging into Instagram...');
      await igPage.fill('input[name="username"]', INSTAGRAM_USER);
      await igPage.fill('input[name="password"]', INSTAGRAM_PASS);
      await igPage.click('button[type="submit"]');
      await igPage.waitForTimeout(5000);
    }

    // Create new post
    await igPage.click('[aria-label="New post"]');
    await igPage.waitForTimeout(1000);

    const fileInput = await igPage.waitForSelector('input[type="file"]');
    await fileInput.setInputFiles(path);
    await igPage.waitForTimeout(3000);

    await igPage.click('text=Next');
    await igPage.waitForTimeout(2000);
    await igPage.click('text=Next');
    await igPage.waitForTimeout(2000);

    // Write caption
    await igPage.click('[aria-label="Write a caption..."]');
    await igPage.keyboard.type(caption);
    await igPage.waitForTimeout(1000);

    // Share
    await igPage.click('text=Share');
    await igPage.waitForTimeout(10000);

    console.log(`[${new Date().toISOString()}] Post published successfully!`);

  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error:`, err.message);
  } finally {
    await browser.close();
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

// Run once on start (optional - comment out if not needed)
// generateAndPost();
