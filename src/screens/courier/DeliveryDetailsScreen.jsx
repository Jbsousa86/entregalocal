import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc, runTransaction, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../../firebaseClient';

export default function DeliveryDetailsScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { deliveryId, groupId } = location.state || {};
  
  const [delivery, setDelivery] = useState(null);
  const [group, setGroup] = useState(null);
  const [groupDeliveries, setGroupDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deliveryId && !groupId) {
      navigate('/courier/home');
      return;
    }

    const fetchData = async () => {
      try {
        if (groupId) {
          const groupRef = doc(db, 'delivery_groups', groupId);
          const groupSnap = await getDoc(groupRef);
          if (groupSnap.exists()) {
            setGroup({ id: groupSnap.id, ...groupSnap.data() });
            
            const q = query(collection(db, 'deliveries'), where('groupId', '==', groupId));
            const deliveriesSnap = await getDocs(q);
            const list = [];
            deliveriesSnap.forEach(d => list.push({ id: d.id, ...d.data() }));
            setGroupDeliveries(list);
          } else {
            alert('Grupo não encontrado.');
            navigate('/courier/home');
          }
        } else if (deliveryId) {
          const docRef = doc(db, 'deliveries', deliveryId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setDelivery({ id: docSnap.id, ...docSnap.data() });
          } else {
            alert('Entrega não encontrada.');
            navigate('/courier/home');
          }
        }
      } catch (error) {
        console.error('Erro ao buscar detalhes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [deliveryId, groupId, navigate]);

  const handleAccept = async () => {
    if (!auth.currentUser) return;
    setLoading(true);

    try {
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

        if (groupId && group) {
          const groupDocRef = doc(db, 'delivery_groups', groupId);
          const groupSnapshot = await transaction.get(groupDocRef);
          
          if (!groupSnapshot.exists() || groupSnapshot.data().status !== 'pending') {
            throw new Error('Este grupo já foi aceito ou não está mais disponível.');
          }

          transaction.update(groupDocRef, {
            status: 'accepted',
            courierId: auth.currentUser.uid,
            courierName
          });

          for (const d of groupDeliveries) {
            const dRef = doc(db, 'deliveries', d.id);
            transaction.update(dRef, {
              status: 'accepted',
              courierId: auth.currentUser.uid,
              courierName
            });
          }
        } else if (deliveryId && delivery) {
          const dRef = doc(db, 'deliveries', deliveryId);
          const dSnapshot = await transaction.get(dRef);
          
          if (!dSnapshot.exists() || dSnapshot.data().status !== 'pending') {
            throw new Error('Esta entrega já foi aceita ou não está mais disponível.');
          }

          transaction.update(dRef, {
            status: 'accepted',
            courierId: auth.currentUser.uid,
            courierName
          });
        }
      });

      alert('Aceito com sucesso!');
      navigate('/courier/accepted');
    } catch (error) {
      console.error(error);
      alert(error.message);
      navigate('/courier/home');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--primary)' }}>
      <div style={{ width: '40px', height: '40px', border: '4px solid var(--primary-light)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!delivery && !group) return null;

  const displayData = group || delivery;
  const isGroup = !!group;

  return (
    <div className="delivery-details-screen fade-in" style={{ paddingBottom: '40px' }}>
      <header style={{ 
        display: 'flex', alignItems: 'center', marginBottom: '24px', padding: '0 4px'
      }}>
        <button 
          onClick={() => navigate('/courier/home')}
          style={{ 
            background: 'var(--surface)', border: 'none', borderRadius: '12px', 
            width: '40px', height: '40px', display: 'flex', alignItems: 'center', 
            justifyContent: 'center', boxShadow: 'var(--shadow-sm)', cursor: 'pointer',
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
              <div style={{ fontSize: '1.25rem', fontWeight: '800' }}>{displayData.establishmentName || 'Estabelecimento'}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Valor a Receber</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary)' }}>
              R$ {Number(displayData.value || displayData.totalValue || 0).toFixed(2).replace('.', ',')}
            </div>
          </div>
        </div>

        <div style={{ 
          background: 'var(--background)', borderRadius: '20px', padding: '20px',
          display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative'
        }}>
          <div style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1 }}>
            <div style={{ width: '20px', height: '20px', background: 'var(--primary)', borderRadius: '50%', border: '4px solid white', boxShadow: 'var(--shadow-sm)' }}></div>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '4px' }}>Ponto de Retirada</div>
              <div style={{ fontSize: '0.95rem', fontWeight: '600', lineHeight: '1.4' }}>{displayData.pickupAddress}</div>
            </div>
          </div>

          {!isGroup && (
            <div style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1 }}>
              <div style={{ width: '20px', height: '20px', background: 'var(--accent)', borderRadius: '50%', border: '4px solid white', boxShadow: 'var(--shadow-sm)' }}></div>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '4px' }}>Destino da Entrega</div>
                {delivery.customerName && <div style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '2px' }}>{delivery.customerName}</div>}
                <div style={{ fontSize: '0.95rem', fontWeight: '600', lineHeight: '1.4' }}>{delivery.deliveryAddress}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isGroup && (
        <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: '800' }}>Destinos ({groupDeliveries.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {groupDeliveries.map((d, index) => (
              <div key={d.id} style={{ display: 'flex', gap: '12px', borderBottom: index < groupDeliveries.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: index < groupDeliveries.length - 1 ? '16px' : '0' }}>
                <div style={{ width: '24px', height: '24px', background: 'var(--accent)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: '800' }}>
                  {index + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{d.customerName}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{d.deliveryAddress}</div>
                </div>
              </div>
            ))}
          </div>
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
      </div>
    </div>
  );
}
