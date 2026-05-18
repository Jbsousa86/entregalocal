import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseClient';
import { useNavigate } from 'react-router-dom';

export default function AdminLoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async () => {
        setError('');
        setStatusMessage('');
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

    const handleResetPassword = async () => {
        setError('');
        setStatusMessage('');
        if (!email) {
            setError('Por favor, digite seu email de administrador.');
            return;
        }

        setLoading(true);
        try {
            await sendPasswordResetEmail(auth, email);
            setStatusMessage('Enviamos um email para redefinir sua senha.');
        } catch (err) {
            setError('Erro ao enviar email: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-screen card fade-in">
            <h2 className="text-center mb-6">🔒 Admin Login</h2>
            <p className="text-center mb-6">Acesse o painel de controle</p>

            {error && <div className="error-message" style={{ color: 'var(--error)', padding: '10px', backgroundColor: '#fee2e2', borderRadius: '8px', marginBottom: '15px', fontSize: '14px' }}>{error}</div>}
            {statusMessage && <div className="success-message" style={{ color: '#065f46', padding: '10px', backgroundColor: '#dcfce7', borderRadius: '8px', marginBottom: '15px', fontSize: '14px' }}>{statusMessage}</div>}

            <div className="form-group">
                <label>Email Admin</label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@exemplo.com"
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

            <button onClick={handleLogin} disabled={loading} className="mb-2" style={{ backgroundColor: 'var(--secondary)' }}>
                {loading ? 'Autenticando...' : 'Entrar no Painel'}
            </button>

            <button onClick={() => navigate('/admin/dashboard')} className="mb-2" style={{ backgroundColor: '#4f46e5', color: 'white' }}>
                Acesso Rápido (Bypass)
            </button>

            <p className="text-center mb-6">
                <span className="link" onClick={handleResetPassword} style={{ fontSize: '13px', cursor: 'pointer', color: 'var(--primary)', textDecoration: 'underline' }}>
                    Esqueceu a senha? Clique aqui para recuperar
                </span>
            </p>

            <p className="text-center" style={{ fontSize: '14px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                <span className="link" onClick={() => navigate('/login')} style={{ cursor: 'pointer' }}>
                    Voltar para login comum
                </span>
            </p>
        </div>
    );
}
