import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseClient';

export default function ClientTrackingScreen() {
  const { id } = useParams();
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;

    const docRef = doc(db, 'deliveries', id);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setDelivery({ id: docSnap.id, ...docSnap.data() });
        } else {
          setError('Entrega não encontrada.');
        }
        setLoading(false);
      },
      (err) => {
        console.error("Erro ao buscar rastreio:", err);
        setError('Erro ao buscar as informações da entrega.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--primary)' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid var(--primary-light)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>😕</div>
        <h2 style={{ color: 'var(--secondary)', marginBottom: '8px' }}>Ops!</h2>
        <p style={{ color: 'var(--text-muted)' }}>{error}</p>
      </div>
    );
  }

  if (!delivery) return null;

  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending': 
        return { label: 'Aguardando Entregador', emoji: '⏳', description: 'O estabelecimento está aguardando um entregador aceitar a corrida.', color: '#d97706', step: 1 };
      case 'accepted': 
      case 'arrived_pickup':
        return { label: 'Entregador à caminho da loja', emoji: '🏪', description: 'O entregador está indo buscar o seu pedido.', color: '#4338ca', step: 2 };
      case 'in_progress': 
        return { label: 'Saiu para Entrega', emoji: '🛵', description: 'O entregador já retirou o pedido e está a caminho do seu endereço.', color: '#15803d', step: 3 };
      case 'delivered': 
        return { label: 'Entregue', emoji: '✅', description: 'O seu pedido foi entregue com sucesso.', color: '#16a34a', step: 4 };
      case 'canceled': 
        return { label: 'Cancelado', emoji: '❌', description: 'A entrega foi cancelada.', color: '#dc2626', step: 0 };
      default: 
        return { label: 'Status Desconhecido', emoji: '❓', description: '', color: '#475569', step: 0 };
    }
  };

  const statusInfo = getStatusInfo(delivery.status);
  
  return (
    <div className="client-tracking-screen fade-in" style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <header style={{ textAlign: 'center', marginBottom: '32px', paddingTop: '20px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '8px' }}>
          Rastreio de Entrega
        </h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Acompanhe o status do seu pedido
        </p>
      </header>

      <div className="card fade-in" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '4rem', marginBottom: '16px', animation: delivery.status === 'in_progress' ? 'bounce 2s infinite' : 'none' }}>
            {statusInfo.emoji}
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: statusInfo.color, marginBottom: '8px' }}>
            {statusInfo.label}
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            {statusInfo.description}
          </p>
        </div>

        {delivery.status !== 'canceled' && (
          <div style={{ marginTop: '32px', padding: '0 20px', position: 'relative' }}>
            {/* Linha de progresso */}
            <div style={{ 
              position: 'absolute', 
              top: '0', 
              bottom: '0', 
              left: '28px', 
              width: '2px', 
              backgroundColor: 'var(--surface-muted)', 
              zIndex: '1' 
            }} />
            
            <div style={{ 
              position: 'absolute', 
              top: '0', 
              height: statusInfo.step === 1 ? '10%' : statusInfo.step === 2 ? '50%' : statusInfo.step === 3 ? '85%' : statusInfo.step === 4 ? '100%' : '0%', 
              left: '28px', 
              width: '2px', 
              backgroundColor: 'var(--primary)', 
              zIndex: '2',
              transition: 'height 0.5s ease'
            }} />

            {/* Passo 1 */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', position: 'relative', zIndex: '3', opacity: statusInfo.step >= 1 ? 1 : 0.4 }}>
              <div style={{ 
                width: '18px', height: '18px', borderRadius: '50%', 
                backgroundColor: statusInfo.step >= 1 ? 'var(--primary)' : 'var(--surface-muted)', 
                border: '4px solid var(--surface)',
                flexShrink: 0
              }} />
              <div style={{ marginTop: '-4px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--secondary)' }}>Pedido Criado</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loja: {delivery.establishmentName || 'Estabelecimento'}</p>
              </div>
            </div>

            {/* Passo 2 */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', position: 'relative', zIndex: '3', opacity: statusInfo.step >= 2 ? 1 : 0.4 }}>
              <div style={{ 
                width: '18px', height: '18px', borderRadius: '50%', 
                backgroundColor: statusInfo.step >= 2 ? 'var(--primary)' : 'var(--surface-muted)', 
                border: '4px solid var(--surface)',
                flexShrink: 0
              }} />
              <div style={{ marginTop: '-4px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--secondary)' }}>Entregador Aceitou</h4>
                {delivery.courierName && statusInfo.step >= 2 && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Entregador: {delivery.courierName}</p>
                )}
              </div>
            </div>

            {/* Passo 3 */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', position: 'relative', zIndex: '3', opacity: statusInfo.step >= 3 ? 1 : 0.4 }}>
              <div style={{ 
                width: '18px', height: '18px', borderRadius: '50%', 
                backgroundColor: statusInfo.step >= 3 ? 'var(--primary)' : 'var(--surface-muted)', 
                border: '4px solid var(--surface)',
                flexShrink: 0
              }} />
              <div style={{ marginTop: '-4px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--secondary)' }}>Saiu para Entrega</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>O pedido está a caminho.</p>
              </div>
            </div>

            {/* Passo 4 */}
            <div style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: '3', opacity: statusInfo.step >= 4 ? 1 : 0.4 }}>
              <div style={{ 
                width: '18px', height: '18px', borderRadius: '50%', 
                backgroundColor: statusInfo.step >= 4 ? 'var(--primary)' : 'var(--surface-muted)', 
                border: '4px solid var(--surface)',
                flexShrink: 0
              }} />
              <div style={{ marginTop: '-4px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--secondary)' }}>Entregue</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pedido chegou ao destino.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card fade-in" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--secondary)', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--surface-muted)' }}>
          Detalhes da Entrega
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cliente</span>
            <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--secondary)' }}>{delivery.customerName || 'Não informado'}</div>
          </div>
          
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Endereço de Entrega</span>
            <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--secondary)' }}>{delivery.deliveryAddress}</div>
          </div>
          
          {delivery.courierName && (
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Entregador Responsável</span>
              <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--secondary)' }}>{delivery.courierName}</div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}
