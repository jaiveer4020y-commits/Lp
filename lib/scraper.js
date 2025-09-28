const puppeteer = require('puppeteer-core');
const chrome = require('chrome-aws-lambda');

class AsiaCloudScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initBrowser() {
    try {
      this.browser = await puppeteer.launch({
        args: [
          ...chrome.args,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ],
        defaultViewport: chrome.defaultViewport,
        executablePath: await chrome.executablePath,
        headless: chrome.headless,
        ignoreHTTPSErrors: true,
      });

      this.page = await this.browser.newPage();
      
      // Set user agent and headers
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      );

      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      });

    } catch (error) {
      throw new Error(`Browser initialization failed: ${error.message}`);
    }
  }

  async scrapeAsiaCloudButtons(url, waitTime = 5000) {
    if (!this.browser) {
      await this.initBrowser();
    }

    try {
      console.log(`🌐 Navigating to: ${url}`);
      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for the page to load completely
      console.log(`⏳ Waiting ${waitTime}ms for content to load...`);
      await this.page.waitForTimeout(waitTime);

      // Try multiple strategies to find AsiaCloud buttons
      const buttons = await this.findAsiaCloudButtons();
      
      if (buttons.length === 0) {
        console.log('🔍 No buttons found with primary selectors, trying alternatives...');
        await this.page.waitForTimeout(2000);
        return await this.findButtonsAlternativeMethods();
      }

      return buttons;

    } catch (error) {
      console.error('Scraping error:', error);
      throw new Error(`Scraping failed: ${error.message}`);
    }
  }

  async findAsiaCloudButtons() {
    const selectors = [
      'a.Download_sourceLink__BTn4l',
      'a[href*="hlsforge.com"]',
      '[class*="asiacloud" i]',
      '[class*="download" i]'
    ];

    for (const selector of selectors) {
      try {
        const buttons = await this.page.$$eval(selector, elements => 
          elements.map(el => ({
            text: el.textContent?.trim() || '',
            href: el.href,
            className: el.className,
            tagName: el.tagName
          }))
        );

        if (buttons.length > 0) {
          console.log(`✅ Found ${buttons.length} buttons with selector: ${selector}`);
          return buttons;
        }
      } catch (error) {
        console.log(`Selector ${selector} failed:`, error.message);
      }
    }

    return [];
  }

  async findButtonsAlternativeMethods() {
    try {
      // Get all links and filter
      const allLinks = await this.page.$$eval('a', elements =>
        elements
          .filter(el => el.href.includes('hlsforge.com') || el.textContent.includes('AsiaCloud'))
          .map(el => ({
            text: el.textContent?.trim() || '',
            href: el.href,
            className: el.className,
            tagName: el.tagName,
            method: 'alternative'
          }))
      );

      console.log(`🔍 Alternative method found ${allLinks.length} links`);
      return allLinks;

    } catch (error) {
      console.error('Alternative method failed:', error);
      return [];
    }
  }

  async parseHlsForgeUrl(href) {
    try {
      const url = new URL(href);
      const params = new URLSearchParams(url.search);
      
      return {
        m3u8Url: params.get('url') ? decodeURIComponent(params.get('url')) : null,
        title: params.get('title'),
        season: params.get('season'),
        episode: params.get('episode'),
        id: params.get('id'),
        downloadTitle: params.get('downloadTitle')
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  detectLanguage(text) {
    const textLower = text.toLowerCase();
    if (textLower.includes('english')) return 'English';
    if (textLower.includes('hindi')) return 'Hindi';
    if (textLower.includes('japanese')) return 'Japanese';
    if (textLower.includes('chinese')) return 'Chinese';
    return 'Unknown';
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

module.exports = AsiaCloudScraper;
