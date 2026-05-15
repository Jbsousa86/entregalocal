import React, { useEffect, useMemo, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebaseClient';
import { useNavigate } from 'react-router-dom';

export default function AcceptedDeliveryScreen() {
  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [establishmentName, setEstablishmentName] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const groupedDeliveries = useMemo(() => {
    if (activeDeliveries.length === 0) return [];
    const groupKey = activeDeliveries[0].groupId || activeDeliveries[0].id;
    const mainEstablishmentId = activeDeliveries[0].establishmentId;
    
    // Filtrar apenas entregas do mesmo estabelecimento
    return activeDeliveries.filter(d => {
      const isInGroup = (d.groupId || d.id) === groupKey;
      const isSameEstablishment = d.establishmentId === mainEstablishmentId;
      return isInGroup && isSameEstablishment;
    });
  }, [activeDeliveries]);

  const activeDelivery = groupedDeliveries[0] || null;
  const groupSize = groupedDeliveries.length;
  const totalValue = groupedDeliveries.reduce((sum, delivery) => sum + (delivery.value || 0), 0).toFixed(2);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'deliveries'),
      where('courierId', '==', auth.currentUser.uid),
      where('status', 'in', ['accepted', 'arrived_pickup', 'in_progress'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(docItem => ({ id: docItem.id, ...docItem.data() }));
      setActiveDeliveries(list);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchName = async () => {
      if (activeDelivery && activeDelivery.establishmentId) {
        const estDoc = await getDoc(doc(db, 'establishments', activeDelivery.establishmentId));
        if (estDoc.exists()) {
          setEstablishmentName(estDoc.data().name);
        }
      }
    };
    fetchName();
  }, [activeDelivery?.establishmentId]);

  const updateStatus = async (newStatus) => {
    if (!activeDelivery) return;

    if (newStatus === 'in_progress') {
      if (inputCode !== activeDelivery.pickupCode) {
        setError('C�digo de coleta incorreto. Pe�a o c�digo ao lojista.');
        return;
      }
      setError('');
    }

    try {
      const updates = { status: newStatus };
      if (newStatus === 'delivered') {
        updates.completedAt = serverTimestamp();
      }

      await Promise.all(groupedDeliveries.map((item) => updateDoc(doc(db, 'deliveries', item.id), updates)));

      if (newStatus === 'delivered') {
        alert('Entrega finalizada!');
        navigate('/courier/home');
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  if (!activeDelivery) {
    return (
      <div className="accepted-delivery-screen fade-in" style={{ padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '24px' }}>???</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '12px' }}>Nenhuma entrega ativa</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Voc� n�o possui nenhuma entrega em andamento no momento.</p>
        <button onClick={() => navigate('/courier/home')} className="btn">Voltar para Home</button>
      </div>
    );
  }

  const getStatusStep = () => {
    switch (activeDelivery.status) {
      case 'accepted': return 1;
      case 'arrived_pickup': return 2;
      case 'in_progress': return 3;
      default: return 1;
    }
  };

  const steps = [
    { id: 1, label: 'Aceito' },
    { id: 2, label: 'Na Loja' },
    { id: 3, label: 'Em Rota' }
  ];

  return (
    <div className="accepted-delivery-screen fade-in" style={{ paddingBottom: '40px' }}>
      <header style={{ 
        display: 'flex', 
        alignItems: 'center', 
        marginBottom: '24px',
        padding: '0 4px'
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '800', flex: 1, textAlign: 'center' }}>
          Entrega em Andamento
        </h2>
      </header>

      <div style={{ padding: '0 20px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '15px', left: '20px', right: '20px', height: '2px', background: 'var(--border)', zIndex: 0 }}></div>
          <div style={{ position: 'absolute', top: '15px', left: '20px', width: `${(getStatusStep() - 1) * 50}%`, height: '2px', background: 'var(--primary)', zIndex: 0, transition: 'width 0.3s ease' }}></div>
          
          {steps.map(step => (
            <div key={step.id} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ 
                width: '32px', height: '32px', borderRadius: '50%', 
                background: getStatusStep() >= step.id ? 'var(--primary)' : 'var(--surface)',
                border: `2px solid ${getStatusStep() >= step.id ? 'var(--primary)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: getStatusStep() >= step.id ? 'white' : 'var(--text-muted)',
                fontWeight: '800', fontSize: '0.8rem', transition: 'all 0.3s ease'
              }}>
                {getStatusStep() > step.id ? '?' : step.id}
              </div>
              <span style={{ fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', color: getStatusStep() >= step.id ? 'var(--secondary)' : 'var(--text-muted)' }}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ width: '48px', height: '48px', background: 'var(--primary-light)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/></svg>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Estabelecimento</div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>{establishmentName || activeDelivery.establishmentName || 'Estabelecimento'}</h3>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: groupSize > 1 ? '1fr 1fr' : '1fr', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ color: 'var(--primary)', paddingTop: '2px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Retirada</div>
              <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{activeDelivery.pickupAddress}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ color: 'var(--accent)', paddingTop: '2px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total</div>
              <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{groupSize > 1 ? `${groupSize} pedidos` : '1 pedido'}</div>
            </div>
          </div>
        </div>

        {groupSize > 1 && (
          <div style={{ marginTop: '18px', padding: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid var(--border)' }}>
            <p style={{ margin: 0, fontWeight: '700' }}>Total do grupo: R$ {totalValue.replace('.', ',')}</p>
            <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Este grupo inclui {groupSize} pedidos de entrega.</p>
          </div>
        )}
      </div>

      {groupSize > 1 && (
        <div className="card" style={{ padding: '20px', marginBottom: '24px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: '800' }}>Pedidos do grupo</h3>
          {groupedDeliveries.map((item) => (
            <div key={item.id} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Destino</div>
              {item.customerName && <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{item.customerName}</div>}
              <div style={{ fontWeight: '600' }}>{item.deliveryAddress}</div>
              {item.observation && <div style={{ marginTop: '4px', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Obs: {item.observation}</div>}
              <div style={{ marginTop: '6px', fontSize: '0.85rem', color: 'var(--secondary)' }}>R$ {Number(item.value).toFixed(2).replace('.', ',')}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ color: 'var(--primary)', paddingTop: '2px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Retirada</div>
            <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{activeDelivery.pickupAddress}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', marginTop: '18px' }}>
          <div style={{ color: 'var(--accent)', paddingTop: '2px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Entrega</div>
            {activeDelivery.customerName && <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{activeDelivery.customerName}</div>}
            <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{activeDelivery.deliveryAddress}</div>
            {activeDelivery.observation && <div style={{ marginTop: '4px', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Obs: {activeDelivery.observation}</div>}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {activeDelivery.status === 'accepted' && (
          <button 
            onClick={() => updateStatus('arrived_pickup')} 
            className="btn"
            style={{ height: '60px', fontSize: '1.1rem' }}
          >
            Cheguei no Estabelecimento
          </button>
        )}

        {activeDelivery.status === 'arrived_pickup' && (
          <div className="card fade-in" style={{ padding: '24px', textAlign: 'center', border: '2px solid var(--primary)' }}>
            <label style={{ display: 'block', marginBottom: '16px', fontWeight: '800', fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--primary)' }}>
              C�digo de Coleta
            </label>
            <input
              type="text"
              placeholder="0000"
              value={inputCode}
              onChange={e => setInputCode(e.target.value)}
              style={{ 
                textAlign: 'center', 
                fontSize: '2rem', 
                letterSpacing: '8px', 
                marginBottom: '16px',
                height: '70px',
                fontWeight: '800'
              }}
            />
            {error && <p style={{ color: 'var(--error)', fontSize: '0.85rem', fontWeight: '600', marginBottom: '16px' }}>{error}</p>}
            <button 
              onClick={() => updateStatus('in_progress')} 
              className="btn"
              style={{ width: '100%', height: '55px' }}
            >
              Confirmar Coleta
            </button>
          </div>
        )}

        {activeDelivery.status === 'in_progress' && (
          <button 
            onClick={() => updateStatus('delivered')} 
            className="btn"
            style={{ height: '60px', fontSize: '1.1rem', background: 'var(--primary-dark)' }}
          >
            Finalizar Entrega
          </button>
        )}
      </div>
    </div>
  );
}
