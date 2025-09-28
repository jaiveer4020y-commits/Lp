// AsiaCloud Scraper API using a proxy service for JavaScript rendering
// This works on Vercel free tier

const rateLimits = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute window
  
  if (!rateLimits.has(ip)) {
    rateLimits.set(ip, []);
  }
  
  const requests = rateLimits.get(ip).filter(time => time > windowStart);
  rateLimits.set(ip, requests);
  
  if (requests.length >= 5) { // Reduced limit for proxy
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

// Parse hlsforge URL to extract m3u8
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

// Detect language from button text
function detectLanguage(text) {
  const textLower = text.toLowerCase();
  if (textLower.includes('english')) return 'English';
  if (textLower.includes('hindi')) return 'Hindi';
  if (textLower.includes('japanese')) return 'Japanese';
  if (textLower.includes('chinese')) return 'Chinese';
  if (textLower.includes('spanish')) return 'Spanish';
  return 'Unknown';
}

// Extract AsiaCloud buttons from HTML using multiple methods
function extractAsiaCloudButtons(html) {
  const buttons = [];
  
  console.log('🔍 Extracting AsiaCloud buttons from HTML...');
  
  // Method 1: Direct class matching (most reliable)
  const classRegex = /<a\s+[^>]*class\s*=\s*["'][^"']*Download_sourceLink__BTn4l[^"']*["'][^>]*href\s*=\s*["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  let match;
  
  while ((match = classRegex.exec(html)) !== null) {
    buttons.push({
      href: match[1],
      text: match[2].trim(),
      method: 'class_direct'
    });
    console.log(`✅ Found button with class: ${match[2]}`);
  }
  
  // Method 2: Look for hlsforge.com in any anchor tag
  const hlsforgeRegex = /<a\s+[^>]*href\s*=\s*["']([^"']*hlsforge\.com[^"']*)["'][^>]*>([^<]*)<\/a>/gi;
  
  while ((match = hlsforgeRegex.exec(html)) !== null) {
    if (!buttons.some(btn => btn.href === match[1])) {
      buttons.push({
        href: match[1],
        text: match[2].trim(),
        method: 'hlsforge_url'
      });
      console.log(`✅ Found hlsforge link: ${match[2]}`);
    }
  }
  
  // Method 3: Look for AsiaCloud text content
  const asiacloudTextRegex = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>\s*([^<]*AsiaCloud[^<]*)\s*<\/a>/gi;
  
  while ((match = asiacloudTextRegex.exec(html)) !== null) {
    if (!buttons.some(btn => btn.href === match[1])) {
      buttons.push({
        href: match[1],
        text: match[2].trim(),
        method: 'asiacloud_text'
      });
      console.log(`✅ Found AsiaCloud text: ${match[2]}`);
    }
  }
  
  // Method 4: More flexible class matching
  const flexibleClassRegex = /<a\s+[^>]*class\s*=\s*["'][^"']*Download[^"']*["'][^>]*href\s*=\s*["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  
  while ((match = flexibleClassRegex.exec(html)) !== null) {
    if (!buttons.some(btn => btn.href === match[1])) {
      buttons.push({
        href: match[1],
        text: match[2].trim(),
        method: 'flexible_class'
      });
      console.log(`✅ Found flexible class: ${match[2]}`);
    }
  }
  
  console.log(`📊 Total buttons found: ${buttons.length}`);
  return buttons;
}

// Use a proxy service to get JavaScript-rendered content
async function fetchWithProxy(targetUrl) {
  try {
    console.log(`🌐 Fetching with proxy: ${targetUrl}`);
    
    // Try multiple proxy services (free tiers)
    const proxyServices = [
      `https://api.crawlbase.com/?token=free&url=${encodeURIComponent(targetUrl)}&wait=5000`,
      `https://r.jina.ai/${encodeURIComponent(targetUrl)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`
    ];
    
    for (const proxyUrl of proxyServices) {
      try {
        console.log(`🔄 Trying proxy: ${proxyUrl.split('/')[2]}`);
        const response = await fetch(proxyUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          timeout: 15000
        });
        
        if (response.ok) {
          const html = await response.text();
          console.log(`✅ Proxy success: ${proxyUrl.split('/')[2]}`);
          return html;
        }
      } catch (error) {
        console.log(`❌ Proxy failed: ${error.message}`);
        continue;
      }
    }
    
    // Fallback: Direct fetch (might not work for JS sites)
    console.log('🔄 Falling back to direct fetch...');
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Direct fetch failed: HTTP ${response.status}`);
    }
    
    return await response.text();
    
  } catch (error) {
    throw new Error(`All proxy methods failed: ${error.message}`);
  }
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
      success: false,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.'
    });
    return;
  }

  // Set response headers
  res.setHeader('Content-Type', 'application/json');

  try {
    // Parse request parameters
    const { url } = req.method === 'POST' 
      ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body)
      : req.query;

    // Validate URL
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL parameter is required',
        example: '/api/scrape?url=https://rivestream.org/download?type=tv&id=60574'
      });
    }

    // Validate URL format
    let targetUrl;
    try {
      targetUrl = new URL(url);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format',
        message: 'Please provide a valid URL including http:// or https://'
      });
    }

    console.log(`🚀 Starting scrape for: ${targetUrl.href}`);
    
    // Fetch the page with proxy
    const html = await fetchWithProxy(targetUrl.href);
    
    // Extract AsiaCloud buttons from HTML
    const buttons = extractAsiaCloudButtons(html);
    
    if (buttons.length === 0) {
      console.log('🔍 No AsiaCloud buttons found, analyzing HTML structure...');
      
      // Debug: Return sample of HTML to help with debugging
      const sampleHtml = html.substring(0, 2000);
      return res.status(404).json({
        success: false,
        error: 'No AsiaCloud buttons found',
        debug: {
          htmlSample: sampleHtml,
          htmlLength: html.length,
          containsHlsforge: html.includes('hlsforge'),
          containsDownload: html.includes('Download'),
          containsAsiaCloud: html.includes('AsiaCloud')
        },
        tips: [
          'The page might require JavaScript rendering',
          'Try using a different proxy service',
          'Check if the URL is correct and accessible'
        ]
      });
    }
    
    // Process results
    const results = buttons.map((button, index) => {
      const urlInfo = parseHlsForgeUrl(button.href);
      
      return {
        index: index + 1,
        buttonText: button.text,
        language: detectLanguage(button.text),
        hlsforgeUrl: button.href,
        ...urlInfo,
        detectionMethod: button.method,
        timestamp: new Date().toISOString()
      };
    });

    // Filter out invalid results
    const validResults = results.filter(result => result.m3u8Url);

    console.log(`✅ Scraping completed: ${validResults.length} valid buttons found`);

    // Send success response
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
          }, {}),
          detectionMethods: validResults.reduce((acc, result) => {
            acc[result.detectionMethod] = (acc[result.detectionMethod] || 0) + 1;
            return acc;
          }, {})
        },
        metadata: {
          timestamp: new Date().toISOString(),
          userAgent: req.headers['user-agent'],
          ip: ip,
          note: 'Using proxy service for JavaScript rendering'
        }
      }
    });

  } catch (error) {
    console.error('❌ API Error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Scraping failed',
      message: error.message,
      tips: [
        'The site might be blocking automated requests',
        'Try the URL in your browser to verify it works',
        'Some sites require JavaScript which limits scraping capabilities'
      ]
    });
  }
};
