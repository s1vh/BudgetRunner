import { onRequest } from 'firebase-functions/v2/https'
import { createApp } from './app.js'

export const api = onRequest({
  region: 'europe-west1',
  memory: '512MiB',
  timeoutSeconds: 60,
  minInstances: 0,
  maxInstances: 5,
  concurrency: 40,
}, createApp())
