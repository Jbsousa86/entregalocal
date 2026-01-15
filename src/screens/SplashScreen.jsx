import React from 'react';
import heroImage from '../assets/image.png';

export default function SplashScreen({ onLogin, onRegister }) {
  return (
    <div className="splash-screen card fade-in text-center" style={{ padding: '40px 32px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
        <img
          src={heroImage}
          alt="EntregaLocal"
          style={{
            width: '180px',
            height: '180px',
            objectFit: 'cover',
            borderRadius: '50%',
            boxShadow: 'var(--shadow-lg)',
            border: '4px solid var(--primary-light)'
          }}
        />
      </div>

      <h1 style={{ color: 'var(--primary)', fontSize: '2.5rem', marginBottom: '8px', fontWeight: '800' }}>EntregaLocal</h1>
      <p className="mb-8" style={{ fontSize: '1.1rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
        A solução inteligente para suas entregas locais.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <button onClick={onLogin} style={{ padding: '16px', fontSize: '1.1rem' }}>
          Entrar na Conta
        </button>

        <button
          onClick={onRegister}
          style={{
            backgroundColor: 'transparent',
            color: 'var(--primary)',
            border: '2px solid var(--primary)',
            padding: '16px',
            fontSize: '1.1rem',
            boxShadow: 'none'
          }}
        >
          Criar Nova Conta
        </button>
      </div>
    </div>
  );
}
