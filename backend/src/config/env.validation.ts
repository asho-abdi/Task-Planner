function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function validateEnv(): void {
  requireEnv('DATABASE_URL');
  requireEnv('JWT_ACCESS_SECRET');
  requireEnv('JWT_REFRESH_SECRET');
  requireEnv('CORS_ORIGIN');
  requireEnv('FRONTEND_URL');
}
