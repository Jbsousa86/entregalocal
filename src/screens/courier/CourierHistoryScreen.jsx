import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebaseClient';
import { useNavigate } from 'react-router-dom';

export default function CourierHistoryScreen() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let unsubscribeSnapshot = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Busca entregas feitas por este entregador
        const q = query(
          collection(db, 'deliveries'),
          where('courierId', '==', user.uid)
        );

        // Usando onSnapshot para garantir o carregamento
        unsubscribeSnapshot = onSnapshot(q, async (querySnapshot) => {
          const list = [];
          const estIdsToFetch = new Set();
          
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Apenas finalizadas
            if (['delivered', 'canceled'].includes(data.status)) {
              const item = {
                id: doc.id,
                ...data,
                formattedDate: data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : '---'
              };
              list.push(item);

              // Se for uma entrega antiga sem nome, marca para buscar no banco
              if (!data.establishmentName && data.establishmentId) {
                estIdsToFetch.add(data.establishmentId);
              }
            }
          });

          // Ordenar por data
          list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          
          // Se houver entregas antigas sem nome, busca os nomes agora
          if (estIdsToFetch.size > 0) {
            try {
              const namesMap = {};
              const promises = Array.from(estIdsToFetch).map(async (eid) => {
                try {
                  const estDoc = await getDoc(doc(db, 'establishments', eid));
                  if (estDoc.exists()) {
                    namesMap[eid] = estDoc.data().name;
                  }
                } catch (e) { console.error(e); }
              });
              
              await Promise.all(promises);
              
              // Atualiza a lista com os nomes encontrados
              const updatedList = list.map(item => ({
                ...item,
                establishmentName: item.establishmentName || namesMap[item.establishmentId] || ''
              }));
              setHistory(updatedList);
            } catch (err) {
              console.error("Erro ao buscar nomes antigos:", err);
              setHistory(list);
            }
          } else {
            setHistory(list);
          }

          setLoading(false);
        }, (error) => {
          console.error("Erro ao buscar histórico:", error);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });
    
    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  return (
    <div className="courier-history-screen">
      <h2>Histórico do Entregador</h2>
      <button onClick={() => navigate('/courier/home')} style={{ marginBottom: '15px' }}>Voltar</button>
      
      {loading ? <p>Carregando...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #cccccc' }}>
            <th style={{ padding: '8px' }}>Data</th>
            <th style={{ padding: '8px' }}>Local</th>
            <th style={{ padding: '8px' }}>Valor</th>
            <th style={{ padding: '8px' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {history.length === 0 ? (
            <tr><td colSpan="4" style={{ padding: '10px', textAlign: 'center' }}>Nenhuma entrega finalizada.</td></tr>
          ) : (
            history.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #eeeeee' }}>
                <td style={{ padding: '8px' }}>{item.formattedDate}</td>
                <td style={{ padding: '8px' }}>{item.establishmentName || item.pickupAddress || '---'}</td>
                <td style={{ padding: '8px' }}>R$ {item.value}</td>
                <td style={{ padding: '8px' }}>
                  {item.status === 'delivered' ? <span style={{color:'blue'}}>Concluída</span> : <span style={{color:'red'}}>Cancelada</span>}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      )}
    </div>
  );
}
