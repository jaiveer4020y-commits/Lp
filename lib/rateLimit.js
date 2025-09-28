const { RateLimiterMemory } = require('rate-limiter-flexible');

const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.headers['x-forwarded-for'] || 'anonymous',
  points: 10, // Number of requests
  duration: 60, // Per 60 seconds
});

module.exports = async (req, res) => {
  try {
    await rateLimiter.consume(req.ip);
    return null; // No error, continue
  } catch (rejRes) {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(rejRes.msBeforeNext / 1000)
    });
    return true; // Error occurred
  }
};
