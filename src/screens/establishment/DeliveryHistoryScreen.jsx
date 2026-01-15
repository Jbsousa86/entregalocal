import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebaseClient';
import { useNavigate } from 'react-router-dom';

export default function DeliveryHistoryScreen() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRange, setFilterRange] = useState('all'); // Padrão 'all' para o usuário ver tudo primeiro
  const [stats, setStats] = useState({
    deliveredCount: 0,
    canceledCount: 0,
    totalCount: 0,
    totalEarnings: 0,
    filteredList: []
  });
  const navigate = useNavigate();

  useEffect(() => {
    let unsubscribeSnapshot = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("🔍 Carregando histórico para:", user.uid);
        const q = query(
          collection(db, 'deliveries'),
          where('establishmentId', '==', user.uid)
        );

        unsubscribeSnapshot = onSnapshot(q, (querySnapshot) => {
          const list = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Pegamos apenas estados finais para o histórico
            if (['delivered', 'canceled'].includes(data.status)) {
              let jsDate;
              if (data.createdAt) {
                // Tenta toDate() do Firestore ou usa seconds
                jsDate = typeof data.createdAt.toDate === 'function'
                  ? data.createdAt.toDate()
                  : new Date(data.createdAt.seconds * 1000);
              } else {
                jsDate = new Date(0); // Data fallback para itens sem data
              }

              list.push({
                id: doc.id,
                ...data,
                jsDate,
                formattedDate: jsDate.getTime() > 0 ? jsDate.toLocaleDateString() : 'Sem data'
              });
            }
          });

          // Ordenação decrescente (mais recente primeiro)
          list.sort((a, b) => b.jsDate.getTime() - a.jsDate.getTime());
          setHistory(list);
          setLoading(false);
        }, (err) => {
          console.error("❌ Erro no Snapshot do Histórico:", err);
          setLoading(false);
        });
      } else {
        navigate('/');
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [navigate]);

  useEffect(() => {
    calculateStats();
  }, [history, filterRange]);

  const calculateStats = () => {
    const now = new Date();
    let startTime = 0;

    if (filterRange === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startTime = today.getTime();
    } else if (filterRange === 'week') {
      const week = new Date();
      week.setDate(now.getDate() - 7);
      week.setHours(0, 0, 0, 0);
      startTime = week.getTime();
    } else if (filterRange === 'month') {
      const month = new Date();
      month.setDate(now.getDate() - 30);
      month.setHours(0, 0, 0, 0);
      startTime = month.getTime();
    }

    const filtered = filterRange === 'all'
      ? history
      : history.filter(item => item.jsDate.getTime() >= startTime);

    const delivered = filtered.filter(item => item.status === 'delivered');
    const canceled = filtered.filter(item => item.status === 'canceled');
    const earnings = delivered.reduce((acc, curr) => acc + Number(curr.value || 0), 0);

    setStats({
      totalCount: filtered.length,
      deliveredCount: delivered.length,
      canceledCount: canceled.length,
      totalEarnings: earnings,
      filteredList: filtered
    });
  };

  if (loading) return <p className="text-center p-10">Carregando histórico...</p>;

  return (
    <div className="delivery-history-screen card fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ marginBottom: 0 }}>Histórico</h2>
        <button onClick={() => navigate('/establishment/home')} style={{ width: 'auto', padding: '8px 16px', backgroundColor: 'var(--secondary)' }}>Voltar</button>
      </div>

      {/* Seção de Filtros */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
        {[
          { id: 'all', label: 'Tudo' },
          { id: 'today', label: 'Hoje' },
          { id: 'week', label: '7 dias' },
          { id: 'month', label: '30 dias' }
        ].map(range => (
          <button
            key={range.id}
            onClick={() => setFilterRange(range.id)}
            style={{
              padding: '6px 12px', fontSize: '12px', width: 'auto',
              backgroundColor: filterRange === range.id ? 'var(--primary)' : 'var(--background)',
              color: filterRange === range.id ? 'white' : 'var(--text-main)',
              border: `1px solid ${filterRange === range.id ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: '20px', boxShadow: 'none'
            }}
          >
            {range.label}
          </button>
        ))}
      </div>

      {/* Cards de Métricas Principais */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div style={{ padding: '16px', backgroundColor: 'var(--primary-light)', borderRadius: 'var(--radius)', textAlign: 'center', border: '1px solid var(--primary)' }}>
          <p style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Entregas Concluídas</p>
          <p style={{ fontSize: '24px', fontWeight: '800', color: 'var(--secondary)' }}>{stats.deliveredCount}</p>
        </div>
        <div style={{ padding: '16px', backgroundColor: 'var(--primary-light)', borderRadius: 'var(--radius)', textAlign: 'center', border: '1px solid var(--primary)' }}>
          <p style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Total Faturado</p>
          <p style={{ fontSize: '22px', fontWeight: '800', color: 'var(--secondary)' }}>R$ {stats.totalEarnings.toFixed(2)}</p>
        </div>
      </div>

      {/* Detalhamento secundário */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        padding: '12px',
        backgroundColor: '#f8fafc',
        borderRadius: 'var(--radius)',
        marginBottom: '24px',
        fontSize: '13px',
        border: '1px solid var(--border)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Canceladas</span>
          <strong style={{ color: '#991b1b', fontSize: '16px' }}>{stats.canceledCount}</strong>
        </div>
        <div style={{ width: '1px', backgroundColor: 'var(--border)' }} />
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Volume Total</span>
          <strong style={{ color: 'var(--secondary)', fontSize: '16px' }}>{stats.totalCount}</strong>
        </div>
      </div>

      {/* Lista de Pedidos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {stats.filteredList.length === 0 ? (
          <div className="text-center p-8" style={{ color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '40px', marginBottom: '8px' }}>📋</p>
            <p>Nenhuma entrega finalizada encontrada neste período.</p>
          </div>
        ) : (
          stats.filteredList.map((item) => (
            <div key={item.id} style={{
              padding: '16px',
              backgroundColor: 'var(--surface)',
              borderRadius: 'var(--radius)',
              border: item.status === 'delivered' ? '1px solid var(--border)' : '1px solid #fee2e2',
              textAlign: 'left',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>{item.formattedDate}</span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: item.status === 'delivered' ? '#dcfce7' : '#fee2e2',
                  color: item.status === 'delivered' ? '#166534' : '#991b1b',
                  textTransform: 'uppercase'
                }}>
                  {item.status === 'delivered' ? 'Concluída' : 'Cancelada'}
                </span>
              </div>
              <p style={{ fontSize: '14px', marginBottom: '6px', color: 'var(--text-main)', lineHeight: '1.4' }}>
                <strong>Destino:</strong> {item.deliveryAddress}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px dashed var(--border)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Membro: {item.courierName || 'N/A'}</span>
                <span style={{ fontSize: '15px', fontWeight: '800', color: item.status === 'delivered' ? 'var(--secondary)' : 'var(--text-muted)' }}>
                  R$ {Number(item.value || 0).toFixed(2)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
