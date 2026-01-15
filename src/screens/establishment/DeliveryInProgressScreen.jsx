import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebaseClient';
import { useNavigate } from 'react-router-dom';

export default function DeliveryInProgressScreen() {
  const [deliveries, setDeliveries] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    let unsubscribeSnapshot = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Buscar entregas deste estabelecimento
        const q = query(
          collection(db, 'deliveries'), 
          where('establishmentId', '==', user.uid)
        );

        unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          const list = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            // Agora inclui 'pending' para mostrar o que está aguardando entregador
            if (['pending', 'accepted', 'in_progress', 'arrived_pickup'].includes(data.status)) {
              list.push({ id: doc.id, ...data });
            }
          });
          setDeliveries(list);
        });
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  return (
    <div className="delivery-in-progress-screen">
      <h2>Entregas em Andamento</h2>
      <button onClick={() => navigate('/establishment/home')} style={{ marginBottom: '20px' }}>Voltar</button>
      
      {deliveries.length === 0 ? (
        <p>Nenhuma entrega em andamento (aceita por entregador).</p>
      ) : (
        deliveries.map(item => (
          <div key={item.id} style={{ border: '1px solid #ccc', padding: '15px', margin: '10px 0', borderRadius: '8px' }}>
            <p><strong>Status:</strong> {
              item.status === 'pending' ? <span style={{color: 'orange'}}>Aguardando entregador</span> :
              item.status === 'accepted' ? <span style={{color: 'blue'}}>Aceita pelo entregador</span> :
              item.status === 'arrived_pickup' ? <span style={{color: 'purple'}}>Entregador no local</span> :
              <span style={{color: 'green'}}>Em rota de entrega</span>
            }</p>
            <p><strong>Entregador:</strong> {item.courierName || 'Aguardando...'}</p>
            <p><strong>Destino:</strong> {item.deliveryAddress}</p>
            <p><strong>Valor:</strong> R$ {item.value}</p>
          </div>
        ))
      )}
    </div>
  );
}
