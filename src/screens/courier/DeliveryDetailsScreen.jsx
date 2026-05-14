import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc, runTransaction, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../../firebaseClient';

export default function DeliveryDetailsScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { deliveryId } = location.state || {};
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deliveryId) {
      navigate('/courier/home');
      return;
    }

    const fetchDelivery = async () => {
      try {
        const docRef = doc(db, 'deliveries', deliveryId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          let currentEstName = data.establishmentName;

          // Buscar nome atualizado do estabelecimento se possível
          if (data.establishmentId) {
            try {
              const estDoc = await getDoc(doc(db, 'establishments', data.establishmentId));
              if (estDoc.exists() && estDoc.data().name) {
                currentEstName = estDoc.data().name;
              }
            } catch (err) {
              console.error("Erro ao buscar nome do estabelecimento:", err);
            }
          }

          setDelivery({ id: docSnap.id, ...data, establishmentName: currentEstName });
        } else {
          alert('Entrega não encontrada ou já removida.');
          navigate('/courier/home');
        }
      } catch (error) {
        console.error("Erro ao buscar detalhes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDelivery();
  }, [deliveryId, navigate]);

  const handleAccept = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        // Verificar se o entregador já tem uma entrega ativa
        const activeQuery = query(
          collection(db, 'deliveries'),
          where('courierId', '==', auth.currentUser.uid),
          where('status', 'in', ['accepted', 'arrived_pickup', 'in_progress'])
        );
        const activeSnapshot = await getDocs(activeQuery);

        if (!activeSnapshot.empty) {
          throw new Error("Você já possui uma entrega em andamento. Conclua-a antes de aceitar uma nova.");
        }

        const deliveryRef = doc(db, 'deliveries', deliveryId);
        const deliveryDoc = await transaction.get(deliveryRef);

        if (!deliveryDoc.exists()) {
          throw new Error("Entrega não encontrada.");
        }

        if (deliveryDoc.data().status !== 'pending') {
          throw new Error("Esta entrega já foi aceita por outro entregador.");
        }

        const courierRef = doc(db, 'couriers', auth.currentUser.uid);
        const courierDoc = await transaction.get(courierRef);
        const courierName = (courierDoc.exists() && courierDoc.data().name) ? courierDoc.data().name : 'Entregador';

        transaction.update(deliveryRef, {
          status: 'accepted',
          courierId: auth.currentUser.uid,
          courierName: courierName
        });
      });

      alert('Entrega aceita com sucesso!');
      navigate('/courier/accepted');
    } catch (error) {
      console.error("Erro ao aceitar entrega:", error);
      alert(error.message);
      if (error.message === "Esta entrega já foi aceita por outro entregador." || error.message === "Entrega não encontrada.") {
        navigate('/courier/home');
      } else {
        setLoading(false);
      }
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--primary)' }}>
      <div style={{ width: '40px', height: '40px', border: '4px solid var(--primary-light)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!delivery) return null;

  return (
    <div className="delivery-details-screen fade-in" style={{ paddingBottom: '40px' }}>
      <header style={{ 
        display: 'flex', 
        alignItems: 'center', 
        marginBottom: '24px',
        padding: '0 4px'
      }}>
        <button 
          onClick={() => navigate('/courier/home')}
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
        <h2 style={{ fontSize: '1.25rem', fontWeight: '800', flex: 1, textAlign: 'center', marginRight: '40px' }}>
          Detalhes do Pedido
        </h2>
      </header>

      <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', background: 'var(--primary-light)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/></svg>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Estabelecimento</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '800' }}>{delivery.establishmentName || 'Estabelecimento'}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pagamento</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary)' }}>R$ {delivery.value}</div>
          </div>
        </div>

        <div style={{ 
          background: 'var(--background)', 
          borderRadius: '20px', 
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          position: 'relative'
        }}>
          <div style={{ position: 'absolute', left: '29px', top: '35px', bottom: '35px', width: '2px', background: 'var(--border)', borderStyle: 'dashed' }}></div>
          
          <div style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1 }}>
            <div style={{ width: '20px', height: '20px', background: 'var(--primary)', borderRadius: '50%', border: '4px solid white', boxShadow: 'var(--shadow-sm)' }}></div>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '4px' }}>Ponto de Retirada</div>
              <div style={{ fontSize: '0.95rem', fontWeight: '600', lineHeight: '1.4' }}>{delivery.pickupAddress}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1 }}>
            <div style={{ width: '20px', height: '20px', background: 'var(--accent)', borderRadius: '50%', border: '4px solid white', boxShadow: 'var(--shadow-sm)' }}></div>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '4px' }}>Destino da Entrega</div>
              <div style={{ fontSize: '0.95rem', fontWeight: '600', lineHeight: '1.4' }}>{delivery.deliveryAddress}</div>
            </div>
          </div>
        </div>

        {delivery.observation && (
          <div style={{ marginTop: '24px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>Observações</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--secondary)' }}>{delivery.observation}</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button 
          onClick={handleAccept} 
          disabled={loading}
          className="btn"
          style={{ height: '60px', fontSize: '1.1rem' }}
        >
          {loading ? 'Processando...' : 'Aceitar Entrega'}
        </button>

        <button
          onClick={() => navigate('/courier/home')}
          className="btn btn-secondary"
          style={{ height: '50px' }}
        >
          Voltar
        </button>
      </div>
    </div>
  );
}

