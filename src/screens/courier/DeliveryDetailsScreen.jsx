import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc, runTransaction, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../../firebaseClient';

const normalizeAddress = (address = '') => {
  return address
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const extractStreet = (address = '') => {
  const normalized = normalizeAddress(address);
  const match = normalized.match(/^(.*?)(?:\s\d|,|$)/);
  return match ? match[1].trim() : normalized;
};

const isNearbyAddress = (a = '', b = '') => {
  const streetA = extractStreet(a);
  const streetB = extractStreet(b);
  if (!streetA || !streetB) return false;
  return streetA === streetB || streetA.includes(streetB) || streetB.includes(streetA);
};

const samePickupAddress = (a = '', b = '') => {
  return normalizeAddress(a) === normalizeAddress(b);
};

export default function DeliveryDetailsScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { deliveryId } = location.state || {};
  const [delivery, setDelivery] = useState(null);
  const [nearbyCount, setNearbyCount] = useState(0);
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

          if (data.establishmentId) {
            try {
              const estDoc = await getDoc(doc(db, 'establishments', data.establishmentId));
              if (estDoc.exists() && estDoc.data().name) {
                currentEstName = estDoc.data().name;
              }
            } catch (err) {
              console.error('Erro ao buscar nome do estabelecimento:', err);
            }
          }

          setDelivery({ id: docSnap.id, ...data, establishmentName: currentEstName });

          const pendingQuery = query(
            collection(db, 'deliveries'),
            where('status', '==', 'pending'),
            where('establishmentId', '==', data.establishmentId)
          );
          const pendingSnapshot = await getDocs(pendingQuery);
          const groupable = [];

          pendingSnapshot.forEach((docItem) => {
            const pendingData = docItem.data();
            if (docItem.id === docSnap.id) return;
            if (!samePickupAddress(data.pickupAddress, pendingData.pickupAddress)) return;
            if (!isNearbyAddress(data.deliveryAddress, pendingData.deliveryAddress)) return;
            groupable.push(docItem.id);
          });

          setNearbyCount(Math.min(groupable.length, 2));
        } else {
          alert('Entrega n�o encontrada ou j� removida.');
          navigate('/courier/home');
        }
      } catch (error) {
        console.error('Erro ao buscar detalhes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDelivery();
  }, [deliveryId, navigate]);

  const handleAccept = async () => {
    if (!auth.currentUser || !delivery) return;
    setLoading(true);

    try {
      const pendingQuery = query(
        collection(db, 'deliveries'),
        where('status', '==', 'pending'),
        where('establishmentId', '==', delivery.establishmentId)
      );
      const pendingSnapshot = await getDocs(pendingQuery);

      const groupCandidates = [];
      pendingSnapshot.forEach((docItem) => {
        const data = docItem.data();
        if (docItem.id === delivery.id) return;
        if (!samePickupAddress(delivery.pickupAddress, data.pickupAddress)) return;
        if (!isNearbyAddress(delivery.deliveryAddress, data.deliveryAddress)) return;
        // Garantir que é do mesmo estabelecimento
        if (data.establishmentId !== delivery.establishmentId) return;
        groupCandidates.push({ id: docItem.id, data });
      });

      const selectedGroup = [
        { id: delivery.id, data: delivery },
        ...groupCandidates.slice(0, 2)
      ];

      const activeQuery = query(
        collection(db, 'deliveries'),
        where('courierId', '==', auth.currentUser.uid),
        where('status', 'in', ['accepted', 'arrived_pickup', 'in_progress'])
      );
      const activeSnapshot = await getDocs(activeQuery);

      if (!activeSnapshot.empty) {
        throw new Error('Você já possui uma entrega em andamento. Conclua-a antes de aceitar uma nova.');
      }

      await runTransaction(db, async (transaction) => {
        const courierRef = doc(db, 'couriers', auth.currentUser.uid);
        const courierDoc = await transaction.get(courierRef);
        const courierName = (courierDoc.exists() && courierDoc.data().name) ? courierDoc.data().name : 'Entregador';

        const groupId = delivery.id;
        const pickupCode = delivery.pickupCode;
        const groupSize = selectedGroup.length;

        const deliveryRefs = selectedGroup.map((item) => doc(db, 'deliveries', item.id));
        const deliveryDocs = [];

        for (const deliveryRef of deliveryRefs) {
          const deliveryDoc = await transaction.get(deliveryRef);
          deliveryDocs.push({ ref: deliveryRef, doc: deliveryDoc });
        }

        for (const { ref, doc: deliveryDoc } of deliveryDocs) {
          if (!deliveryDoc.exists()) {
            throw new Error('Uma das entregas do grupo não foi encontrada.');
          }

          if (deliveryDoc.data().status !== 'pending') {
            throw new Error('Uma das entregas do grupo já foi aceita por outro entregador.');
          }

          // Garantir que todas as entregas são do mesmo estabelecimento
          if (deliveryDoc.data().establishmentId !== delivery.establishmentId) {
            throw new Error('Todas as entregas do grupo devem ser do mesmo estabelecimento.');
          }
        }

        for (const deliveryRef of deliveryRefs) {
          transaction.update(deliveryRef, {
            status: 'accepted',
            courierId: auth.currentUser.uid,
            courierName,
            groupId,
            groupSize,
            pickupCode
          });
        }
      });

      alert(`Entrega aceita com sucesso!${selectedGroup.length > 1 ? ` Grupo de ${selectedGroup.length} pedidos criado.` : ''}`);
      navigate('/courier/accepted');
    } catch (error) {
      console.error('Erro ao aceitar entrega:', error);
      alert(error.message);
      if (
        error.message === 'Esta entrega j� foi aceita por outro entregador.' ||
        error.message === 'Entrega n�o encontrada.' ||
        error.message === 'Uma das entregas do grupo n�o foi encontrada.' ||
        error.message === 'Uma das entregas do grupo j� foi aceita por outro entregador.'
      ) {
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
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>Observa��es</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--secondary)' }}>{delivery.observation}</div>
          </div>
        )}
      </div>

      {nearbyCount > 0 && (
        <div className="card" style={{ padding: '18px', marginBottom: '24px', backgroundColor: '#f8fafc', border: '1px solid var(--border)' }}>
          <p style={{ margin: 0, fontWeight: '700', color: 'var(--secondary)' }}>
            Este pedido pode ser agrupado com mais {nearbyCount} pedido{nearbyCount > 1 ? 's' : ''} do mesmo estabelecimento.
          </p>
          <p style={{ marginTop: '8px', color: 'var(--text-muted)' }}>
            O sistema aceitar� at� 3 pedidos juntos para facilitar a viagem do entregador.
          </p>
        </div>
      )}

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
