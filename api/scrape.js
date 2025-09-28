// AsiaCloud Scraper API using ScrapingBee for JavaScript rendering
// Free tier: 1000 API calls/month

const rateLimits = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - 60000;
  
  if (!rateLimits.has(ip)) {
    rateLimits.set(ip, []);
  }
  
  const requests = rateLimits.get(ip).filter(time => time > windowStart);
  rateLimits.set(ip, requests);
  
  if (requests.length >= 5) {
    return false;
  }
  
  requests.push(now);
  return true;
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function parseHlsForgeUrl(href) {
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

function detectLanguage(text) {
  const textLower = text.toLowerCase();
  if (textLower.includes('english')) return 'English';
  if (textLower.includes('hindi')) return 'Hindi';
  if (textLower.includes('japanese')) return 'Japanese';
  if (textLower.includes('chinese')) return 'Chinese';
  return 'Unknown';
}

function extractAsiaCloudButtons(html) {
  const buttons = [];
  
  // Multiple regex patterns to catch different formats
  const patterns = [
    // Pattern 1: Direct class matching
    /<a\s+[^>]*class\s*=\s*["'][^"']*Download_sourceLink__BTn4l[^"']*["'][^>]*href\s*=\s*["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi,
    
    // Pattern 2: Any hlsforge link
    /<a\s+[^>]*href\s*=\s*["']([^"']*hlsforge\.com[^"']*)["'][^>]*>([^<]*)<\/a>/gi,
    
    // Pattern 3: AsiaCloud text
    /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>\s*([^<]*AsiaCloud[^<]*)\s*<\/a>/gi,
    
    // Pattern 4: Flexible class
    /<a\s+[^>]*class\s*=\s*["'][^"']*Download[^"']*["'][^>]*href\s*=\s*["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi,
    
    // Pattern 5: Any button with AsiaCloud
    /<button[^>]*>\s*<a[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([^<]*AsiaCloud[^<]*)<\/a>\s*<\/button>/gi,
    
    // Pattern 6: Data attributes
    /<a[^>]*data-url\s*=\s*["']([^"']+)["'][^>]*>([^<]*AsiaCloud[^<]*)<\/a>/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      if (!buttons.some(btn => btn.href === match[1])) {
        buttons.push({
          href: match[1],
          text: match[2].trim(),
          method: `pattern_${patterns.indexOf(pattern) + 1}`
        });
      }
    }
  }
  
  return buttons;
}

// Use ScrapingBee API (Free tier available)
async function fetchWithScrapingBee(url) {
  const SCRAPINGBEE_API_KEY = 'YOUR_FREE_API_KEY'; // Get from https://www.scrapingbee.com/
  const encodedUrl = encodeURIComponent(url);
  
  const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${SCRAPINGBEE_API_KEY}&url=${encodedUrl}&render_js=true&wait=3000`;
  
  try {
    console.log('🔄 Using ScrapingBee API...');
    const response = await fetch(scrapingBeeUrl, {
      timeout: 30000
    });
    
    if (!response.ok) {
      throw new Error(`ScrapingBee API error: ${response.status}`);
    }
    
    return await response.text();
  } catch (error) {
    throw new Error(`ScrapingBee failed: ${error.message}`);
  }
}

// Alternative free services
async function fetchWithFreeProxy(url) {
  const freeServices = [
    // Jina AI Reader (free)
    `https://r.jina.ai/${url}`,
    
    // AllOrigins
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    
    // CORS Proxy
    `https://corsproxy.io/?${encodeURIComponent(url)}`
  ];
  
  for (const serviceUrl of freeServices) {
    try {
      console.log(`🔄 Trying: ${serviceUrl.split('/')[2]}`);
      const response = await fetch(serviceUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.ok) {
        const html = await response.text();
        console.log(`✅ Success with: ${serviceUrl.split('/')[2]}`);
        return html;
      }
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      continue;
    }
  }
  
  throw new Error('All free proxies failed');
}

module.exports = async (req, res) => {
  cors(res);
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  if (!checkRateLimit(ip)) {
    res.status(429).json({
      success: false,
      error: 'Too Many Requests'
    });
    return;
  }

  res.setHeader('Content-Type', 'application/json');

  try {
    const { url } = req.method === 'POST' 
      ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body)
      : req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL parameter is required'
      });
    }

    let targetUrl;
    try {
      targetUrl = new URL(url);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }

    console.log(`🚀 Scraping: ${targetUrl.href}`);
    
    let html;
    try {
      // Try free proxies first
      html = await fetchWithFreeProxy(targetUrl.href);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'All scraping methods failed',
        message: error.message,
        solution: 'Get a free API key from ScrapingBee and update the script'
      });
    }
    
    const buttons = extractAsiaCloudButtons(html);
    
    if (buttons.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No AsiaCloud buttons found',
        debug: {
          htmlLength: html.length,
          containsHlsforge: html.includes('hlsforge'),
          containsAsiaCloud: html.includes('AsiaCloud')
        }
      });
    }
    
    const results = buttons.map((button, index) => {
      const urlInfo = parseHlsForgeUrl(button.href);
      
      return {
        index: index + 1,
        buttonText: button.text,
        language: detectLanguage(button.text),
        hlsforgeUrl: button.href,
        ...urlInfo,
        timestamp: new Date().toISOString()
      };
    });

    const validResults = results.filter(result => result.m3u8Url);

    res.status(200).json({
      success: true,
      data: {
        url: targetUrl.href,
        totalButtons: buttons.length,
        validButtons: validResults.length,
        results: validResults,
        summary: {
          languages: validResults.reduce((acc, result) => {
            acc[result.language] = (acc[result.language] || 0) + 1;
            return acc;
          }, {})
        }
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: 'Scraping failed',
      message: error.message
    });
  }
};
