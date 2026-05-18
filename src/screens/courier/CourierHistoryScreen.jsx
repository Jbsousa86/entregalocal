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
              const dateSource = (data.status === 'delivered' && data.completedAt) ? data.completedAt : data.createdAt;
              let jsDate = new Date(0);
              if (dateSource) {
                jsDate = dateSource.seconds ? new Date(dateSource.seconds * 1000) : new Date(dateSource);
              }

              const item = {
                id: doc.id,
                ...data,
                jsDate,
                formattedDate: jsDate.getTime() > 0 ? jsDate.toLocaleDateString() : '---'
              };
              list.push(item);

              // Se for uma entrega antiga sem nome, marca para buscar no banco
              if (!data.establishmentName && data.establishmentId) {
                estIdsToFetch.add(data.establishmentId);
              }
            }
          });

          // Ordenar por maior data (mais recente primeiro)
          list.sort((a, b) => (b.jsDate?.getTime() || 0) - (a.jsDate?.getTime() || 0));

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
        const dateSource = (item.status === 'delivered' && item.completedAt) ? item.completedAt : item.createdAt;
        const date = dateSource ? (dateSource.seconds ? new Date(dateSource.seconds * 1000) : new Date(dateSource)) : new Date(0);
        return date.getTime() >= startTime;
      });
    }

    setFilteredHistory(filtered);

    const count = filtered.length;
    const earnings = filtered.reduce((acc, curr) => acc + Number(curr.value || 0), 0);

    setStats({ totalCount: count, totalEarnings: earnings });
    setStatsLoading(false);
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--primary)' }}>
      <div style={{ width: '40px', height: '40px', border: '4px solid var(--primary-light)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div className="courier-history-screen fade-in" style={{ paddingBottom: '40px' }}>
      <header style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: '24px',
        padding: '0 4px'
      }}>
        <button 
          onClick={() => navigate('/courier/home')}
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
          Histórico e Ganhos
        </h2>
        <div style={{ width: '40px' }}></div>
      </header>

      {/* Filter Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '24px', 
        paddingLeft: '4px',
        overflowX: 'auto',
        scrollbarWidth: 'none'
      }}>
        {[
          { id: 'today', label: 'Hoje' },
          { id: 'week', label: '7 dias' },
          { id: 'month', label: '30 dias' },
          { id: 'all', label: 'Tudo' }
        ].map(range => (
          <button
            key={range.id}
            onClick={() => setFilterRange(range.id)}
            className={`badge ${filterRange === range.id ? 'badge-primary' : ''}`}
            style={{
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: '700',
              cursor: 'pointer',
              border: 'none',
              background: filterRange === range.id ? 'var(--primary)' : 'var(--surface)',
              color: filterRange === range.id ? 'white' : 'var(--text-muted)',
              boxShadow: filterRange === range.id ? 'var(--shadow)' : 'var(--shadow-sm)',
              whiteSpace: 'nowrap'
            }}
          >
            {range.label}
          </button>
        ))}
      </div>

      {/* Summary Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Entregas</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800' }}>{stats.totalCount}</div>
        </div>
        
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>
            </svg>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ganhos</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>R$ {stats.totalEarnings.toFixed(2).replace('.', ',')}</div>
        </div>
      </div>

      <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', paddingLeft: '4px' }}>Lista de Atividades</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filteredHistory.length === 0 ? (
          <div className="card" style={{ padding: '60px 40px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📋</div>
            <p style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Nenhuma entrega encontrada para este período.</p>
          </div>
        ) : (
          filteredHistory.map((item) => (
            <div key={item.id} className="card fade-in" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ 
                    width: '32px', height: '32px', 
                    borderRadius: '8px', 
                    background: 'var(--primary-light)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--primary)'
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>{item.establishmentName || 'Estabelecimento'}</div>
                    {item.customerName && <div style={{ fontSize: '0.8rem', fontWeight: '600' }}>Para: {item.customerName}</div>}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.formattedDate}</div>
                  </div>
                </div>
                <div className={`badge ${item.status === 'delivered' ? 'badge-primary' : ''}`} style={{ 
                  background: item.status === 'delivered' ? 'var(--primary-light)' : '#fee2e2',
                  color: item.status === 'delivered' ? 'var(--primary-dark)' : 'var(--error)'
                }}>
                  {item.status === 'delivered' ? 'Concluída' : 'Cancelada'}
                </div>
              </div>

              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                paddingTop: '16px', 
                borderTop: '1px solid var(--surface-muted)' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: #{item.id.slice(-4).toUpperCase()}</span>
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--secondary)' }}>
                  R$ {Number(item.value || 0).toFixed(2).replace('.', ',')}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
