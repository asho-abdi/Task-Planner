export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  databaseUrl: process.env.DATABASE_URL,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: '15m',
    refreshExpiresIn: '7d',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? '',
  },
  workloadHoursPerDay: parseWorkloadHoursPerDay(
    process.env.WORKLOAD_HOURS_PER_DAY,
  ),
  ai: {
    apiKey: process.env.AI_API_KEY ?? '',
    baseUrl: process.env.AI_BASE_URL ?? 'https://api.openai.com/v1',
    model: process.env.AI_MODEL ?? 'gpt-4o-mini',
    timeoutMs: parseAiTimeoutMs(process.env.AI_TIMEOUT_MS),
  },
});

export function parseWorkloadHoursPerDay(raw: string | undefined): number {
  const parsed = Number(raw ?? '8');
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 8;
  }
  return parsed;
}

export function parseAiTimeoutMs(raw: string | undefined): number {
  const parsed = Number(raw ?? '15000');
  if (!Number.isFinite(parsed) || parsed < 1000) {
    return 15000;
  }
  return Math.min(parsed, 60000);
}
