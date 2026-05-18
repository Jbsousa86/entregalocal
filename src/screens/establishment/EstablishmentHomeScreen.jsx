import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, onSnapshot, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebaseClient';
import backgroundImage from '../../assets/image.png';

export default function EstablishmentHomeScreen() {
  const [profile, setProfile] = useState(null);
  const [draftDeliveries, setDraftDeliveries] = useState([]);
  const [selectedDrafts, setSelectedDrafts] = useState([]);
  const [customGroupValue, setCustomGroupValue] = useState('');
  const [grouping, setGrouping] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const selectedDocs = draftDeliveries.filter(d => selectedDrafts.includes(d.id));
    const total = selectedDocs.reduce((acc, curr) => acc + (curr.value || 0), 0);
    setCustomGroupValue(total ? total.toString() : '');
  }, [selectedDrafts, draftDeliveries]);

  useEffect(() => {
    let unsubscribeDrafts = null;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docRef = doc(db, 'establishments', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data());
        }

        const q = query(collection(db, 'deliveries'), where('establishmentId', '==', user.uid), where('status', '==', 'draft_group'));
        unsubscribeDrafts = onSnapshot(q, (snapshot) => {
          const drafts = [];
          snapshot.forEach(d => drafts.push({ id: d.id, ...d.data() }));
          setDraftDeliveries(drafts);
        });

      } else {
        navigate('/establishment/login');
      }
    });
    return () => {
      unsubscribe();
      if (unsubscribeDrafts) unsubscribeDrafts();
    }
  }, [navigate]);

  const toggleDraftSelection = (id) => {
    setSelectedDrafts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleGroupAndPublish = async () => {
    if (selectedDrafts.length < 2) {
      alert("Selecione pelo menos 2 entregas para agrupar.");
      return;
    }
    setGrouping(true);
    try {
      const selectedDocs = draftDeliveries.filter(d => selectedDrafts.includes(d.id));
      const totalValue = parseFloat(customGroupValue) || 0;
      const deliveryIds = selectedDocs.map(d => d.id);
      const splitValue = totalValue / deliveryIds.length;
      
      const groupRef = await addDoc(collection(db, 'delivery_groups'), {
        establishmentId: auth.currentUser.uid,
        establishmentName: profile?.name || 'Estabelecimento',
        pickupAddress: profile?.address || selectedDocs[0].pickupAddress,
        deliveryIds,
        totalValue,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      for (const id of deliveryIds) {
        await updateDoc(doc(db, 'deliveries', id), {
          groupId: groupRef.id,
          status: 'grouped',
          value: splitValue
        });
      }

      setSelectedDrafts([]);
      alert("Grupo criado e publicado com sucesso!");
    } catch (error) {
      console.error(error);
      alert("Erro ao agrupar entregas.");
    } finally {
      setGrouping(false);
    }
  };

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

              <button 
                onClick={() => navigate('/establishment/wallet')}
                className="btn btn-outline"
                style={{ flexDirection: 'column', height: '110px', padding: '16px', gridColumn: 'span 2' }}
              >
                <div style={{ background: 'var(--primary-light)', padding: '8px', borderRadius: '10px', marginBottom: '8px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
                  </svg>
                </div>
                <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>Carteira (Acertos)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Agrupamento */}
        {draftDeliveries.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Aguardando Agrupamento
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {draftDeliveries.map(d => (
                <div 
                  key={d.id} 
                  onClick={() => toggleDraftSelection(d.id)}
                  style={{ 
                    padding: '16px', 
                    borderRadius: '12px', 
                    border: selectedDrafts.includes(d.id) ? '2px solid var(--primary)' : '2px solid var(--surface-muted)',
                    background: selectedDrafts.includes(d.id) ? 'var(--primary-light)' : 'var(--surface)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    border: '2px solid',
                    borderColor: selectedDrafts.includes(d.id) ? 'var(--primary)' : 'var(--text-muted)',
                    background: selectedDrafts.includes(d.id) ? 'var(--primary)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {selectedDrafts.includes(d.id) && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', color: 'var(--secondary)' }}>{d.customerName}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{d.deliveryAddress}</div>
                  </div>
                  <div style={{ fontWeight: '800', color: 'var(--primary)' }}>
                    R$ {Number(d.value || 0).toFixed(2).replace('.', ',')}
                  </div>
                </div>
              ))}
            </div>
            
            {selectedDrafts.length > 0 && (
               <div style={{ marginTop: '16px', padding: '16px', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                 <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '8px', color: 'var(--secondary)' }}>Definir Valor da Rota (R$)</label>
                 <input 
                   type="number" 
                   step="0.01"
                   value={customGroupValue} 
                   onChange={e => setCustomGroupValue(e.target.value)}
                   style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1.1rem', marginBottom: '8px', outline: 'none' }}
                   placeholder="Ex: 15.00"
                 />
                 
                 {customGroupValue && parseFloat(customGroupValue) > 0 && (
                   <div style={{ marginBottom: '16px', background: 'var(--surface-muted)', padding: '12px', borderRadius: '8px' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
                       <span style={{ color: 'var(--text-muted)' }}>Repasse ao Entregador (90%):</span>
                       <span style={{ fontWeight: '800', color: 'var(--primary)' }}>R$ {(parseFloat(customGroupValue) * 0.9).toFixed(2).replace('.', ',')}</span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                       <span style={{ color: 'var(--text-muted)' }}>Taxa da Plataforma (10%):</span>
                       <span style={{ fontWeight: '800', color: 'var(--secondary)' }}>R$ {(parseFloat(customGroupValue) * 0.1).toFixed(2).replace('.', ',')}</span>
                     </div>
                   </div>
                 )}

                 <button 
                  onClick={handleGroupAndPublish}
                  disabled={grouping}
                  className="btn"
                  style={{ width: '100%', padding: '16px' }}
                 >
                   {grouping ? 'Agrupando...' : `Agrupar e Publicar Rota`}
                 </button>
               </div>
            )}
          </div>
        )}

        {/* Status Quick View */}
        <div className="glass" style={{ padding: '20px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
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

