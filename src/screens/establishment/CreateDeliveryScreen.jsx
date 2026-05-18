import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebaseClient';

export default function CreateDeliveryScreen() {
  const navigate = useNavigate();
  const [pickupAddress, setPickupAddress] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [street, setStreet] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [reference, setReference] = useState('');
  const [establishmentName, setEstablishmentName] = useState('');
  const [value, setValue] = useState('2.00');
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isFixedFromProfile, setIsFixedFromProfile] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [showPastedInput, setShowPastedInput] = useState(false);
  const [observation, setObservation] = useState('');

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
              setValue(data.deliveryFee.toString());
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

  const handlePublish = async (publishType = 'single') => {
    if (!pickupAddress || !customerName || !street || !neighborhood) {
      alert('Preencha todos os campos obrigatórios.');
      return;
    }

    setLoading(true);
    try {
      const pickupCode = Math.floor(1000 + Math.random() * 9000).toString();
      const deliveryAddress = `${street}, ${neighborhood}${reference ? ' - ' + reference : ''}`;

      const finalStatus = publishType === 'group' ? 'draft_group' : 'pending';

      const docRef = await addDoc(collection(db, 'deliveries'), {
        establishmentId: auth.currentUser.uid,
        establishmentName,
        pickupAddress,
        deliveryAddress,
        customerName,
        customerPhone,
        street,
        neighborhood,
        reference,
        observation,
        value: parseFloat(value),
        pickupCode,
        status: finalStatus,
        groupId: null,
        createdAt: serverTimestamp(),
      });

      const trackingUrl = `${window.location.origin}/rastreio/${docRef.id}`;
      const text = `Olá ${customerName ? customerName + ',' : ''} recebemos seu pedido e a entrega já foi solicitada! 🛵\nAcompanhe o status da entrega em tempo real pelo link:\n${trackingUrl}`;
      
      if (customerPhone) {
        const waUrl = `https://wa.me/55${customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
        window.open(waUrl, '_blank');
      } else {
        if (navigator.share) {
          navigator.share({
            title: 'Rastreio do Pedido',
            text: text,
            url: trackingUrl
          }).catch(err => console.error("Erro ao compartilhar", err));
        } else {
          navigator.clipboard.writeText(trackingUrl);
          alert('Link de rastreio copiado para a área de transferência!');
        }
      }

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

    // Tentar extrair nome do cliente (geralmente começa com "Olá", "Sr.", "Dra.", etc ou após "Cliente:" ou "Nome:")
    const nameMatch = pastedText.match(/(?:Cliente|Nome|Entrega para|Para|Destinatário):\s*([^\n,]+)|^([A-Z][a-záàâãéèêíïóôõöúçñ\s]+)(?:\n|,)/mi);
    if (nameMatch) {
      setCustomerName(nameMatch[1] || nameMatch[2] || '');
    }

    // Tentar extrair telefone
    const phoneMatch = pastedText.match(/(?:Telefone|Tel|Celular|Cel|WhatsApp|Whats|Contato):\s*([\d\s\-\(\)\+]{8,20})/i);
    if (phoneMatch) {
      setCustomerPhone(phoneMatch[1].trim());
    }

    // Tentar extrair endereço (Rua, Avenida, Travessa, etc)
    const streetMatch = pastedText.match(/(Rua|Avenida|Av|Travessa|Trav|Pça|Praça|Alameda|Estrada|Estr)\s+([^,\n]+)/i);
    if (streetMatch) {
      setStreet((streetMatch[1] + ' ' + streetMatch[2]).trim());
    }

    // Tentar extrair bairro (após "Bairro:", no final do endereço, ou antes do número do CEP)
    const neighborhoodMatch = pastedText.match(/(?:Bairro|Bdo|Bd):\s*([^\n,]+)|,\s*([A-Z][a-záàâãéèêíïóôõöúçñ\s]+)(?:\s*-\s*[A-Z]{2}|,|\n|$)/i);
    if (neighborhoodMatch) {
      setNeighborhood(neighborhoodMatch[1] || neighborhoodMatch[2] || '');
    }

    // Tentar extrair referência/complemento
    const referenceMatch = pastedText.match(/(?:Referência|Ref|Complemento|Apto|Apt|Casa|Sala|Loja|Bloco):\s*([^\n]+)|(?:próximo|junto|perto|em frente|ao lado|acima|abaixo)\s+(?:de|do|da|dos|das)?\s+([^\n]+)/i);
    if (referenceMatch) {
      setReference(referenceMatch[1] || referenceMatch[2] || '');
    }

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
                Importar do WhatsApp
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

        <div className="form-group">
          <label>Nome do Cliente</label>
          <input 
            type="text" 
            placeholder="Ex: João Silva" 
            value={customerName} 
            onChange={e => setCustomerName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Telefone do Cliente (Opcional)</label>
          <input 
            type="tel" 
            placeholder="Ex: (84) 99999-9999" 
            value={customerPhone} 
            onChange={e => setCustomerPhone(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Bairro</label>
          <input 
            type="text" 
            placeholder="Ex: Centro" 
            value={neighborhood} 
            onChange={e => setNeighborhood(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Rua</label>
          <input 
            type="text" 
            placeholder="Ex: Rua das Flores, 123" 
            value={street} 
            onChange={e => setStreet(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Referência</label>
          <input 
            type="text" 
            placeholder="Ex: Em frente ao supermercado" 
            value={reference} 
            onChange={e => setReference(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Observações / Itens</label>
          <textarea 
            placeholder="Ex: Entregar na portaria, troco para R$ 50..." 
            value={observation} 
            onChange={e => setObservation(e.target.value)}
            rows="3"
            style={{ height: 'auto' }}
          />
        </div>

        <div className="form-group" style={{ marginBottom: '32px' }}>
          <label>Taxa de Entrega (R$)</label>
          <input 
            type="number" 
            step="0.01"
            placeholder="Ex: 5.00" 
            value={value} 
            onChange={e => setValue(e.target.value)}
            style={{ 
              fontSize: '1.25rem', 
              fontWeight: '800', 
              color: 'var(--secondary)',
              textAlign: 'center'
            }}
          />
          <p style={{ fontSize: '0.75rem', marginTop: '8px', textAlign: 'center' }}>
            Valor sugerido pelo seu perfil. Você pode alterar se necessário.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button 
            onClick={() => handlePublish('single')} 
            disabled={loading || loadingProfile}
            className="btn"
            style={{ height: '64px', fontSize: '1.1rem' }}
          >
            {loading ? 'Publicando...' : (loadingProfile ? 'Aguarde...' : 'Publicar como Corrida Única')}
          </button>
          
          <button 
            onClick={() => handlePublish('group')} 
            disabled={loading || loadingProfile}
            className="btn btn-outline"
            style={{ height: '64px', fontSize: '1rem', borderStyle: 'dashed' }}
          >
            Salvar para Agrupar Depois
          </button>
        </div>
      </div>
    </div>
  );
}

