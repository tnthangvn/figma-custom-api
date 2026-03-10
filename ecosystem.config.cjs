module.exports = {
  apps: [
    {
      name: "custom-mcp-api",
      script: "dist/index.js",
      interpreter: "node",
      cwd: "/var/www/free-time/mcp/figma-mcp",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "4G",
      env_production: {
        NODE_ENV: "production",
        MCP_TRANSPORT: "http",
        PORT: "3006"
      }
    }
  ]
};
