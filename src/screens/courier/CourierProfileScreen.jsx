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
          disabled={uploading || isEditing}
          style={{
            padding: '8px 16px', fontSize: '14px', width: 'auto',
            backgroundColor: 'transparent', color: isEditing ? 'var(--text-muted)' : 'var(--primary)',
            border: `1px solid ${isEditing ? 'var(--border)' : 'var(--primary)'}`, boxShadow: 'none',
            cursor: isEditing ? 'not-allowed' : 'pointer'
          }}
        >
          {uploading ? 'Enviando...' : 'Alterar Foto'}
        </button>
        <input id="profilePicInput" type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
      </div>


      <h3 className="mb-4">Dados Pessoais</h3>
      {profile ? (
        <div className="mb-6" style={{ textAlign: 'left', padding: '20px', backgroundColor: 'var(--background)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          {isEditing ? (
            <>
              <div className="form-group mb-4">
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Nome:</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="form-group mb-6">
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Telefone:</label>
                <input type="text" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <button onClick={handleSave} className="mb-4">Salvar Alterações</button>
              <button onClick={() => setIsEditing(false)} style={{ backgroundColor: 'var(--text-muted)' }}>Cancelar</button>
            </>
          ) : (
            <>
              <p className="mb-4"><strong>👤 Nome:</strong> {profile.name}</p>
              <p className="mb-4"><strong>📧 Email:</strong> {profile.email}</p>
              <p className="mb-4"><strong>📞 Telefone:</strong> {profile.phone}</p>
              <p className="mb-4"><strong>🏍️ Veículo:</strong> {profile.vehicle}</p>
              <p className="mb-4"><strong>📍 Área de Atuação:</strong> {profile.area}</p>
              <button onClick={() => setIsEditing(true)}>Editar Dados</button>
            </>
          )}
        </div>
      ) : (
        <div className="text-center mb-6"><p>Perfil não encontrado.</p></div>
      )}

      {!isEditing && (
        <>
          <button onClick={() => navigate('/courier/home')} className="mb-4">Voltar ao Início</button>
          <button onClick={handleLogout} style={{ backgroundColor: 'var(--error)' }}>Sair da Conta</button>
        </>
      )}
    </div>
  );
}
