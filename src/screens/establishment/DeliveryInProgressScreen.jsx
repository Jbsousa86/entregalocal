import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebaseClient';
import { useNavigate } from 'react-router-dom';

export default function DeliveryInProgressScreen() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let unsubscribeSnapshot = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const q = query(
          collection(db, 'deliveries'),
          where('establishmentId', '==', user.uid)
        );

        unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          const list = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            if (['pending', 'grouped', 'accepted', 'in_progress', 'arrived_pickup'].includes(data.status)) {
              list.push({ id: doc.id, ...data });
            }
          });
          // Sort by newest first
          list.sort((a, b) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
          });
          setDeliveries(list);
          setLoading(false);
        });
      } else {
        navigate('/');
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [navigate]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': return { label: 'Aguardando Entregador', bg: '#fef3c7', color: '#d97706' };
      case 'grouped': return { label: 'Aguardando Entregador (Grupo)', bg: '#fef3c7', color: '#d97706' };
      case 'accepted': return { label: 'A caminho da Loja', bg: '#e0e7ff', color: '#4338ca' };
      case 'arrived_pickup': return { label: 'Entregador no Local', bg: '#f3e8ff', color: '#7e22ce' };
      case 'in_progress': return { label: 'Em Rota de Entrega', bg: '#dcfce7', color: '#15803d' };
      default: return { label: 'Desconhecido', bg: '#f1f5f9', color: '#475569' };
    }
  };

  const handleShareTracking = (id, customerPhone) => {
    const url = `${window.location.origin}/rastreio/${id}`;
    const text = `Acompanhe o status do seu pedido pelo link: ${url}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Rastreio do Pedido',
        text: text,
        url: url
      }).catch(err => console.error("Erro ao compartilhar", err));
    } else if (customerPhone) {
      const waUrl = `https://wa.me/55${customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
      window.open(waUrl, '_blank');
    } else {
      navigator.clipboard.writeText(url);
      alert('Link copiado para a área de transferência!');
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--primary)' }}>
      <div style={{ width: '40px', height: '40px', border: '4px solid var(--primary-light)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div className="delivery-in-progress-screen fade-in" style={{ paddingBottom: '40px' }}>
      <header style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: '24px',
        padding: '0 4px'
      }}>
        <button 
          onClick={() => navigate('/establishment/home')}
          style={{ 
            background: 'var(--surface)', 
            border: 'none', 
            borderRadius: '12px', 
            width: '40px', 
            height: '40px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
            color: 'var(--secondary)'
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '800', flex: 1, textAlign: 'center', margin: '0 12px' }}>
          Corridas em Andamento
        </h2>
        <div style={{ width: '40px' }}></div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {deliveries.length === 0 ? (
          <div className="card" style={{ padding: '60px 40px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🛵</div>
            <p style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Nenhuma corrida em andamento no momento.</p>
          </div>
        ) : (
          deliveries.map(item => {
            const badge = getStatusBadge(item.status);
            return (
              <div key={item.id} className="card fade-in" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ 
                      width: '32px', height: '32px', 
                      borderRadius: '8px', 
                      background: 'var(--surface-muted)', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--secondary)'
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-muted)' }}>ID: #{item.id.slice(-4).toUpperCase()}</div>
                    </div>
                  </div>
                  <div style={{ 
                    padding: '6px 12px', 
                    borderRadius: '20px', 
                    fontSize: '0.75rem', 
                    fontWeight: '800', 
                    background: badge.bg, 
                    color: badge.color,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {badge.label}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ color: 'var(--accent)', paddingTop: '2px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Destino</div>
                    {item.customerName && <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>{item.customerName}</div>}
                    <div style={{ fontSize: '0.9rem', color: 'var(--secondary)', fontWeight: '600', lineHeight: '1.4' }}>
                      {item.deliveryAddress}
                    </div>
                  </div>
                </div>

                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  paddingTop: '16px', 
                  borderTop: '1px solid var(--surface-muted)' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
                      🛵
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Entregador</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--secondary)' }}>{item.courierName || 'Aguardando...'}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Valor</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--primary)' }}>
                      R$ {Number(item.value || 0).toFixed(2).replace('.', ',')}
                    </div>
                  </div>
                </div>

                {['pending', 'accepted', 'arrived_pickup'].includes(item.status) && (
                  <div style={{
                    backgroundColor: 'var(--surface-muted)',
                    padding: '16px',
                    borderRadius: '12px',
                    marginTop: '16px',
                    border: '2px dashed var(--primary)',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--primary-dark)', textTransform: 'uppercase' }}>
                      Código de Coleta (Para o entregador)
                    </span>
                    <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--primary)', letterSpacing: '8px' }}>
                      {item.pickupCode}
                    </span>
                  </div>
                )}

                <button 
                  onClick={() => handleShareTracking(item.id, item.customerPhone)}
                  className="btn btn-outline" 
                  style={{ marginTop: '16px', width: '100%', gap: '8px', padding: '12px' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                  Compartilhar Rastreio
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
