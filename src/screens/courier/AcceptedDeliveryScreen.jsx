import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebaseClient';
import { useNavigate } from 'react-router-dom';

export default function AcceptedDeliveryScreen() {
  const [activeDelivery, setActiveDelivery] = useState(null);
  const [establishmentName, setEstablishmentName] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.currentUser) return;

    // Buscar entrega ativa do entregador (status != delivered/canceled)
    const q = query(
      collection(db, 'deliveries'),
      where('courierId', '==', auth.currentUser.uid),
      where('status', 'in', ['accepted', 'arrived_pickup', 'in_progress'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docData = snapshot.docs[0];
        setActiveDelivery({ id: docData.id, ...docData.data() });
      } else {
        setActiveDelivery(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Efeito extra para buscar o nome atualizado do estabelecimento
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

    // Validar código de coleta se estiver iniciando a entrega
    if (newStatus === 'in_progress') {
      if (inputCode !== activeDelivery.pickupCode) {
        setError('Código de coleta incorreto. Peça o código ao lojista.');
        return;
      }
      setError('');
    }

    try {
      const updates = { status: newStatus };
      if (newStatus === 'delivered') {
        updates.completedAt = serverTimestamp();
      }

      await updateDoc(doc(db, 'deliveries', activeDelivery.id), updates);
      if (newStatus === 'delivered') {
        alert('Entrega finalizada!');
        navigate('/courier/home');
      }
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
    }
  };

  if (!activeDelivery) {
    return (
      <div className="accepted-delivery-screen fade-in" style={{ padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '24px' }}>🏜️</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '12px' }}>Nenhuma entrega ativa</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Você não possui nenhuma entrega em andamento no momento.</p>
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

      {/* Progress Tracker */}
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
                {getStatusStep() > step.id ? '✓' : step.id}
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
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>{establishmentName || activeDelivery.establishmentName || 'Estabelecimento'}</h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
              <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Entrega</div>
              <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{activeDelivery.deliveryAddress}</div>
            </div>
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
              Código de Coleta
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

