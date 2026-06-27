module.exports = {
  apps: [
    {
      name: "fitpick",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "fitpick-worker",
      script: "npm",
      args: "run worker",
      env: {
        NODE_ENV: "production"
      },
      max_memory_restart: "512M"
    }
  ]
};
