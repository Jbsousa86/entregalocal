import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebaseClient';

export default function CreateDeliveryScreen() {
  const navigate = useNavigate();
  const [pickupAddress, setPickupAddress] = useState('');
  const [destinations, setDestinations] = useState([{ address: '', observation: '' }]);
  const [establishmentName, setEstablishmentName] = useState('');
  const [baseFee, setBaseFee] = useState(2.00);
  const totalValue = (baseFee + (destinations.length - 1)).toFixed(2);
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isFixedFromProfile, setIsFixedFromProfile] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [showPastedInput, setShowPastedInput] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, 'establishments', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.address) {
              setPickupAddress(data.address);
              setIsFixedFromProfile(true);
            }
            setEstablishmentName(data.name || '');
            if (data.deliveryFee) {
              setBaseFee(parseFloat(data.deliveryFee));
            }
          }
        } catch (error) {
          console.error("Erro ao carregar perfil:", error);
        }
      } else {
        navigate('/establishment/login');
      }
      setLoadingProfile(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  const handlePublish = async () => {
    if (!pickupAddress || destinations.some(d => !d.address)) {
      alert('Preencha todos os endereços de entrega.');
      return;
    }

    setLoading(true);
    try {
      const pickupCode = Math.floor(1000 + Math.random() * 9000).toString();
      
      const finalAddress = destinations.map((d, i) => destinations.length > 1 ? `Pedido ${i + 1}: ${d.address}` : d.address).join(' • ');
      const finalObservation = destinations.map((d, i) => d.observation ? (destinations.length > 1 ? `Pedido ${i + 1}: ${d.observation}` : d.observation) : '').filter(Boolean).join(' • ');

      await addDoc(collection(db, 'deliveries'), {
        establishmentId: auth.currentUser.uid,
        establishmentName,
        pickupAddress,
        deliveryAddress: finalAddress,
        observation: finalObservation,
        value: parseFloat(totalValue),
        pickupCode,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      navigate('/establishment/home');
    } catch (error) {
      console.error("Erro ao criar entrega:", error);
      alert('Erro ao criar entrega: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportWhatsApp = () => {
    if (!pastedText) return;

    const addressMatch = pastedText.match(/(?:Endereço|Entrega|Local|Rua|Av):\s*(.*)|(Rua\s.*|Av\s.*|Pça\s.*)/i);
    let newAddress = destinations[0].address;
    if (addressMatch) {
      newAddress = addressMatch[1] || addressMatch[2] || '';
    }

    const orderMatch = pastedText.match(/(?:Pedido|Itens|Produtos):\s*([\s\S]*?)(?:\n\n|Total:|$)/i);
    let newObs = destinations[0].observation;
    if (orderMatch) {
      newObs = orderMatch[1].trim();
    } else if (pastedText.length > 0) {
      newObs = pastedText.substring(0, 200) + (pastedText.length > 200 ? '...' : '');
    }
    
    const newDest = [...destinations];
    newDest[0] = { address: newAddress, observation: newObs };
    setDestinations(newDest);

    setShowPastedInput(false);
    setPastedText('');
  };

  return (
    <div className="create-delivery-screen fade-in" style={{ paddingBottom: '40px' }}>
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
          Nova Entrega
        </h2>
        <div style={{ width: '40px' }}></div>
      </header>

      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          <button 
            onClick={() => setShowPastedInput(!showPastedInput)}
            className="btn btn-outline"
            style={{ width: 'auto', padding: '10px 16px', fontSize: '0.85rem', gap: '6px' }}
          >
            {showPastedInput ? 'Fechar' : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
                </svg>
                Importar 1º Pedido
              </>
            )}
          </button>
        </div>

        {showPastedInput && (
          <div className="fade-in" style={{ 
            backgroundColor: 'var(--primary-light)', 
            padding: '20px', 
            borderRadius: '16px', 
            marginBottom: '24px', 
            border: '2px dashed var(--primary)' 
          }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--primary-dark)', fontWeight: '600', marginBottom: '12px' }}>
              Cole o pedido recebido para extrair os dados automaticamente:
            </p>
            <textarea 
              rows="5" 
              style={{ 
                width: '100%', 
                padding: '14px', 
                borderRadius: '12px', 
                border: '1px solid var(--primary)', 
                marginBottom: '12px',
                fontSize: '0.9rem'
              }}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Ex: Pedido #001 ... Endereço: Rua X, 100 ..."
            />
            <button onClick={handleImportWhatsApp} className="btn" style={{ padding: '12px' }}>
              Processar Dados
            </button>
          </div>
        )}

        <div className="form-group">
          <label>Endereço de Retirada</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder={loadingProfile ? "Carregando..." : "Local da retirada"}
              value={pickupAddress}
              onChange={e => setPickupAddress(e.target.value)}
              readOnly={loadingProfile || isFixedFromProfile}
              style={{
                paddingLeft: '44px',
                backgroundColor: (loadingProfile || isFixedFromProfile) ? 'var(--surface-muted)' : 'var(--surface)',
                opacity: (loadingProfile || isFixedFromProfile) ? 0.8 : 1
              }}
            />
            <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
          </div>
        </div>

        {destinations.map((dest, index) => (
          <div key={index} style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'var(--surface-muted)', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--primary)' }}>
                {index + 1}º Pedido / Destino
              </h4>
              {index > 0 && (
                <button 
                  onClick={() => {
                    const newDest = [...destinations];
                    newDest.splice(index, 1);
                    setDestinations(newDest);
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
                >
                  Remover
                </button>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label>Endereço de Entrega</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="Para onde vamos entregar?" 
                  value={dest.address} 
                  onChange={e => {
                    const newDest = [...destinations];
                    newDest[index].address = e.target.value;
                    setDestinations(newDest);
                  }}
                  style={{ paddingLeft: '44px' }}
                />
                <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4m4 4v-8"/>
                  </svg>
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Observações / Itens</label>
              <textarea 
                placeholder="Ex: Entregar na portaria, troco para R$ 50..." 
                value={dest.observation} 
                onChange={e => {
                  const newDest = [...destinations];
                  newDest[index].observation = e.target.value;
                  setDestinations(newDest);
                }}
                rows="2"
                style={{ height: 'auto' }}
              />
            </div>
          </div>
        ))}

        {destinations.length < 3 && (
          <button 
            className="btn btn-outline" 
            onClick={() => setDestinations([...destinations, { address: '', observation: '' }])}
            style={{ width: '100%', marginBottom: '24px', borderStyle: 'dashed', borderWidth: '2px' }}
          >
            + Adicionar outro destino (R$ 1,00)
          </button>
        )}

        <div className="form-group" style={{ marginBottom: '32px' }}>
          <label>Taxa de Entrega</label>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: 'var(--surface-muted)',
            padding: '20px',
            borderRadius: '16px',
            border: '2px solid var(--border)'
          }}>
            <span style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--secondary)' }}>
              R$ {totalValue.replace('.', ',')}
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', marginTop: '8px', textAlign: 'center' }}>
            A taxa base é do seu perfil. Cada destino extra adiciona R$ 1,00.
          </p>
        </div>

        <button 
          onClick={handlePublish} 
          disabled={loading || loadingProfile}
          className="btn"
          style={{ height: '64px', fontSize: '1.1rem' }}
        >
          {loading ? 'Publicando...' : (loadingProfile ? 'Aguarde...' : 'Confirmar e Publicar')}
        </button>
      </div>
    </div>
  );
}

