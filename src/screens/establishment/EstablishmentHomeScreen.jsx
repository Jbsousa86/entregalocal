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
      } else {
        navigate('/establishment/login');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const ActionButton = ({ onClick, icon, label, sublabel, variant = 'primary' }) => (
    <button 
      onClick={onClick} 
      className={`btn ${variant === 'secondary' ? 'btn-secondary' : variant === 'outline' ? 'btn-outline' : ''}`}
      style={{ 
        flexDirection: 'column', 
        alignItems: 'flex-start', 
        height: 'auto', 
        padding: '20px', 
        gap: '4px' 
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
        <div style={{ 
          background: variant === 'outline' ? 'var(--primary-light)' : 'rgba(255,255,255,0.2)', 
          padding: '10px', 
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {icon}
        </div>
        <div style={{ textAlign: 'left', flex: 1 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: '700' }}>{label}</div>
          {sublabel && <div style={{ fontSize: '0.8rem', opacity: 0.8, fontWeight: '400' }}>{sublabel}</div>}
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </div>
    </button>
  );

  return (
    <div className="establishment-home-screen fade-in" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header with Background */}
      <div style={{
        position: 'relative',
        height: '240px',
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        padding: '30px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        color: 'white'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(to top, var(--secondary) 0%, rgba(30, 41, 59, 0.4) 60%, transparent 100%)',
          zIndex: 0
        }} />
        
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '22px',
            backgroundColor: 'var(--surface)',
            border: '4px solid rgba(255,255,255,0.3)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '32px' }}>🏪</span>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div className="badge badge-primary" style={{ marginBottom: '8px', background: 'var(--primary)', color: 'white' }}>
              Painel Admin
            </div>
            <h1 style={{ color: 'white', fontSize: '1.75rem', margin: 0 }}>
              {profile?.name || 'Estabelecimento'}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.8)', margin: 0, fontSize: '0.9rem' }}>
              {profile?.type || 'Restaurante & Delivery'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="card" style={{ 
        flex: 1, 
        marginTop: '-30px', 
        borderBottomLeftRadius: 0, 
        borderBottomRightRadius: 0,
        padding: '30px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        zIndex: 2
      }}>
        <div>
          <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Ações Rápidas
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <ActionButton 
              onClick={() => navigate('/establishment/create-delivery')}
              label="Nova Entrega"
              sublabel="Crie um novo pedido de entrega agora"
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5v14"/>
                </svg>
              }
            />

            <ActionButton 
              onClick={() => navigate('/establishment/in-progress')}
              variant="secondary"
              label="Em Andamento"
              sublabel="Acompanhe entregas saindo"
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>
                  <path d="M12 8v4l3 3"/>
                </svg>
              }
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button 
                onClick={() => navigate('/establishment/history')}
                className="btn btn-outline"
                style={{ flexDirection: 'column', height: '110px', padding: '16px' }}
              >
                <div style={{ background: 'var(--primary-light)', padding: '8px', borderRadius: '10px', marginBottom: '8px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"/>
                    <path d="M12 7v5l3 3"/>
                  </svg>
                </div>
                <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>Histórico</span>
              </button>

              <button 
                onClick={() => navigate('/establishment/profile')}
                className="btn btn-outline"
                style={{ flexDirection: 'column', height: '110px', padding: '16px' }}
              >
                <div style={{ background: 'var(--primary-light)', padding: '8px', borderRadius: '10px', marginBottom: '8px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>Meu Perfil</span>
              </button>
            </div>
          </div>
        </div>

        {/* Status Quick View */}
        <div className="glass" style={{ padding: '20px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>Status do dia</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary-dark)' }}>Online & Ativo</div>
          </div>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--success)', boxShadow: '0 0 10px var(--success)' }}></div>
        </div>
      </div>
    </div>
  );
}

