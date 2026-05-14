import React, { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../../firebaseClient';
import { useNavigate } from 'react-router-dom';

export default function CourierProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Estados para edição
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [area, setArea] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const courierRef = doc(db, 'couriers', user.uid);
          const courierSnap = await getDoc(courierRef);

          if (courierSnap.exists()) {
            const data = courierSnap.data();
            setProfile(data);
            setName(data.name || '');
            setPhone(data.phone || '');
            setVehicle(data.vehicle || '');
            setArea(data.area || '');
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

  const handleSave = async () => {
    if (!auth.currentUser) return;
    try {
      const docRef = doc(db, 'couriers', auth.currentUser.uid);
      await updateDoc(docRef, {
        name,
        phone
      });
      setProfile({ ...profile, name, phone });
      setIsEditing(false);
      alert('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      alert("Erro ao atualizar perfil.");
    }
  };

  if (loading) return <p className="text-center p-10">Carregando perfil...</p>;

    if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--primary)' }}>
      <div style={{ width: '40px', height: '40px', border: '4px solid var(--primary-light)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div className="courier-profile-screen fade-in" style={{ paddingBottom: '40px' }}>
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
          Configurações de Perfil
        </h2>
        <button 
          onClick={handleLogout}
          style={{ 
            background: 'var(--error)', 
            border: 'none', 
            borderRadius: '12px', 
            width: '40px', 
            height: '40px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
            color: 'white'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>
          </svg>
        </button>
      </header>

      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ 
          height: '100px', 
          background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
          position: 'relative'
        }}></div>
        
        <div style={{ padding: '0 24px 30px', marginTop: '-50px', textAlign: 'center' }}>
          <div style={{
            width: '100px',
            height: '100px',
            borderRadius: '30px',
            backgroundColor: 'var(--surface)',
            margin: '0 auto 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            border: '5px solid var(--surface)',
            boxShadow: 'var(--shadow-lg)',
            position: 'relative',
            cursor: uploading ? 'not-allowed' : 'pointer',
          }} onClick={() => !uploading && document.getElementById('profilePicInput').click()}>
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="Perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '40px' }}>👤</span>
            )}
            {uploading && (
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(255,255,255,0.8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <div style={{ width: '20px', height: '20px', border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
              </div>
            )}
            <div style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0,
              background: 'rgba(0,0,0,0.5)',
              padding: '4px',
              color: 'white',
              fontSize: '10px',
              fontWeight: '700'
            }}>
              ALTERAR
            </div>
          </div>
          <input id="profilePicInput" type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />

          <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{profile?.name}</h2>
          <div className="badge badge-primary">Entregador Parceiro</div>

          <div style={{ marginTop: '30px', textAlign: 'left' }}>
            {isEditing ? (
              <div className="fade-in">
                <div className="form-group">
                  <label>Nome Completo</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Telefone / WhatsApp</label>
                  <input type="text" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '30px' }}>
                  <button onClick={handleSave} className="btn" style={{ flex: 2 }}>Salvar</button>
                  <button onClick={() => setIsEditing(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ color: 'var(--primary)', paddingTop: '4px' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </div>
                  <div>
                    <label style={{ padding: 0, marginBottom: '2px', color: 'var(--text-muted)' }}>Contato</label>
                    <div style={{ fontWeight: '500' }}>{profile?.phone || 'Não informado'}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ color: 'var(--primary)', paddingTop: '4px' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 12 16 14"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                  </div>
                  <div>
                    <label style={{ padding: 0, marginBottom: '2px', color: 'var(--text-muted)' }}>Veículo</label>
                    <div style={{ fontWeight: '500' }}>{profile?.vehicle || 'Não informado'}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ color: 'var(--primary)', paddingTop: '4px' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  </div>
                  <div>
                    <label style={{ padding: 0, marginBottom: '2px', color: 'var(--text-muted)' }}>Área de Atuação</label>
                    <div style={{ fontWeight: '500' }}>{profile?.area || 'Não informado'}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ color: 'var(--primary)', paddingTop: '4px' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  </div>
                  <div>
                    <label style={{ padding: 0, marginBottom: '2px', color: 'var(--text-muted)' }}>Email</label>
                    <div style={{ fontWeight: '500' }}>{profile?.email}</div>
                  </div>
                </div>

                <button onClick={() => setIsEditing(true)} className="btn btn-outline" style={{ marginTop: '20px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Editar Perfil
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
