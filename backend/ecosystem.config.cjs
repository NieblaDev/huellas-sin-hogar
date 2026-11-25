module.exports = {
  apps: [{
    name: 'huellas-api',
    cwd: __dirname,
    script: './src/server.js',
    env: { NODE_ENV: 'production', PORT: '80' }
  }]
};
