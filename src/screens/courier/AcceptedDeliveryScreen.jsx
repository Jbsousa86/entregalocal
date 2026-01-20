import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
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
      await updateDoc(doc(db, 'deliveries', activeDelivery.id), {
        status: newStatus
      });
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
      <div className="accepted-delivery-screen">
        <h2>Nenhuma entrega ativa</h2>
        <button onClick={() => navigate('/courier/home')}>Voltar para Home</button>
      </div>
    );
  }

  return (
    <div className="accepted-delivery-screen">
      <h2>Entrega em Curso</h2>
      <div style={{ padding: '15px', border: '1px solid #ddd', marginBottom: '20px', borderRadius: '8px' }}>
        <h3>{establishmentName || activeDelivery.establishmentName || 'Estabelecimento'}</h3>
        <p><strong>Retirada:</strong> {activeDelivery.pickupAddress}</p>
        <p><strong>Entrega:</strong> {activeDelivery.deliveryAddress}</p>
        <p><strong>Status Atual:</strong> {activeDelivery.status}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {activeDelivery.status === 'accepted' && (
          <button onClick={() => updateStatus('arrived_pickup')}>Cheguei no Estabelecimento</button>
        )}
        {activeDelivery.status === 'arrived_pickup' && (
          <div style={{ backgroundColor: 'var(--surface)', padding: '15px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>Digite o código de coleta:</label>
            <input
              type="text"
              placeholder="Ex: 1234"
              value={inputCode}
              onChange={e => setInputCode(e.target.value)}
              style={{ textAlign: 'center', fontSize: '20px', letterSpacing: '4px', marginBottom: '10px' }}
            />
            {error && <p style={{ color: 'var(--error)', fontSize: '13px', marginBottom: '10px' }}>{error}</p>}
            <button onClick={() => updateStatus('in_progress')} style={{ backgroundColor: '#007bff' }}>Validar e Iniciar Entrega</button>
          </div>
        )}
        {activeDelivery.status === 'in_progress' && (
          <button onClick={() => updateStatus('delivered')} style={{ backgroundColor: '#28a745', color: 'white' }}>Finalizar Entrega</button>
        )}
      </div>
    </div>
  );
}
