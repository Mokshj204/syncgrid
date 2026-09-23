import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Potential .env locations (local backend-node or project root)
const envPaths = [
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '../.env'),
];

let loadedEnvPath = null;

// Search and load the first existing .env file
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    loadedEnvPath = p;
    break;
  }
}

// Required variables schema for backend-node
const REQUIRED_NODE_VARS = [
  {
    key: 'DATABASE_URL',
    description: 'PostgreSQL connection URL (remote or local)',
    example: 'postgresql://postgres:password@host:5432/dbname?sslmode=disable',
    validate: (val) => {
      if (!val || typeof val !== 'string' || !val.trim()) return 'Value cannot be empty.';
      const lower = val.trim().toLowerCase();
      if (!lower.startsWith('postgres://') && !lower.startsWith('postgresql://')) {
        return 'Must begin with postgresql:// or postgres://';
      }
      return null;
    },
  },
  {
    key: 'NODE_PORT',
    description: 'Port for Node.js Express & Socket.IO server',
    example: '5000',
    validate: (val) => {
      const port = parseInt(val, 10);
      if (isNaN(port) || port <= 0 || port > 65535) {
        return 'Must be a valid TCP port number between 1 and 65535.';
      }
      return null;
    },
  },
  {
    key: 'NODE_HOST',
    description: 'Bind address for Node.js server',
    example: '0.0.0.0',
    validate: (val) => (!val || !val.trim() ? 'Value cannot be empty.' : null),
  },
  {
    key: 'PYTHON_SERVICE_URL',
    description: 'URL of the Python Sheets engine service',
    example: 'http://localhost:8000',
    validate: (val) => {
      if (!val || !val.trim()) return 'Value cannot be empty.';
      try {
        new URL(val.trim());
        return null;
      } catch {
        return 'Must be a valid HTTP or HTTPS URL (e.g., http://localhost:8000).';
      }
    },
  },
  {
    key: 'WEBHOOK_SECRET',
    description: 'Shared secret token for webhook & internal sync events',
    example: 'sync_secret_token_123',
    validate: (val) => (!val || !val.trim() ? 'Value cannot be empty.' : null),
  },
  {
    key: 'CORS_ORIGIN',
    description: 'Allowed CORS origin(s) for HTTP and WebSocket requests',
    example: '*',
    validate: (val) => (!val || !val.trim() ? 'Value cannot be empty.' : null),
  },
];

/**
 * Validates that all required environment variables exist in the .env file.
 * Exits immediately if any required variable is missing or invalid.
 */
export function validateNodeEnv() {
  const missingOrInvalid = [];

  if (!loadedEnvPath) {
    console.error('\n=============================================================');
    console.error('❌ [EnvLoader] STARTUP ABORTED: Missing .env File');
    console.error('=============================================================');
    console.error('Could not find a .env file in:');
    envPaths.forEach((p) => console.error(`  - ${p}`));
    console.error('\nPlease copy .env.example to .env and configure the required variables.\n');
    process.exit(1);
  }

  for (const schema of REQUIRED_NODE_VARS) {
    const rawVal = process.env[schema.key];
    if (rawVal === undefined || rawVal === null || rawVal === '') {
      missingOrInvalid.push({
        key: schema.key,
        reason: 'Missing or empty variable in .env',
        example: schema.example,
        description: schema.description,
      });
      continue;
    }

    const validationError = schema.validate(rawVal);
    if (validationError) {
      missingOrInvalid.push({
        key: schema.key,
        reason: validationError,
        example: schema.example,
        description: schema.description,
      });
    }
  }

  if (missingOrInvalid.length > 0) {
    console.error('\n=============================================================');
    console.error('❌ [EnvLoader] Node.js Service Startup Aborted');
    console.error('=============================================================');
    console.error(`Source: ${loadedEnvPath}`);
    console.error('The following required environment variables are missing or invalid:\n');

    missingOrInvalid.forEach((item, idx) => {
      console.error(`  ${idx + 1}. [${item.key}]`);
      console.error(`     Error:       ${item.reason}`);
      console.error(`     Description: ${item.description}`);
      console.error(`     Example:     ${item.key}=${item.example}\n`);
    });

    console.error('Please update your .env file before starting the Node.js service.');
    console.error('=============================================================\n');
    process.exit(1);
  }

  console.log(`[EnvLoader] ✅ Node.js environment variables verified from ${path.basename(loadedEnvPath)}`);
  return {
    databaseUrl: process.env.DATABASE_URL,
    port: parseInt(process.env.NODE_PORT, 10),
    host: process.env.NODE_HOST,
    pythonServiceUrl: process.env.PYTHON_SERVICE_URL,
    webhookSecret: process.env.WEBHOOK_SECRET,
    corsOrigin: process.env.CORS_ORIGIN,
    typesafeApiKey: process.env.TYPESAFE_API_KEY || '',
  };
}

// Run validation immediately upon module import
export const env = validateNodeEnv();
