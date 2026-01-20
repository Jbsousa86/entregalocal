import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseClient';

export default function LoginScreen({ onLogin, onRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');

    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true);
    try {
      console.log("1. Iniciando autenticação...");
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("2. Autenticação OK. UID:", user.uid);

      // Verificar se é estabelecimento
      console.log("3. Buscando perfil de estabelecimento...");
      const estDoc = await getDoc(doc(db, 'establishments', user.uid));
      if (estDoc.exists()) {
        const estData = estDoc.data();
        if (estData.isBlocked) {
          await auth.signOut();
          setError('Sua conta está suspensa. Entre em contato com o suporte.');
          setLoading(false);
          return;
        }
        console.log("4. Perfil Estabelecimento encontrado.");
        onLogin('establishment');
        return;
      }

      // Verificar se é entregador
      console.log("3. Buscando perfil de entregador...");
      const courierDoc = await getDoc(doc(db, 'couriers', user.uid));
      if (courierDoc.exists()) {
        const courierData = courierDoc.data();
        if (courierData.isBlocked) {
          await auth.signOut();
          setError('Sua conta está suspensa. Entre em contato com o suporte.');
          setLoading(false);
          return;
        }
        console.log("4. Perfil Entregador encontrado.");
        onLogin('courier');
        return;
      }

      // Se chegou aqui, o usuário existe no Auth mas não tem doc no Firestore
      setError('Login realizado, mas o perfil não foi encontrado. Tente criar uma nova conta com outro email.');

    } catch (err) {
      console.error("Erro Login:", err);
      // Tratamento de erros comuns
      let errorMessage = 'Erro ao fazer login.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        errorMessage = 'Email ou senha incorretos.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Email inválido.';
      } else {
        errorMessage += ' ' + err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen card fade-in">
      <h2 className="text-center mb-6">Bem-vindo</h2>
      <p className="text-center mb-6">Faça login para continuar</p>

      {error && <div className="error-message">{error}</div>}

      <div className="form-group">
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: 'var(--text-muted)' }}>Email</label>
        <input
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: 'var(--text-muted)' }}>Senha</label>
        <input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <button onClick={handleLogin} disabled={loading} className="mb-4">
        {loading ? 'Entrando...' : 'Entrar'}
      </button>

      <p className="text-center" style={{ fontSize: '14px' }}>
        Não tem uma conta?{' '}
        <span className="link" onClick={onRegister}>
          Criar conta agora
        </span>
      </p>
    </div>
  );
}
