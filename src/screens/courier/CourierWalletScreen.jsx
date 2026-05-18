import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebaseClient';
import { useNavigate } from 'react-router-dom';

export default function CourierWalletScreen() {
  const [wallet, setWallet] = useState({ available: 0, blocked: 0, total: 0, withdrawn: 0 });
  const [transactions, setTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' ou 'withdrawals'
  const [filterRange, setFilterRange] = useState('all');
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const navigate = useNavigate();

  // 1. Buscar dados da carteira e transações
  useEffect(() => {
    let unsubscribeAuth = null;
    let unsubscribeDeliveries = null;
    let unsubscribeWithdrawals = null;

    unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Tentar preencher a chave PIX padrão se houver no perfil do entregador
        try {
          const courierDoc = await getDoc(doc(db, 'couriers', user.uid));
          if (courierDoc.exists() && courierDoc.data().pixKey) {
            setPixKey(courierDoc.data().pixKey);
          }
        } catch (e) {}
        // Buscar entregas entregues para calcular ganhos
        const deliveriesQuery = query(
          collection(db, 'deliveries'),
          where('courierId', '==', user.uid),
          where('status', '==', 'delivered')
        );

        unsubscribeDeliveries = onSnapshot(deliveriesQuery, (querySnapshot) => {
          const trans = [];
          let totalEarnings = 0;

          querySnapshot.forEach((docItem) => {
            const data = docItem.data();
            const value = Number(data.value || 0); // O entregador recebe 100% do valor publicado
            totalEarnings += value;

            const dateSource = data.completedAt || data.createdAt;
            let jsDate = new Date(0);
            if (dateSource) {
              jsDate = dateSource.seconds
                ? new Date(dateSource.seconds * 1000)
                : new Date(dateSource);
            }

            trans.push({
              id: docItem.id,
              type: 'delivery',
              description: `Entrega em ${data.deliveryAddress}`,
              establishment: data.establishmentName,
              amount: value,
              date: jsDate,
              formattedDate: jsDate.getTime() > 0
                ? jsDate.toLocaleDateString()
                : '---',
              status: 'completed'
            });
          });

          // Ordenar por data (mais recente primeiro)
          trans.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
          setTransactions(trans);

          // Buscar saques para calcular disponível
          const withdrawalsQuery = query(
            collection(db, 'withdrawals'),
            where('courierId', '==', user.uid)
          );

          unsubscribeWithdrawals = onSnapshot(withdrawalsQuery, (withdrawalsSnapshot) => {
            let totalWithdrawn = 0;
            let totalPending = 0;
            const withdrawalsList = [];

            withdrawalsSnapshot.forEach((withdrawalDoc) => {
              const wData = withdrawalDoc.data();
              const amount = Number(wData.amount || 0);
              const status = wData.status || 'pending';
              
              if (status === 'completed') {
                totalWithdrawn += amount;
              } else if (status === 'pending') {
                totalPending += amount;
              }

              const dateSource = wData.createdAt;
              let jsDate = new Date(0);
              if (dateSource) {
                jsDate = dateSource.seconds
                  ? new Date(dateSource.seconds * 1000)
                  : new Date(dateSource);
              }

              withdrawalsList.push({
                id: withdrawalDoc.id,
                amount,
                status: wData.status || 'pending',
                date: jsDate,
                formattedDate: jsDate.getTime() > 0
                  ? jsDate.toLocaleDateString()
                  : '---',
                bankAccount: wData.bankAccount || 'N/A'
              });
            });

            // Ordenar por data (mais recente primeiro)
            withdrawalsList.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
            setWithdrawals(withdrawalsList);

            // Calcular saldo disponível e bloqueado
            const available = totalEarnings - totalWithdrawn - totalPending;
            setWallet({
              available: Math.max(0, available),
              blocked: totalPending,
              total: totalEarnings,
              withdrawn: totalWithdrawn
            });

            setLoading(false);
          }, (error) => {
            console.error('Erro ao buscar saques:', error);
            setLoading(false);
          });
        }, (error) => {
          console.error('Erro ao buscar entregas:', error);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeDeliveries) unsubscribeDeliveries();
      if (unsubscribeWithdrawals) unsubscribeWithdrawals();
    };
  }, []);

  const handleWithdrawRequest = async () => {
    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Por favor, informe um valor válido para o saque.');
      return;
    }
    if (amountNum > wallet.available) {
      alert('O valor solicitado é maior que o saldo disponível.');
      return;
    }
    if (!pixKey.trim()) {
      alert('Por favor, informe sua chave PIX.');
      return;
    }

    setIsWithdrawing(true);
    try {
      const { addDoc, serverTimestamp, collection } = await import('firebase/firestore');
      await addDoc(collection(db, 'withdrawals'), {
        courierId: auth.currentUser.uid,
        amount: amountNum,
        bankAccount: pixKey,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      alert('Solicitação de saque enviada com sucesso! O valor ficará bloqueado até a transferência ser concluída.');
      setShowWithdrawModal(false);
      setWithdrawAmount('');
    } catch (error) {
      console.error('Erro ao solicitar saque:', error);
      alert('Ocorreu um erro ao solicitar o saque. Tente novamente.');
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Filtrar transações por período
  const getFilteredTransactions = () => {
    let filtered = activeTab === 'transactions' ? transactions : withdrawals;

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

      filtered = filtered.filter((item) => {
        const date = item.date;
        return date?.getTime() >= startTime;
      });
    }

    return filtered;
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        color: 'var(--primary)'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid var(--primary-light)',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const filteredData = getFilteredTransactions();

  return (
    <div className="courier-wallet-screen fade-in" style={{ paddingBottom: '40px' }}>
      {/* Header */}
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
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '800', flex: 1, textAlign: 'center', margin: '0 12px' }}>
          Carteira
        </h2>
        <div style={{ width: '40px' }} />
      </header>

      {/* Saldo Disponível - Card Principal */}
      <div className="card" style={{
        padding: '32px 24px',
        marginBottom: '24px',
        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
        color: 'white',
        borderRadius: '20px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '0.9rem', fontWeight: '600', opacity: 0.9, marginBottom: '8px' }}>
          Saldo Disponível
        </div>
        <div style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '24px' }}>
          R$ {wallet.available.toFixed(2).replace('.', ',')}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Bloqueado (Saques Pendentes)</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700' }}>R$ {wallet.blocked.toFixed(2).replace('.', ',')}</div>
          </div>
        </div>
        <button
          onClick={() => setShowWithdrawModal(true)}
          className="btn"
          disabled={wallet.available <= 0}
          style={{
            width: '100%',
            height: '48px',
            background: 'rgba(255,255,255,0.2)',
            color: 'white',
            border: '2px solid white',
            borderRadius: '12px',
            fontWeight: '700',
            cursor: wallet.available <= 0 ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            opacity: wallet.available <= 0 ? 0.5 : 1
          }}
        >
          {wallet.available <= 0 ? 'Saldo Insuficiente' : 'Solicitar Saque'}
        </button>
      </div>

      {/* Cards de Resumo */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        marginBottom: '32px'
      }}>
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>Total de Ganhos</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>
            R$ {wallet.total.toFixed(2).replace('.', ',')}
          </div>
        </div>

        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--secondary)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7v6h18V7" />
              <path d="M3 13v6h18v-6" />
            </svg>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>Total Sacado</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>
            R$ {wallet.withdrawn.toFixed(2).replace('.', ',')}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        paddingLeft: '4px',
        overflowX: 'auto',
        scrollbarWidth: 'none'
      }}>
        {[
          { id: 'transactions', label: 'Histórico' },
          { id: 'withdrawals', label: 'Saques' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setFilterRange('all');
            }}
            className={`badge ${activeTab === tab.id ? 'badge-primary' : ''}`}
            style={{
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: '700',
              cursor: 'pointer',
              border: 'none',
              background: activeTab === tab.id ? 'var(--primary)' : 'var(--surface)',
              color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
              boxShadow: activeTab === tab.id ? 'var(--shadow)' : 'var(--shadow-sm)',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Tabs por Período */}
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

      {/* Lista de Transações/Saques */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredData.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: 'var(--text-muted)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📭</div>
            <div style={{ fontSize: '1rem', fontWeight: '600' }}>
              Nenhum {activeTab === 'transactions' ? 'ganho' : 'saque'} encontrado
            </div>
          </div>
        ) : (
          filteredData.map((item) => (
            <div key={item.id} className="card" style={{
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: activeTab === 'transactions' ? 'var(--primary-light)' : 'var(--secondary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: activeTab === 'transactions' ? 'var(--primary)' : 'var(--secondary)',
                fontSize: '1.5rem'
              }}>
                {activeTab === 'transactions' ? '📦' : '🏦'}
              </div>

              <div style={{ flex: 1 }}>
                {activeTab === 'transactions' ? (
                  <>
                    <div style={{ fontWeight: '700', marginBottom: '4px' }}>
                      Entrega Concluída
                    </div>
                    <div style={{
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)',
                      marginBottom: '4px'
                    }}>
                      {item.establishment}
                    </div>
                    <div style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)'
                    }}>
                      {item.formattedDate}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: '700', marginBottom: '4px' }}>
                      Saque Solicitado
                    </div>
                    <div style={{
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)',
                      marginBottom: '4px'
                    }}>
                      {item.bankAccount}
                    </div>
                    <div style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)'
                    }}>
                      {item.formattedDate} • Status: {item.status === 'completed' ? '✅ Concluído' : item.status === 'pending' ? '⏳ Pendente' : '❌ Cancelado'}
                    </div>
                  </>
                )}
              </div>

              <div style={{
                textAlign: 'right',
                fontWeight: '800',
                fontSize: '1.1rem',
                color: activeTab === 'transactions' ? 'var(--primary)' : 'var(--secondary)'
              }}>
                R$ {item.amount.toFixed(2).replace('.', ',')}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Saque */}
      {showWithdrawModal && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', zIndex: 1000 
        }}>
          <div style={{ 
            background: 'white', width: '100%', borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
            padding: '24px', animation: 'slideUp 0.3s ease'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem' }}>Solicitar Saque</h3>
            
            <div className="form-group">
              <label>Valor do Saque (Disponível: R$ {wallet.available.toFixed(2).replace('.', ',')})</label>
              <input 
                type="number" 
                step="0.01"
                placeholder="Ex: 50.00" 
                value={withdrawAmount} 
                onChange={e => setWithdrawAmount(e.target.value)} 
                max={wallet.available}
              />
            </div>

            <div className="form-group">
              <label>Chave PIX</label>
              <input 
                type="text" 
                placeholder="Telefone, CPF ou E-mail" 
                value={pixKey} 
                onChange={e => setPixKey(e.target.value)} 
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button 
                onClick={handleWithdrawRequest} 
                disabled={isWithdrawing}
                className="btn" 
                style={{ flex: 1, height: '50px' }}
              >
                {isWithdrawing ? 'Processando...' : 'Confirmar Saque'}
              </button>
              <button 
                onClick={() => setShowWithdrawModal(false)} 
                className="btn btn-secondary" 
                style={{ height: '50px', background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
