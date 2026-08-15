module.exports = {
  apps: [{
    name: 'hive-api',
    script: 'server.js',
    instances: 1, // Single instance to support in-memory rate limiting and stateful Socket.io
    exec_mode: 'fork', // DO NOT use cluster until rate limits/sockets are distributed
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
