import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_KEY = join(__dirname, '..', 'serviceAccountKey.json');
const KEY_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_FILE || DEFAULT_KEY;
const SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT;
const CONFIG_PATH = process.env.FIREBASE_CONFIG || join(__dirname, '..', 'firebaseConfig.json');

function clientConfig() {
  if (existsSync(CONFIG_PATH)) return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  return null;
}

function buildApp() {
  if (SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(SERVICE_ACCOUNT_JSON);
    return initializeApp({ credential: cert(serviceAccount) });
  }
  if (existsSync(KEY_PATH)) {
    const serviceAccount = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
    return initializeApp({ credential: cert(serviceAccount) });
  }
  if (process.env.FIREBASE_PROJECT_ID || clientConfig()?.projectId) {
    return initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || clientConfig().projectId });
  }
  throw new Error(
    'No se encontraron credenciales de Firebase. Define FIREBASE_SERVICE_ACCOUNT ' +
      '(JSON de la cuenta de servicio) o coloca backend/serviceAccountKey.json.'
  );
}

let app;
if (getApps().length === 0) app = buildApp();
else app = getApps()[0];

export const firestore = getFirestore(app);
export const ts = () => new Date().toISOString();
export const autoId = () =>
  firestore.autoId ? firestore.autoId() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;