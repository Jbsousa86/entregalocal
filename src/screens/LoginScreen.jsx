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
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const estDoc = await getDoc(doc(db, 'establishments', user.uid));
      if (estDoc.exists()) {
        const estData = estDoc.data();
        if (estData.isBlocked) {
          await auth.signOut();
          setError('Sua conta está suspensa. Entre em contato com o suporte.');
          setLoading(false);
          return;
        }
        onLogin('establishment');
        return;
      }

      const courierDoc = await getDoc(doc(db, 'couriers', user.uid));
      if (courierDoc.exists()) {
        const courierData = courierDoc.data();
        if (courierData.isBlocked) {
          await auth.signOut();
          setError('Sua conta está suspensa. Entre em contato com o suporte.');
          setLoading(false);
          return;
        }
        onLogin('courier');
        return;
      }

      setError('Login realizado, mas o perfil não foi encontrado.');

    } catch (err) {
      console.error("Erro Login:", err);
      let errorMessage = 'Email ou senha incorretos.';
      if (err.code === 'auth/invalid-email') {
        errorMessage = 'Email inválido.';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen fade-in" style={{ padding: '40px 20px', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div className="card" style={{ padding: '40px 30px' }}>
        <div className="card-header">
          <div style={{ 
            width: '80px', 
            height: '80px', 
            backgroundColor: 'var(--primary-light)', 
            borderRadius: '24px', 
            margin: '0 auto 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary)'
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '8px' }}>Bem-vindo de volta</h2>
          <p style={{ color: 'var(--text-muted)' }}>Faça login para gerenciar suas entregas</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="form-group">
          <label>Email</label>
          <div style={{ position: 'relative' }}>
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ paddingLeft: '48px' }}
            />
            <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label>Senha</label>
          <div style={{ position: 'relative' }}>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingLeft: '48px' }}
            />
            <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
          </div>
        </div>

        <button 
          onClick={handleLogin} 
          disabled={loading} 
          className="btn"
          style={{ marginTop: '12px', height: '60px' }}
        >
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }}></div>
              Entrando...
            </div>
          ) : 'Entrar na Conta'}
        </button>

        <p className="text-center" style={{ marginTop: '30px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Ainda não tem acesso?{' '}
          <button 
            className="link" 
            onClick={onRegister}
            style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--primary)', fontWeight: '700', cursor: 'pointer' }}
          >
            Cadastre-se agora
          </button>
        </p>
      </div>
      
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

