module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  res.status(200).json({
    status: 'operational',
    service: 'AsiaCloud Scraper API',
    version: '2.0.0',
    nodeVersion: '22.x',
    timestamp: new Date().toISOString(),
    endpoints: {
      '/api/scrape': 'Scrape AsiaCloud buttons from a URL',
      '/api/status': 'Check API status',
      '/api/health': 'Health check'
    },
    usage: {
      example: '/api/scrape?url=https://example.com',
      parameters: {
        url: 'Required - The URL to scrape',
        waitTime: 'Optional - Wait time in milliseconds (default: 2000)'
      }
    },
    note: 'This API uses pure Node.js fetch - no browser automation'
  });
};
