import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebaseClient';
import { useNavigate } from 'react-router-dom';

export default function EstablishmentWalletScreen() {
  const [wallet, setWallet] = useState({ totalDeliveries: 0, totalDebt: 0, totalPaid: 0, pendingDebt: 0 });
  const [deliveriesList, setDeliveriesList] = useState([]);
  const [paymentsList, setPaymentsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let unsubscribeAuth = null;
    let unsubscribeDeliveries = null;
    let unsubscribePayments = null;

    unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Fetch deliveries for this establishment
        const deliveriesQuery = query(
          collection(db, 'deliveries'),
          where('establishmentId', '==', user.uid),
          where('status', '==', 'delivered')
        );

        unsubscribeDeliveries = onSnapshot(deliveriesQuery, (querySnapshot) => {
          let totalDeliveryValue = 0;
          const dList = [];

          querySnapshot.forEach((docItem) => {
            const data = docItem.data();
            const val = Number(data.value || 0);
            totalDeliveryValue += val;
            
            const ds = data.completedAt || data.createdAt;
            const date = ds?.toDate ? ds.toDate() : (ds?.seconds ? new Date(ds.seconds * 1000) : new Date(0));

            dList.push({
              id: docItem.id,
              ...data,
              date
            });
          });

          dList.sort((a, b) => b.date - a.date);
          setDeliveriesList(dList);

          // Lojista paga 100% da corrida + 10% de taxa da plataforma
          const totalDebtCalculated = totalDeliveryValue * 1.10;

          // Fetch payments
          const paymentsQuery = query(
            collection(db, 'establishment_payments'),
            where('establishmentId', '==', user.uid),
            where('status', '==', 'approved')
          );

          unsubscribePayments = onSnapshot(paymentsQuery, (paySnapshot) => {
            let totalPaid = 0;
            const pList = [];
            paySnapshot.forEach((pDoc) => {
              const pData = pDoc.data();
              totalPaid += Number(pData.amount || 0);
              
              const ps = pData.createdAt;
              const pDate = ps?.toDate ? ps.toDate() : (ps?.seconds ? new Date(ps.seconds * 1000) : new Date(0));

              pList.push({
                id: pDoc.id,
                ...pData,
                date: pDate
              });
            });

            pList.sort((a, b) => b.date - a.date);
            setPaymentsList(pList);

            setWallet({
              totalDeliveries: dList.length,
              totalDebt: totalDebtCalculated,
              totalPaid: totalPaid,
              pendingDebt: Math.max(0, totalDebtCalculated - totalPaid)
            });

            setLoading(false);
          });
        });
      } else {
        navigate('/establishment/login');
      }
    });

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeDeliveries) unsubscribeDeliveries();
      if (unsubscribePayments) unsubscribePayments();
    };
  }, [navigate]);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--primary)' }}>
      <div style={{ width: '40px', height: '40px', border: '4px solid var(--primary-light)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div className="establishment-wallet-screen fade-in" style={{ paddingBottom: '40px' }}>
      <header style={{ 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
        marginBottom: '24px', padding: '0 4px'
      }}>
        <button onClick={() => navigate('/establishment/home')} style={{ background: 'var(--surface)', border: 'none', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)', cursor: 'pointer', color: 'var(--secondary)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '800', flex: 1, textAlign: 'center', margin: '0 12px' }}>Minha Carteira</h2>
        <div style={{ width: '40px' }}></div>
      </header>

      <div className="card" style={{ padding: '32px 24px', marginBottom: '24px', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', color: 'white', borderRadius: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '0.9rem', fontWeight: '600', opacity: 0.9, marginBottom: '8px' }}>Valor Pendente a Pagar</div>
        <div style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '8px' }}>R$ {wallet.pendingDebt.toFixed(2).replace('.', ',')}</div>
        <div style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '16px' }}>Inclui repasses aos entregadores (100%) + Taxa da Plataforma (10%)</div>
        
        <button className="btn" style={{ marginTop: '24px', width: '100%', height: '48px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '2px solid white', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }} onClick={() => alert('Por favor, faça um PIX para a chave CNPJ da plataforma e envie o comprovante no WhatsApp de suporte.')}>
          Informar Pagamento
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>Faturado Total</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>R$ {wallet.totalDebt.toFixed(2).replace('.', ',')}</div>
        </div>
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>Já Pago</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>R$ {wallet.totalPaid.toFixed(2).replace('.', ',')}</div>
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', paddingLeft: '4px' }}>Corridas Realizadas ({wallet.totalDeliveries})</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto', padding: '4px' }}>
          {deliveriesList.slice(0, 20).map((d) => (
            <div key={d.id} className="card fade-in" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--secondary)' }}>{d.deliveryAddress.split(',')[0]}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{d.date.toLocaleDateString()}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: '800', color: 'var(--primary)' }}>R$ {Number(d.value || 0).toFixed(2).replace('.', ',')}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700' }}>+ R$ {(Number(d.value || 0) * 0.1).toFixed(2)} taxa</div>
              </div>
            </div>
          ))}
          {deliveriesList.length === 0 && (
             <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Nenhuma corrida encontrada.</div>
          )}
        </div>
      </div>
      
    </div>
  );
}
