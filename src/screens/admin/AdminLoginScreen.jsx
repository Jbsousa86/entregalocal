import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseClient';
import { useNavigate } from 'react-router-dom';

export default function AdminLoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async () => {
        setError('');
        if (!email || !password) {
            setError('Por favor, preencha todos os campos.');
            return;
        }

        setLoading(true);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Verificar se é administrador
            const adminDoc = await getDoc(doc(db, 'admins', user.uid));
            if (adminDoc.exists()) {
                navigate('/admin/dashboard');
            } else {
                setError('Acesso negado. Você não é um administrador.');
            }
        } catch (err) {
            console.error("Erro Login Admin:", err);
            setError('Email ou senha incorretos ou erro de conexão.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-screen card fade-in">
            <h2 className="text-center mb-6">🔒 Admin Login</h2>
            <p className="text-center mb-6">Acesse o painel de controle</p>

            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
                <label>Email Admin</label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
            </div>

            <div className="form-group">
                <label>Senha</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
            </div>

            <button onClick={handleLogin} disabled={loading} className="mb-4" style={{ backgroundColor: 'var(--secondary)' }}>
                {loading ? 'Autenticando...' : 'Entrar no Painel'}
            </button>

            <p className="text-center" style={{ fontSize: '14px' }}>
                <span className="link" onClick={() => navigate('/login')}>
                    Voltar para login comum
                </span>
            </p>
        </div>
    );
}
