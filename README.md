## Configuração do Firebase

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/).
2. No painel do Firebase, acesse Configurações do Projeto > Suas credenciais Web.
3. Crie um arquivo `.env` na raiz do projeto com:

```
VITE_FIREBASE_API_KEY=xxxx
VITE_FIREBASE_AUTH_DOMAIN=xxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=xxxx
VITE_FIREBASE_STORAGE_BUCKET=xxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=xxxx
VITE_FIREBASE_APP_ID=xxxx
```

4. O arquivo `src/firebaseClient.js` já está pronto para conectar ao Firebase Auth e Firestore.

Consulte a [documentação oficial do Firebase](https://firebase.google.com/docs/web/setup) para exemplos de autenticação, banco de dados e storage.
# React + Vite
## Configuração do Supabase

1. Crie um projeto no [Supabase](https://supabase.com/).
2. No painel do Supabase, copie a URL do projeto e a chave pública (anon key).
3. Crie um arquivo `.env` na raiz do projeto com:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxx
```

4. O arquivo `src/supabaseClient.js` já está pronto para conectar ao Supabase.

Consulte a [documentação oficial do Supabase](https://supabase.com/docs) para exemplos de autenticação, banco de dados e storage.

## Como rodar na rede local (Celular)

Para acessar o app pelo celular na mesma rede Wi-Fi:

1. Abra o arquivo `package.json`.
2. Localize a linha `"dev": "vite"`.
3. Mude para `"dev": "vite --host"`.
4. Reinicie o servidor (`npm run dev`).
5. O terminal mostrará um endereço como `http://192.168.x.x:5173`. Use esse endereço no navegador do celular.



