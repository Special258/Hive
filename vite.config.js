const { defineConfig } = require('vite');
const path = require('path');

module.exports = defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  },
  build: {
    rollupOptions: {
      input: [
        'index.html',
        'dashboard.html',
        'sessions.html',
        'skills.html',
        'admin.html',
        'admin-users.html',
        'admin-sessions.html',
        'room.html',
        'subscription.html',
        'skill-matching.html',
        'analytics.html'
      ].map(file => path.resolve(__dirname, file))
    }
  }
});
