import React from 'react';
import heroImage from '../assets/image.png';

export default function SplashScreen({ onLogin, onRegister }) {
  return (
    <div className="splash-screen fade-in" style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      padding: '40px 24px',
      background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--secondary-hover) 100%)',
      color: 'white'
    }}>
      <div style={{ 
        textAlign: 'center',
        padding: '20px',
        zIndex: 1
      }}>
        <div style={{ 
          width: '200px', 
          height: '200px', 
          margin: '0 auto 40px',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            top: '-10%', left: '-10%', right: '-10%', bottom: '-10%',
            background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)',
            opacity: 0.4,
            borderRadius: '50%'
          }}></div>
          <img
            src={heroImage}
            alt="EntregaLocal"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '60px',
              boxShadow: 'var(--shadow-xl)',
              border: '4px solid rgba(255,255,255,0.2)',
              position: 'relative',
              zIndex: 2,
              transform: 'rotate(-5deg)'
            }}
          />
        </div>

        <h1 style={{ color: 'white', fontSize: '3rem', marginBottom: '12px', fontWeight: '800', letterSpacing: '-1px' }}>
          Entrega<span style={{ color: 'var(--primary)' }}>Local</span>
        </h1>
        <p style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6', maxWidth: '300px', margin: '0 auto 60px' }}>
          A solução inteligente e profissional para suas entregas locais.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <button 
            className="btn" 
            onClick={onLogin} 
            style={{ height: '64px', fontSize: '1.1rem', background: 'white', color: 'var(--secondary-hover)' }}
          >
            Entrar na Conta
          </button>

          <button
            className="btn btn-outline"
            onClick={onRegister}
            style={{ height: '64px', fontSize: '1.1rem', color: 'white', borderColor: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.1)' }}
          >
            Começar Agora
          </button>
        </div>
      </div>
      
      <div style={{ 
        position: 'fixed', 
        bottom: '20px', 
        left: 0, 
        right: 0, 
        textAlign: 'center', 
        fontSize: '0.8rem', 
        color: 'rgba(255,255,255,0.3)',
        letterSpacing: '2px'
      }}>
        CONECTANDO NEGÓCIOS LOCAIS
      </div>
    </div>
  );
}

