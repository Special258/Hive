const crypto = require('crypto');

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const rateLimits = new Map(); // key -> { count, resetTime }

// Basic cleanup to prevent memory leak
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimits.entries()) {
        if (now > record.resetTime) {
            rateLimits.delete(key);
        }
    }
}, RATE_LIMIT_WINDOW);

function rateLimit(key, limit = 100) {
  const now = Date.now();
  let record = rateLimits.get(key);
  
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + RATE_LIMIT_WINDOW };
    rateLimits.set(key, record);
    return true; // allowed
  }
  
  record.count += 1;
  return record.count <= limit;
}

function sanitizeHtml(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[&<>"']/g, function(m) {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#039;';
      default: return m;
    }
  });
}

function getSecurityHeaders(origin, configuredOrigin) {
  // Avoid '*' in production if configuredOrigin is set and not '*'
  let allowedOrigin = configuredOrigin;
  if (configuredOrigin && configuredOrigin !== '*' && origin !== configuredOrigin) {
      // For strict CORS, if the request origin doesn't match the configured origin, we can deny or just return configuredOrigin
      // Returning configuredOrigin will cause browser to block it if it doesn't match.
      allowedOrigin = configuredOrigin;
  }
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Email, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; connect-src 'self' ws: wss: http://localhost:* ws://localhost:*; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; script-src 'self' 'unsafe-inline';",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  };
}

module.exports = { rateLimit, sanitizeHtml, getSecurityHeaders };
