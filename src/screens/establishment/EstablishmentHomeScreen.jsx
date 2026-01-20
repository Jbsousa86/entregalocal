import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseClient';
import backgroundImage from '../../assets/image.png';

export default function EstablishmentHomeScreen() {
  const [profile, setProfile] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docRef = doc(db, 'establishments', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data());
        }
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <div
      className="establishment-home-screen card fade-in"
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '0' // Remove padding to let background fill
      }}
    >
      {/* Background Image Container - Full primary area */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '220px',
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        zIndex: 0
      }}>
        {/* Professional Gradient Overlay (Emerald tint) */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(to bottom, rgba(5, 150, 105, 0.4), var(--surface) 90%)'
        }} />
      </div>

      {/* Content Container */}
      <div style={{ position: 'relative', zIndex: 1, padding: '40px 32px 32px' }}>
        {/* Profile Section on Header */}
        <div className="text-center mb-6">
          <div style={{
            width: '110px',
            height: '110px',
            borderRadius: '50%',
            backgroundColor: 'var(--background)',
            margin: '0 auto 16px',
            border: '4px solid var(--surface)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}>
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '32px' }}>🏪</span>
            )}
          </div>
          <h2 style={{
            color: 'var(--secondary)',
            textShadow: '0 1px 2px rgba(0,0,0,0.1)',
            marginBottom: '4px',
            fontWeight: '800'
          }}>
            {profile?.name || 'Painel do Estabelecimento'}
          </h2>
          {profile?.type && (
            <p style={{
              color: 'var(--primary)',
              fontWeight: '600',
              fontSize: '14px',
              marginBottom: '8px'
            }}>
              📍 {profile.type}
            </p>
          )}
          {profile?.name && (
            <p style={{
              color: 'var(--primary)',
              fontWeight: '600',
              fontSize: '15px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              ESTABELECIMENTO
            </p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button onClick={() => navigate('/establishment/create-delivery')}>
            ✨ Nova Entrega
          </button>

          <button onClick={() => navigate('/establishment/in-progress')} style={{ backgroundColor: 'var(--secondary)' }}>
            🕒 Entregas em Andamento
          </button>

          <button onClick={() => navigate('/establishment/history')} style={{ backgroundColor: 'var(--text-muted)' }}>
            📜 Histórico de Pedidos
          </button>

          <button
            onClick={() => navigate('/establishment/profile')}
            style={{
              backgroundColor: 'transparent',
              color: 'var(--primary)',
              border: '2px solid var(--primary)',
              boxShadow: 'none'
            }}
          >
            👤 Meu Perfil
          </button>
        </div>
      </div>
    </div>
  );
}
