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
    <div className="register-screen establishment-register-screen fade-in">
      <div className="card">
        <header className="card-header">
          <h2>Cadastro</h2>
          <p>Cadastre seu estabelecimento e comece a receber pedidos.</p>
        </header>

        {error && <div className="error-message">{error}</div>}

        <div className="picture-upload">
          <button type="button" className="avatar-upload" onClick={() => document.getElementById('fileInput').click()}>
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" />
            ) : (
              <span className="avatar-placeholder">📷</span>
            )}
          </button>
          <p className="avatar-caption">Foto do estabelecimento</p>
          <input
            id="fileInput"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            style={{ display: 'none' }}
          />
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>Email</label>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Senha</label>
            <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Nome do estabelecimento</label>
            <input type="text" placeholder="Nome do estabelecimento" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Tipo</label>
            <input type="text" placeholder="Tipo (lanchonete, mercado...)" value={type} onChange={e => setType(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Endereço</label>
            <input type="text" placeholder="Endereço" value={address} onChange={e => setAddress(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Telefone</label>
            <input type="text" placeholder="Telefone" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Horário de funcionamento</label>
            <input type="text" placeholder="Horário de funcionamento" value={hours} onChange={e => setHours(e.target.value)} />
          </div>
        </div>

        <div className="form-actions">
          <button onClick={handleRegister} disabled={loading} className="btn">
            {loading ? 'Cadastrando...' : 'Finalizar Cadastro'}
          </button>
          <button onClick={onBack} disabled={loading} className="btn btn-secondary">
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
