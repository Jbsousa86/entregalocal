import React, { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../../firebaseClient';
import { useNavigate } from 'react-router-dom';

export default function EstablishmentProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Estados para edição
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [hours, setHours] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log("🔍 Buscando perfil para UID:", user.uid);
        try {
          // 1. Tentar buscar em estabelecimentos
          const estRef = doc(db, 'establishments', user.uid);
          const estSnap = await getDoc(estRef);

          if (estSnap.exists()) {
            console.log("✅ Perfil Estabelecimento encontrado.");
            const data = estSnap.data();
            setProfile(data);
            setName(data.name || '');
            setPhone(data.phone || '');
            setAddress(data.address || '');
            setHours(data.hours || '');
            setLoading(false);
            return;
          }

          // 2. Se não encontrou, talvez seja um entregador na página errada
          console.log("⚠️ Não encontrado em estabelecimentos. Verificando em entregadores...");
          const courierRef = doc(db, 'couriers', user.uid);
          const courierSnap = await getDoc(courierRef);

          if (courierSnap.exists()) {
            console.log("🔀 Usuário é um entregador. Redirecionando...");
            navigate('/courier/profile');
            return;
          }

          console.error("❌ Documento não encontrado em nenhuma coleção.");
        } catch (error) {
          console.error("❌ Erro ao buscar perfil:", error);
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

        // Atualizar Firestore
        const docRef = doc(db, 'establishments', auth.currentUser.uid);
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
      const docRef = doc(db, 'establishments', auth.currentUser.uid);
      await updateDoc(docRef, {
        name,
        phone,
        address,
        hours
      });
      setProfile({ ...profile, name, phone, address, hours });
      setIsEditing(false);
      alert('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      alert("Erro ao atualizar perfil.");
    }
  };

  if (loading) return <p>Carregando perfil...</p>;

  return (
    <div className="establishment-profile-screen card fade-in">
      <h2 className="text-center mb-6">Perfil do Estabelecimento</h2>

      <div className="text-center mb-6">
        <div style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          backgroundColor: 'var(--background)',
          margin: '0 auto 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          border: '3px solid var(--primary-light)',
          position: 'relative',
          cursor: uploading ? 'not-allowed' : 'pointer',
          boxShadow: 'var(--shadow)'
        }} onClick={() => !uploading && document.getElementById('establishmentPicInput').click()}>
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="Perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '40px' }}>🏪</span>
          )}
          {uploading && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255,255,255,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 'bold',
              color: 'var(--primary)'
            }}>
              ...
            </div>
          )}
        </div>
        {!isEditing && (
          <button
            onClick={() => document.getElementById('establishmentPicInput').click()}
            disabled={uploading}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              width: 'auto',
              backgroundColor: 'transparent',
              color: 'var(--primary)',
              border: '1px solid var(--primary)',
              boxShadow: 'none'
            }}
          >
            {uploading ? 'Enviando...' : 'Alterar Foto'}
          </button>
        )}
        <input
          id="establishmentPicInput"
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          style={{ display: 'none' }}
        />
      </div>

      {profile ? (
        <div className="mb-6" style={{ textAlign: 'left', padding: '20px', backgroundColor: 'var(--background)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          {isEditing ? (
            <>
              <div className="form-group mb-4">
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Nome:</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="form-group mb-4">
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Endereço:</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} />
              </div>
              <div className="form-group mb-4">
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Telefone:</label>
                <input type="text" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div className="form-group mb-6">
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Horário:</label>
                <input type="text" value={hours} onChange={e => setHours(e.target.value)} />
              </div>
              <button onClick={handleSave} className="mb-4">Salvar Alterações</button>
              <button onClick={() => setIsEditing(false)} style={{ backgroundColor: 'var(--text-muted)' }}>Cancelar</button>
            </>
          ) : (
            <>
              <p className="mb-4"><strong>🏪 Nome:</strong> {profile.name}</p>
              <p className="mb-4"><strong>📧 Email:</strong> {profile.email}</p>
              <p className="mb-4"><strong>🍔 Tipo:</strong> {profile.type}</p>
              <p className="mb-4"><strong>📍 Endereço:</strong> {profile.address}</p>
              <p className="mb-4"><strong>📞 Telefone:</strong> {profile.phone}</p>
              <p className="mb-4"><strong>⏰ Horário:</strong> {profile.hours}</p>
              <button onClick={() => setIsEditing(true)}>Editar Dados</button>
            </>
          )}
        </div>
      ) : (
        <div className="text-center mb-6">
          <p>Perfil não encontrado.</p>
        </div>
      )}

      {!isEditing && (
        <div className="fade-in">
          <button onClick={() => navigate('/establishment/home')} className="mb-4">Voltar ao Início</button>
          <button onClick={() => navigate('/establishment/in-progress')} className="mb-4">Entregas em Andamento</button>
          <button onClick={() => navigate('/establishment/history')} className="mb-4">Ver Histórico</button>
          <button onClick={handleLogout} style={{ backgroundColor: 'var(--error)' }}>Sair da Conta</button>
        </div>
      )}
    </div>
  );
}
