import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

// https://vite.dev/config/
const ENV_KEYS_TO_EXPOSE = [
  'NODE_ENV',
  'API_URL',
  'CDK_DEFAULT_REGION',
  'CDK_DEFAULT_ACCOUNT',
  'REACT_APP_JBROWSE_AGR_RELEASE',
];

const PROXY_PATHS = ['/api', '/jbrowse', '/bluegenes', '/swagger-ui', '/openapi', '/agr_simplemine.cgi', '/pavi'];

// The member databases publish anatomy data the Alliance has no endpoint for,
// but none of them send `access-control-allow-origin`, so the browser cannot
// read them directly. Proxy them in development so those sections can be built
// and reviewed against live member data; where the proxy is absent the fetch
// fails and the section hides itself.
const MOD_PROXY_TARGETS = {
  '/mod/zfin': 'https://zfin.org',
};

const proxy = {
  ...Object.fromEntries(
    PROXY_PATHS.map((path) => [
      path,
      {
        target: process.env.API_URL || 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    ])
  ),
  ...Object.fromEntries(
    Object.entries(MOD_PROXY_TARGETS).map(([path, target]) => [
      path,
      {
        target,
        changeOrigin: true,
        secure: false,
        rewrite: (url: string) => url.replace(new RegExp(`^${path}`), ''),
      },
    ])
  ),
};

// Reaching the dev server from anywhere but localhost is opt-in, so that a
// plain `npm start` behaves the same on a machine that has none of this set up:
//
//   DEV_ALLOWED_HOSTS=host[,host]      bind every interface, accept those hosts
//   DEV_HTTPS_KEY=/path/privkey.pem    serve over TLS rather than plain HTTP
//   DEV_HTTPS_CERT=/path/fullchain.pem
//
// Vite refuses a request whose Host header it does not recognise, so a public
// hostname has to be named rather than inferred. Useful for showing a branch to
// someone, and required for anything the browser gates behind a secure context.
const allowedHosts = (process.env.DEV_ALLOWED_HOSTS || '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

// Read up front, so a wrong path fails here naming the variable that carried it
// instead of as a bare ENOENT from inside server startup.
const readPem = (envKey: string) => {
  const path = process.env[envKey];
  if (!path) {
    return undefined;
  }
  if (!fs.existsSync(path)) {
    throw new Error(`${envKey} is set to ${path}, which does not exist`);
  }
  return fs.readFileSync(path);
};

const httpsKey = readPem('DEV_HTTPS_KEY');
const httpsCert = readPem('DEV_HTTPS_CERT');
if (!httpsKey !== !httpsCert) {
  throw new Error('DEV_HTTPS_KEY and DEV_HTTPS_CERT have to be set together');
}
const https = httpsKey && httpsCert ? { key: httpsKey, cert: httpsCert } : undefined;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    build: {
      outDir: 'build',
      manifest: 'asset-manifest.json',
    },
    define: Object.fromEntries(ENV_KEYS_TO_EXPOSE.map((key) => [`process.env.${key}`, JSON.stringify(env[key])])),
    server: {
      port: 3000,
      // Spread rather than set, so an unconfigured dev server is left with
      // vite's defaults instead of an explicit `host: false` / `https: undefined`.
      ...(allowedHosts.length ? { host: true, allowedHosts } : {}),
      ...(https ? { https } : {}),
      proxy,
    },
    preview: {
      proxy,
    },
    resolve: {
      alias: [
        {
          // this is required for the SCSS modules
          find: /^~(.*)$/,
          replacement: '$1',
        },
      ],
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
          silenceDeprecations: ['color-functions', 'global-builtin', 'import', 'abs-percent'],
        },
      },
    },
    plugins: [react()],
  };
});
