export function GET() {
  const lines = [
    "# HELP app_up Whether the application is serving metrics",
    "# TYPE app_up gauge",
    "app_up 1",
    "# HELP process_uptime_seconds Process uptime in seconds",
    "# TYPE process_uptime_seconds gauge",
    `process_uptime_seconds ${process.uptime().toFixed(3)}`,
    "# HELP app_info Application metadata",
    "# TYPE app_info gauge",
    `app_info{version="${process.env.npm_package_version ?? "dev"}",node_env="${process.env.NODE_ENV ?? "development"}"} 1`,
  ];

  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    },
  });
}
