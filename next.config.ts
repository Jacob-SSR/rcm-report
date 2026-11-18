import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

const config = (phase: string): NextConfig => ({
  ...(phase === PHASE_DEVELOPMENT_SERVER ? {} : { output: 'export' }),
  trailingSlash: true,
  images: { unoptimized: true },
});
export default config;
