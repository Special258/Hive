const { defineConfig } = require('vite');
const path = require('path');
module.exports = defineConfig({ build: { rollupOptions: { input: ['index.html', 'dashboard.html', 'sessions.html', 'admin.html', 'admin-users.html', 'admin-sessions.html', 'room.html', 'subscription.html'].map(file => path.resolve(__dirname, file)) } } });
