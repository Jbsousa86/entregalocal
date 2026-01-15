import React, { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../../firebaseClient';
import { useNavigate } from 'react-router-dom';

export default function CourierProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [allDeliveries, setAllDeliveries] = useState([]);
  const [stats, setStats] = useState({ totalCount: 0, totalEarnings: 0 });
  const [filterRange, setFilterRange] = useState('all'); // all, today, week, month
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const courierRef = doc(db, 'couriers', user.uid);
          const courierSnap = await getDoc(courierRef);

          if (courierSnap.exists()) {
            setProfile(courierSnap.data());
            // Buscar todas as entregas do entregador uma única vez
            await fetchAllDeliveries(user.uid);
          } else {
            const estRef = doc(db, 'establishments', user.uid);
            const estSnap = await getDoc(estRef);
            if (estSnap.exists()) {
              navigate('/establishment/profile');
              return;
            }
          }
        } catch (error) {
          console.error("Erro ao buscar perfil:", error);
        } finally {
          setLoading(false);
        }
      } else {
        navigate('/');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const fetchAllDeliveries = async (userId) => {
    setStatsLoading(true);
    try {
      const q = query(
        collection(db, 'deliveries'),
        where('courierId', '==', userId),
        where('status', '==', 'delivered')
      );
      const querySnapshot = await getDocs(q);
      const list = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Converter Timestamp do Firebase para Date de JS
        const date = data.createdAt ? new Date(data.createdAt.seconds * 1000) : new Date(0);
        list.push({ ...data, jsDate: date });
      });
      setAllDeliveries(list);
    } catch (err) {
      console.error("Erro ao buscar entregas:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Atualizar estatísticas sempre que a lista de entregas ou o filtro mudar
  useEffect(() => {
    calculateStats();
  }, [allDeliveries, filterRange]);

  const calculateStats = () => {
    let filtered = allDeliveries;

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

      filtered = allDeliveries.filter(d => d.jsDate.getTime() >= startTime);
    }

    let count = filtered.length;
    let earnings = filtered.reduce((acc, curr) => acc + Number(curr.value || 0), 0);

    setStats({ totalCount: count, totalEarnings: earnings });
  };

  const handleImageChange = async (e) => {
    if (e.target.files[0] && auth.currentUser) {
      const file = e.target.files[0];
      setUploading(true);
      try {
        const storageRef = ref(storage, `profile_pictures/${auth.currentUser.uid}`);
        await uploadBytes(storageRef, file);
        const photoURL = await getDownloadURL(storageRef);

        const docRef = doc(db, 'couriers', auth.currentUser.uid);
        await updateDoc(docRef, { photoURL });

        setProfile({ ...profile, photoURL });
        alert('Foto atualizada com sucesso!');
      } catch (error) {
        console.error("Erro ao atualizar foto:", error);
        alert('Erro ao atualizar foto.');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  if (loading) return <p className="text-center p-10">Carregando perfil...</p>;

  return (
    <div className="courier-profile-screen card fade-in">
      <h2 className="text-center mb-6">Meu Perfil</h2>

      <div className="text-center mb-6">
        <div style={{
          width: '120px', height: '120px', borderRadius: '50%',
          backgroundColor: 'var(--background)', margin: '0 auto 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', border: '3px solid var(--primary-light)',
          position: 'relative', cursor: uploading ? 'not-allowed' : 'pointer',
          boxShadow: 'var(--shadow)'
        }} onClick={() => !uploading && document.getElementById('profilePicInput').click()}>
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="Perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '40px' }}>👤</span>
          )}
          {uploading && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(255,255,255,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 'bold', color: 'var(--primary)'
            }}>
              ...
            </div>
          )}
        </div>
        <button
          onClick={() => document.getElementById('profilePicInput').click()}
          disabled={uploading}
          style={{
            padding: '8px 16px', fontSize: '14px', width: 'auto',
            backgroundColor: 'transparent', color: 'var(--primary)',
            border: '1px solid var(--primary)', boxShadow: 'none'
          }}
        >
          {uploading ? 'Enviando...' : 'Alterar Foto'}
        </button>
        <input id="profilePicInput" type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
      </div>

      <h3 className="mb-2">Relatório de Atividades</h3>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px', opacity: statsLoading ? 0.6 : 1 }}>
        <div style={{ padding: '16px', backgroundColor: 'var(--primary-light)', borderRadius: 'var(--radius)', textAlign: 'center', border: '1px solid var(--primary)' }}>
          <p style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px' }}>Total Entregas</p>
          <p style={{ fontSize: '24px', fontWeight: '800', color: 'var(--secondary)' }}>{stats.totalCount}</p>
        </div>
        <div style={{ padding: '16px', backgroundColor: 'var(--primary-light)', borderRadius: 'var(--radius)', textAlign: 'center', border: '1px solid var(--primary)' }}>
          <p style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px' }}>Ganhos Totais</p>
          <p style={{ fontSize: '22px', fontWeight: '800', color: 'var(--secondary)' }}>R$ {stats.totalEarnings.toFixed(2)}</p>
        </div>
      </div>

      <h3 className="mb-4">Dados Pessoais</h3>
      {profile ? (
        <div className="mb-6" style={{ textAlign: 'left', padding: '20px', backgroundColor: 'var(--background)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <p className="mb-4"><strong>👤 Nome:</strong> {profile.name}</p>
          <p className="mb-4"><strong>📧 Email:</strong> {profile.email}</p>
          <p className="mb-4"><strong>📞 Telefone:</strong> {profile.phone}</p>
          <p className="mb-4"><strong>🏍️ Veículo:</strong> {profile.vehicle}</p>
          <p><strong>📍 Área:</strong> {profile.area}</p>
        </div>
      ) : (
        <div className="text-center mb-6"><p>Perfil não encontrado.</p></div>
      )}

      <button onClick={() => navigate('/courier/home')} className="mb-4">Voltar ao Início</button>
      <button onClick={() => navigate('/courier/history')} className="mb-4">Ver Histórico</button>
      <button onClick={handleLogout} style={{ backgroundColor: 'var(--error)' }}>Sair da Conta</button>
    </div>
  );
}
