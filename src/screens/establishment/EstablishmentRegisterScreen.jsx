import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../../firebaseClient';

export default function EstablishmentRegisterScreen({ onRegister, onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [hours, setHours] = useState('');
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

    if (!email || !password || !name || !type || !address || !phone || !hours) {
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
      await setDoc(doc(db, 'establishments', user.uid), {
        name,
        type,
        address,
        phone,
        hours,
        email,
        photoURL,
        role: 'establishment'
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
    <div className="establishment-register-screen card fade-in">
      <h2 className="text-center mb-6">Cadastro</h2>
      {error && <div className="error-message">{error}</div>}

      <div className="text-center mb-6">
        <div style={{
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          backgroundColor: 'var(--background)',
          margin: '0 auto 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          border: '2px solid var(--border)',
          position: 'relative',
          cursor: 'pointer'
        }} onClick={() => document.getElementById('fileInput').click()}>
          {imagePreview ? (
            <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '32px' }}>📷</span>
          )}
        </div>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Foto do Estabelecimento</p>
        <input
          id="fileInput"
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          style={{ display: 'none' }}
        />
      </div>

      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} />
      <input type="text" placeholder="Nome do estabelecimento" value={name} onChange={e => setName(e.target.value)} />
      <input type="text" placeholder="Tipo (lanchonete, mercado...)" value={type} onChange={e => setType(e.target.value)} />
      <input type="text" placeholder="Endereço" value={address} onChange={e => setAddress(e.target.value)} />
      <input type="text" placeholder="Telefone" value={phone} onChange={e => setPhone(e.target.value)} />
      <input type="text" placeholder="Horário de funcionamento" value={hours} onChange={e => setHours(e.target.value)} />
      <button onClick={handleRegister} disabled={loading} className="mb-4">{loading ? 'Cadastrando...' : 'Finalizar Cadastro'}</button>
      <button onClick={onBack} disabled={loading} style={{ backgroundColor: 'var(--text-muted)' }}>Voltar</button>
    </div>
  );
}
