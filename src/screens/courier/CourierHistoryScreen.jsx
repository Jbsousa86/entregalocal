import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebaseClient';
import { useNavigate } from 'react-router-dom';

export default function CourierHistoryScreen() {
  const [history, setHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRange, setFilterRange] = useState('today');
  const [stats, setStats] = useState({ totalCount: 0, totalEarnings: 0 });
  const [statsLoading, setStatsLoading] = useState(false);
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

  useEffect(() => {
    calculateStats();
  }, [history, filterRange]);

  const calculateStats = () => {
    setStatsLoading(true);
    let filtered = history.filter(item => item.status === 'delivered');

    if (filterRange !== 'all') {
      const now = new Date();
      let startTime = 0;

      if (filterRange === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        startTime = today.getTime();
      } else if (filterRange === 'week') {
        const week = new Date();
        week.setDate(now.getDate() - 7);
        startTime = week.getTime();
      } else if (filterRange === 'month') {
        const month = new Date();
        month.setDate(now.getDate() - 30);
        startTime = month.getTime();
      }

      filtered = filtered.filter(item => {
        const date = item.createdAt ? new Date(item.createdAt.seconds * 1000) : new Date(0);
        return date.getTime() >= startTime;
      });
    }

    setFilteredHistory(filtered);

    const count = filtered.length;
    const earnings = filtered.reduce((acc, curr) => acc + Number(curr.value || 0), 0);

    setStats({ totalCount: count, totalEarnings: earnings });
    setStatsLoading(false);
  };

  return (
    <div className="courier-history-screen">
      <h2>Histórico e Relatório</h2>
      <button onClick={() => navigate('/courier/home')} style={{ marginBottom: '20px', width: 'auto', padding: '10px 20px' }}>Voltar ao Início</button>

      {/* Seção de Relatório */}
      <div className="mb-8 card" style={{ padding: '20px', backgroundColor: 'var(--background)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '25px', boxShadow: 'var(--shadow-sm)' }}>
        <h3 className="mb-4" style={{ textAlign: 'center', fontSize: '18px' }}>📊 Resumo de Atividades</h3>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px', justifyContent: 'center' }}>
          {[
            { id: 'today', label: 'Hoje' },
            { id: 'week', label: '7 dias' },
            { id: 'month', label: '30 dias' },
            { id: 'all', label: 'Tudo' }
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setFilterRange(filter.id)}
              style={{
                padding: '6px 12px', fontSize: '12px', width: 'auto',
                backgroundColor: filterRange === filter.id ? 'var(--primary)' : 'var(--background)',
                color: filterRange === filter.id ? 'white' : 'var(--text)',
                border: `1px solid ${filterRange === filter.id ? 'var(--primary)' : 'var(--border)'}`,
                borderRadius: '20px', boxShadow: 'none'
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', opacity: statsLoading ? 0.6 : 1 }}>
          <div style={{ padding: '12px', backgroundColor: 'var(--primary-light)', borderRadius: 'var(--radius)', textAlign: 'center', border: '1px solid var(--primary)' }}>
            <p style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Entregas</p>
            <p style={{ fontSize: '20px', fontWeight: '800', color: 'var(--secondary)' }}>{stats.totalCount}</p>
          </div>
          <div style={{ padding: '12px', backgroundColor: 'var(--primary-light)', borderRadius: 'var(--radius)', textAlign: 'center', border: '1px solid var(--primary)' }}>
            <p style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Ganhos</p>
            <p style={{ fontSize: '18px', fontWeight: '800', color: 'var(--secondary)' }}>R$ {stats.totalEarnings.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <h3 className="mb-4">Lista de Entregas</h3>
      {loading ? <p className="text-center">Carregando...</p> : (
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
            {filteredHistory.length === 0 ? (
              <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma entrega concluída neste período.</td></tr>
            ) : (
              filteredHistory.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #eeeeee' }}>
                  <td style={{ padding: '8px' }}>{item.formattedDate}</td>
                  <td style={{ padding: '8px' }}>{item.establishmentName || item.pickupAddress || '---'}</td>
                  <td style={{ padding: '8px' }}>R$ {item.value}</td>
                  <td style={{ padding: '8px' }}>
                    {item.status === 'delivered' ? <span style={{ color: 'blue' }}>Concluída</span> : <span style={{ color: 'red' }}>Cancelada</span>}
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
