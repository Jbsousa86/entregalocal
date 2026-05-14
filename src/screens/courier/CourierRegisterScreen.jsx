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
    <div className="register-screen courier-register-screen fade-in">
      <div className="card">
        <header className="card-header">
          <h2>Dados de Cadastro</h2>
          <p>Torne-se um entregador parceiro agora mesmo.</p>
        </header>

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        <div className="picture-upload">
          <button type="button" className="avatar-upload" onClick={() => document.getElementById('fileInput').click()}>
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" />
            ) : (
              <div className="avatar-placeholder">
                <span>📸</span>
                <strong>Upload</strong>
              </div>
            )}
          </button>
          <p className="avatar-caption">Foto do perfil (opcional)</p>
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

          <div className="form-group">
            <label>Veículo</label>
            <input type="text" placeholder="Ex: Moto, Bike" value={vehicle} onChange={e => setVehicle(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Cidade/Área</label>
            <input type="text" placeholder="Ex: Centro" value={area} onChange={e => setArea(e.target.value)} />
          </div>
        </div>

        <div className="form-actions">
          <button onClick={handleRegister} disabled={loading} className="btn">
            {loading ? 'Processando Cadastro...' : 'Finalizar Cadastro'}
          </button>
          <button onClick={onBack} disabled={loading} className="btn btn-secondary">
            Voltar para Login
          </button>
        </div>
      </div>
    </div>
  );
}

