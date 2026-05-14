import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebaseClient';
import { useNavigate } from 'react-router-dom';

export default function DeliveryHistoryScreen() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRange, setFilterRange] = useState('today'); // Padrão 'today' conforme solicitação
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
              // Priorizamos data de finalização para o histórico de hoje
              const dateSource = (data.status === 'delivered' && data.completedAt) 
                ? data.completedAt 
                : (data.createdAt || null);

              if (dateSource) {
                jsDate = typeof dateSource.toDate === 'function'
                  ? dateSource.toDate()
                  : new Date(dateSource.seconds * 1000);
              } else {
                jsDate = new Date(0);
              }

              list.push({
                id: doc.id,
                ...data,
                jsDate,
                formattedDate: jsDate.getTime() > 0 ? jsDate.toLocaleDateString() : 'Sem data'
              });
            }
          });

          // Ordenação por maior data (mais recentes primeiro)
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

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--primary)' }}>
      <div style={{ width: '40px', height: '40px', border: '4px solid var(--primary-light)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div className="delivery-history-screen fade-in" style={{ paddingBottom: '40px' }}>
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
          Histórico de Entregas
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
          { id: 'week', label: 'Esta Semana' },
          { id: 'month', label: 'Este Mês' },
          { id: 'all', label: 'Ver Tudo' }
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Concluídas</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800' }}>{stats.deliveredCount}</div>
        </div>
        
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" x2="12" y1="2" y2="5"/><line x1="12" x2="12" y1="19" y2="22"/><circle cx="12" cy="12" r="7"/><polyline points="12 9 12 12 14.5 13.5"/>
            </svg>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Faturamento</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>R$ {stats.totalEarnings.toFixed(2)}</div>
        </div>
      </div>

      {/* Detail Stats (Secondary metrics) */}
      <div className="glass" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        padding: '16px 24px', 
        borderRadius: '20px', 
        marginBottom: '32px' 
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Canceladas</div>
          <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--error)' }}>{stats.canceledCount}</div>
        </div>
        <div style={{ width: '1px', backgroundColor: 'var(--border)' }}></div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Total Pedidos</div>
          <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--secondary)' }}>{stats.totalCount}</div>
        </div>
      </div>

      {/* History List */}
      <div>
        <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', paddingLeft: '4px' }}>Entregas Finalizadas</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {stats.filteredList.length === 0 ? (
            <div className="card" style={{ padding: '60px 40px', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📋</div>
              <p style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Nenhuma entrega encontrada para este período.</p>
            </div>
          ) : (
            stats.filteredList.map((item) => (
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
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>#{item.id.slice(-4).toUpperCase()}</div>
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

                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ color: 'var(--text-muted)', paddingTop: '2px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--secondary)', fontWeight: '500', lineHeight: '1.4' }}>
                    {item.deliveryAddress}
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
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
                      👤
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.courierName || 'Sem entregador'}</span>
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--secondary)' }}>
                    R$ {Number(item.value || 0).toFixed(2).replace('.', ',')}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
