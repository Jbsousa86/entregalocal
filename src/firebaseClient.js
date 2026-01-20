// Configuração do Firebase para uso no app EntregaLocal
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey) {
  console.error("ERRO CRÍTICO: A chave de API do Firebase não foi encontrada.");
  console.error("Verifique se você criou o arquivo .env na raiz do projeto com as credenciais VITE_FIREBASE_...");
  console.error("Se acabou de criar o arquivo, reinicie o servidor (npm run dev).");
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const messaging = getMessaging(app);

// Ativar persistência offline (importante para mobile)
import { enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
enableMultiTabIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn("Persistência falhou: múltiplas abas abertas.");
  } else if (err.code === 'unimplemented') {
    console.warn("O navegador não suporta persistência.");
  }
});

export { getToken, onMessage };
