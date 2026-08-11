export function validateEnv(config: Record<string, unknown>) {
  const required = ['MONGODB_URI', 'REDIS_HOST', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = required.filter((key) => !config[key]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  if (String(config.JWT_SECRET).length < 32 || String(config.JWT_REFRESH_SECRET).length < 32) throw new Error('JWT secrets must contain at least 32 characters');
  return config;
}
