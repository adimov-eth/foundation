module.exports = {
  apps: [{
    name: 'vessel',
    script: 'bun',
    args: 'run src/http-local.ts',
    cwd: '/Users/adimov/AGI/packages/mcp-server',
    interpreter: 'none',
    env: {
      PORT: 1337,
      NODE_ENV: 'development',
      DEV_MODE: 'true'
    },
    watch: false,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    error_file: './logs/vessel-error.log',
    out_file: './logs/vessel-out.log',
    log_file: './logs/vessel-combined.log',
    time: true
  }]
};