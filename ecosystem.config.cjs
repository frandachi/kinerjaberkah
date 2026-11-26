module.exports = {
  apps: [
    {
      name: 'kinerjaberkah',
      cwd: '/home/services/kinerjaberkah/server',
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      min_uptime: '10s',
      listen_timeout: 10000,
      kill_timeout: 5000,
      exp_backoff_restart_delay: 2000,
      max_restarts: 15,
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/home/services/kinerjaberkah/server/logs/pm2-error.log',
      out_file: '/home/services/kinerjaberkah/server/logs/pm2-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
