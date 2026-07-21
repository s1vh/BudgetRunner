import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

let authInstance: Auth | null = null

export function firebaseAuth() {
  if (authInstance) return authInstance
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  }
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    throw new Error('Firebase Auth no está configurado para este despliegue.')
  }
  const app = getApps().length ? getApp() : initializeApp(config)
  authInstance = getAuth(app)
  return authInstance
}

export async function firebaseIdToken(forceRefresh = false) {
  return firebaseAuth().currentUser?.getIdToken(forceRefresh) ?? null
}
