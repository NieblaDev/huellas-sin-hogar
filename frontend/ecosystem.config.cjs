module.exports = {
  apps: [{
    name: 'huellas-web',
    cwd: __dirname,
    script: './node_modules/vite/bin/vite.js',
    args: ['preview', '--host', process.env.PREVIEW_HOST || '0.0.0.0', '--port', '443', '--strictPort'],
    env: { NODE_ENV: 'production' }
  }]
};
