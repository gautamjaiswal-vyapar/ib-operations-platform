import type { NextConfig } from 'next';
import path from 'path';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? '';
const projectSite = repository && !repository.endsWith('.github.io');
const basePath = process.env.GITHUB_ACTIONS === 'true' && projectSite ? `/${repository}` : '';

const config: NextConfig = {
  output: 'export',
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  basePath,
  assetPrefix: basePath,
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
  trailingSlash: true
};

export default config;
