const AsiaCloudScraper = require('../lib/scraper');

// Simple rate limiting
const rateLimits = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute window
  
  if (!rateLimits.has(ip)) {
    rateLimits.set(ip, []);
  }
  
  const requests = rateLimits.get(ip).filter(time => time > windowStart);
  rateLimits.set(ip, requests);
  
  if (requests.length >= 10) {
    return false; // Rate limited
  }
  
  requests.push(now);
  return true;
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async (req, res) => {
  // Handle CORS
  cors(res);
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Rate limiting
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  if (!checkRateLimit(ip)) {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.'
    });
    return;
  }

  // Set response headers
  res.setHeader('Content-Type', 'application/json');

  try {
    // Parse request parameters
    const { url, waitTime = 5000 } = req.method === 'POST' 
      ? req.body 
      : req.query;

    // Validate URL
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL parameter is required',
        example: '/api/scrape?url=https://rivestream.com/watch/123'
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format',
        message: 'Please provide a valid URL including http:// or https://'
      });
    }

    console.log(`🚀 Starting scrape for: ${url}`);
    
    const scraper = new AsiaCloudScraper();
    
    try {
      // Scrape the page
      const buttons = await scraper.scrapeAsiaCloudButtons(url, parseInt(waitTime));
      
      // Process results
      const results = await Promise.all(
        buttons.map(async (button, index) => {
          const urlInfo = await scraper.parseHlsForgeUrl(button.href);
          
          return {
            index: index + 1,
            buttonText: button.text,
            language: scraper.detectLanguage(button.text),
            hlsforgeUrl: button.href,
            ...urlInfo,
            elementInfo: {
              tagName: button.tagName,
              className: button.className,
              detectionMethod: button.method || 'primary'
            },
            timestamp: new Date().toISOString()
          };
        })
      );

      // Filter out invalid results
      const validResults = results.filter(result => result.m3u8Url);

      console.log(`✅ Scraping completed: ${validResults.length} valid buttons found`);

      // Send success response
      res.status(200).json({
        success: true,
        data: {
          url: url,
          totalButtons: buttons.length,
          validButtons: validResults.length,
          results: validResults,
          summary: {
            languages: validResults.reduce((acc, result) => {
              acc[result.language] = (acc[result.language] || 0) + 1;
              return acc;
            }, {}),
            scrapingDuration: `${parseInt(waitTime) + 3000}ms`
          },
          metadata: {
            timestamp: new Date().toISOString(),
            userAgent: req.headers['user-agent'],
            ip: ip
          }
        }
      });

    } finally {
      // Always close the browser
      await scraper.close();
    }

  } catch (error) {
    console.error('❌ API Error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Scraping failed',
      message: error.message,
      tips: [
        'Check if the URL is accessible',
        'Try increasing the waitTime parameter',
        'Ensure the page contains AsiaCloud buttons',
        'The site might be blocking automated requests'
      ]
    });
  }
};
