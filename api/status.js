module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  res.status(200).json({
    status: 'operational',
    service: 'AsiaCloud Scraper API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      '/api/scrape': 'Scrape AsiaCloud buttons from a URL',
      '/api/status': 'Check API status',
      '/api/health': 'Health check'
    },
    usage: {
      example: '/api/scrape?url=https://example.com&waitTime=5000',
      parameters: {
        url: 'Required - The URL to scrape',
        waitTime: 'Optional - Wait time in milliseconds (default: 5000)'
      }
    }
  });
};
