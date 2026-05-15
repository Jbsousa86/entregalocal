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
  const [otherDeliveries, setOtherDeliveries] = useState([]);
  const [baseGroupFee, setBaseGroupFee] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showGroupChoice, setShowGroupChoice] = useState(false);
  const [selectedDeliveries, setSelectedDeliveries] = useState({});

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
          setSelectedDeliveries({ [docSnap.id]: true });

          // Buscar apenas entregas do mesmo estabelecimento (sem filtros de endereço)
          const pendingQuery = query(
            collection(db, 'deliveries'),
            where('status', '==', 'pending'),
            where('establishmentId', '==', data.establishmentId)
          );
          const pendingSnapshot = await getDocs(pendingQuery);
          const others = [];

          pendingSnapshot.forEach((docItem) => {
            if (docItem.id === docSnap.id) return;
            others.push({ id: docItem.id, ...docItem.data() });
          });

          setOtherDeliveries(others);

          // Buscar taxa padrão definida pelo admin (ex: collection 'settings' doc 'platform')
          try {
            const settingsRef = doc(db, 'settings', 'platform');
            const settingsSnap = await getDoc(settingsRef);
            const fee = (settingsSnap.exists() && settingsSnap.data().groupFee) ? Number(settingsSnap.data().groupFee) : 0;
            setBaseGroupFee(fee);
          } catch (err) {
            console.warn('Não foi possível obter taxa padrão do admin:', err);
            setBaseGroupFee(0);
          }
        } else {
          alert('Entrega não encontrada ou já removida.');
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

    // Se houver outras entregas compatíveis, mostrar seletor
    if (otherDeliveries.length > 0) {
      setShowGroupChoice(true);
      return;
    }

    // Caso contrário, aceitar apenas esta
    await acceptDelivery([{ id: delivery.id, data: delivery }]);
  };

  const toggleDeliverySelection = (deliveryId) => {
    setSelectedDeliveries((prev) => {
      const selected = Object.keys(prev).filter((k) => prev[k]);
      
      if (prev[deliveryId]) {
        // Desselecionar
        return { ...prev, [deliveryId]: false };
      } else if (selected.length < 3) {
        // Selecionar se não exceder 3
        return { ...prev, [deliveryId]: true };
      }
      
      return prev;
    });
  };

  const handleConfirmSelection = async () => {
    const selectedIds = Object.keys(selectedDeliveries).filter((k) => selectedDeliveries[k]);
    
    if (selectedIds.length === 0) {
      alert('Selecione pelo menos um pedido.');
      return;
    }

    setShowGroupChoice(false);

    const deliveriesToAccept = selectedIds.map((id) => {
      if (id === delivery.id) {
        return { id: delivery.id, data: delivery };
      }
      const other = otherDeliveries.find((d) => d.id === id);
      return { id, data: other };
    });

    await acceptDelivery(deliveriesToAccept);
  };

  const selectedCount = Object.keys(selectedDeliveries).filter((k) => selectedDeliveries[k]).length;
  // Calculate total: First order is full value, subsequent orders add +R$ 1.00 each
  let surchargePreview = 0;
  if (delivery) {
    surchargePreview = Number(delivery.value || 0) + Math.max(0, selectedCount - 1) * 1;
  }

  const acceptDelivery = async (deliveriesToAccept) => {
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

        const groupId = delivery.id;
        const pickupCode = delivery.pickupCode;
        const groupSize = deliveriesToAccept.length;
        const deliveryRefs = deliveriesToAccept.map((item) => doc(db, 'deliveries', item.id));
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
          if (deliveryDoc.data().establishmentId !== delivery.establishmentId) {
            throw new Error('Todas as entregas do grupo devem ser do mesmo estabelecimento.');
          }
        }

        let isFirst = true;

        for (const { ref, doc: deliveryDoc } of deliveryDocs) {
          // O primeiro pedido do grupo mantém o valor cheio (base admin)
          // Os 2º e 3º pedidos ganham +1 apenas. Atualizamos o "value" do Firestore para garantir isso na carteira.
          const originalValue = Number(deliveryDoc.data().value || 0);
          const finalGroupedValue = isFirst ? originalValue : 1.00;

          transaction.update(ref, {
            status: 'accepted',
            courierId: auth.currentUser.uid,
            courierName,
            groupId,
            groupSize,
            pickupCode,
            value: finalGroupedValue,
            chargedValue: finalGroupedValue,
            originalValue: originalValue
          });
          
          isFirst = false;
        }
      });

      alert(`Entrega aceita com sucesso!${deliveriesToAccept.length > 1 ? ` Grupo de ${deliveriesToAccept.length} pedidos criado.` : ''}`);
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
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary)' }}>R$ {Number(delivery.value).toFixed(2).replace('.', ',')}</div>
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
              {delivery.customerName && <div style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '2px' }}>{delivery.customerName}</div>}
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

      {otherDeliveries.length > 0 && (
        <div className="card" style={{ padding: '18px', marginBottom: '24px', backgroundColor: '#f8fafc', border: '1px solid var(--border)' }}>
          <p style={{ margin: 0, fontWeight: '700', color: 'var(--secondary)' }}>
            Este pedido pode ser agrupado com até 3 pedidos do mesmo estabelecimento.
          </p>
          <p style={{ marginTop: '8px', color: 'var(--text-muted)' }}>
            Ao aceitar, você poderá selecionar até 3 pedidos para levar juntos.
          </p>
        </div>
      )}

      {showGroupChoice && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(0, 0, 0, 0.5)', 
          display: 'flex', 
          alignItems: 'flex-end', 
          zIndex: 1000
        }}>
          <div style={{ 
            width: '100%', 
            background: 'white', 
            borderRadius: '20px 20px 0 0', 
            padding: '24px',
            animation: 'slideUp 0.3s ease'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '12px', marginTop: 0 }}>
              Selecionar pedidos para agrupar
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '12px' }}>
              Selecione os pedidos que deseja agrupar (máximo 3).
            </p>

            <div style={{ maxHeight: '240px', overflow: 'auto', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <input type="checkbox" checked={!!selectedDeliveries[delivery.id]} onChange={() => toggleDeliverySelection(delivery.id)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '700' }}>Este pedido{delivery.customerName ? ` (${delivery.customerName})` : ''}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{delivery.deliveryAddress}</div>
                </div>
              </div>

              {otherDeliveries.map((d) => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <input type="checkbox" checked={!!selectedDeliveries[d.id]} onChange={() => toggleDeliverySelection(d.id)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700' }}>{d.customerName || 'Pedido'}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{d.deliveryAddress}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Total a receber: <span style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '1rem' }}>R$ {surchargePreview.toFixed(2).replace('.', ',')}</span>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleConfirmSelection}
                disabled={loading}
                className="btn"
                style={{ flex: 1, height: '50px' }}
              >
                {loading ? 'Processando...' : `Confirmar pedido (${selectedCount})`}
              </button>
            
              <button
                onClick={() => setShowGroupChoice(false)}
                disabled={loading}
                style={{
                  height: '50px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  color: 'var(--secondary)',
                  fontSize: '1rem',
                  padding: '0 12px'
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>

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
