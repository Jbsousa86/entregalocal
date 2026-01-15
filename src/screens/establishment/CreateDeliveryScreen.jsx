import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebaseClient';

export default function CreateDeliveryScreen() {
  const navigate = useNavigate();
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [establishmentName, setEstablishmentName] = useState('');
  const [observation, setObservation] = useState('');
  const [value, setValue] = useState('2.00');
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isFixedFromProfile, setIsFixedFromProfile] = useState(false);

  // Buscar endereço do estabelecimento ao carregar a tela
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
      }
      setLoadingProfile(false);
    });
    return () => unsubscribe();
  }, []);

  const handlePublish = async () => {
    if (!pickupAddress || !deliveryAddress) {
      alert('Preencha os endereços.');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'deliveries'), {
        establishmentId: auth.currentUser.uid,
        establishmentName,
        pickupAddress,
        deliveryAddress,
        observation,
        value: parseFloat(value),
        status: 'pending', // pending, accepted, in_progress, delivered, canceled
        createdAt: serverTimestamp(),
      });
      alert('Entrega publicada com sucesso!');
      navigate('/establishment/home');
    } catch (error) {
      console.error("Erro ao criar entrega:", error);
      alert('Erro ao criar entrega: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-delivery-screen">
      <h2>Criar Nova Entrega</h2>
      <input
        type="text"
        placeholder={loadingProfile ? "Carregando endereço..." : "Endereço de retirada"}
        value={pickupAddress}
        onChange={e => setPickupAddress(e.target.value)}
        readOnly={loadingProfile || isFixedFromProfile}
        style={{
          backgroundColor: (loadingProfile || isFixedFromProfile) ? '#e9ecef' : '#fff',
          cursor: (loadingProfile || isFixedFromProfile) ? 'not-allowed' : 'text'
        }}
      />
      <input type="text" placeholder="Endereço de entrega" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} />
      <input type="text" placeholder="Observações (ex: 'sem troco')" value={observation} onChange={e => setObservation(e.target.value)} />
      <label style={{ display: 'block', textAlign: 'left', marginBottom: '5px', color: '#666' }}>Valor da Entrega:</label>
      <input
        type="text"
        value={`R$ ${parseFloat(value).toFixed(2).replace('.', ',')}`}
        readOnly
        style={{ backgroundColor: '#e9ecef', cursor: 'not-allowed', fontWeight: 'bold' }}
      />
      <button onClick={handlePublish} disabled={loading || loadingProfile}>
        {loading ? 'Publicando...' : (loadingProfile ? 'Carregando...' : 'Publicar entrega')}
      </button>
      <button onClick={() => navigate('/establishment/home')} style={{ marginTop: '10px', backgroundColor: '#6c757d' }}>Cancelar / Voltar</button>
    </div>
  );
}
