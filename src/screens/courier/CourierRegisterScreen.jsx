import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../../firebaseClient';

export default function CourierRegisterScreen({ onRegister, onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [area, setArea] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e) => {
    if (e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleRegister = async () => {
    setError('');

    if (!email || !password || !name || !phone || !vehicle || !area) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      console.log("1. Criando usuário no Auth...");
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("2. Usuário criado. UID:", user.uid);

      let photoURL = '';
      if (image) {
        try {
          console.log("3. Fazendo upload da imagem...");
          const storageRef = ref(storage, `profile_pictures/${user.uid}`);
          await uploadBytes(storageRef, image);
          photoURL = await getDownloadURL(storageRef);
          console.log("4. Upload concluído. URL:", photoURL);
        } catch (uploadErr) {
          console.error("⚠️ Erro de upload (CORS?):", uploadErr);
          // O cadastro continuará sem a foto se houver erro de CORS
        }
      }

      // Salvar dados adicionais no Firestore
      console.log("5. Salvando dados no Firestore...");
      await setDoc(doc(db, 'couriers', user.uid), {
        name,
        phone,
        vehicle,
        area,
        email,
        photoURL,
        role: 'courier'
      });
      console.log("6. Dados salvos com sucesso.");

      onRegister();
    } catch (err) {
      console.error("Erro no cadastro:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este email já está em uso.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('O login por email/senha não está habilitado no Firebase Console.');
      } else {
        setError('Erro ao cadastrar: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="courier-register-screen fade-in" style={{ padding: '20px 0' }}>
      <div className="card" style={{ padding: '32px 24px' }}>
        <header style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--secondary)' }}>Dados de Cadastro</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Torne-se um entregador parceiro agora mesmo.</p>
        </header>

        {error && (
          <div style={{ 
            backgroundColor: '#fef2f2', 
            color: 'var(--error)', 
            padding: '12px 16px', 
            borderRadius: '12px', 
            fontSize: '0.85rem', 
            fontWeight: '600', 
            marginBottom: '24px',
            border: '1px solid #fee2e2'
          }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '100px',
            height: '100px',
            borderRadius: '30px',
            backgroundColor: 'var(--background)',
            margin: '0 auto 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            border: '2px dashed var(--primary)',
            position: 'relative',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }} onClick={() => document.getElementById('fileInput').click()}>
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '32px', display: 'block' }}>📸</span>
                <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase' }}>Foto</span>
              </div>
            )}
          </div>
          <input
            id="fileInput"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            style={{ display: 'none' }}
          />
        </div>

        <div className="form-group">
          <label>Email Profissional</label>
          <input type="email" placeholder="exemplo@email.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>

        <div className="form-group">
          <label>Senha de Acesso</label>
          <input type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} />
        </div>

        <div className="form-group">
          <label>Nome Completo</label>
          <input type="text" placeholder="Como quer ser chamado?" value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div className="form-group">
          <label>Telefone / WhatsApp</label>
          <input type="text" placeholder="(00) 00000-0000" value={phone} onChange={e => setPhone(e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group">
            <label>Veículo</label>
            <input type="text" placeholder="Ex: Moto, Bike" value={vehicle} onChange={e => setVehicle(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Cidade/Área</label>
            <input type="text" placeholder="Ex: Centro" value={area} onChange={e => setArea(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
          <button 
            onClick={handleRegister} 
            disabled={loading} 
            className="btn"
            style={{ height: '55px', fontSize: '1rem' }}
          >
            {loading ? 'Processando Cadastro...' : 'Finalizar Cadastro'}
          </button>
          
          <button 
            onClick={onBack} 
            disabled={loading} 
            className="btn btn-secondary"
            style={{ height: '50px' }}
          >
            Voltar para Login
          </button>
        </div>
      </div>
    </div>
  );
}

