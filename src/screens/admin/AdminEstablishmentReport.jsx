import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebaseClient';
import { useNavigate } from 'react-router-dom';

export default function AdminEstablishmentReport() {
    const [stats, setStats] = useState({
        establishments: {}
    });
    const [allDeliveries, setAllDeliveries] = useState([]);
    const [filter, setFilter] = useState('today');
    const [loading, setLoading] = useState(true);
    const [establishmentPayments, setEstablishmentPayments] = useState([]);
    const [paymentAmount, setPaymentAmount] = useState({});
    const navigate = useNavigate();

    const calculateStats = (deliveries, currentFilter) => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const filtered = deliveries.filter(d => {
            if (currentFilter === 'all') return true;
            
            const dateSource = (d.status === 'delivered' && d.completedAt) ? d.completedAt : d.createdAt;
            if (!dateSource) return false;

            const deliveryDate = dateSource.toDate ? dateSource.toDate() : new Date(dateSource.seconds ? dateSource.seconds * 1000 : dateSource);
            
            if (currentFilter === 'today') return deliveryDate >= startOfToday;
            if (currentFilter === 'week') return deliveryDate >= last7Days;
            if (currentFilter === 'month') return deliveryDate >= last30Days;
            return true;
        });

        const establishments = {};

        filtered.forEach(d => {
            const val = parseFloat(d.value) || 0;
            if (d.establishmentId) {
                if (!establishments[d.establishmentId]) {
                    establishments[d.establishmentId] = { name: d.establishmentName || 'Unknown', count: 0, value: 0 };
                }
                establishments[d.establishmentId].count += 1;
                establishments[d.establishmentId].value += val;
            }
        });

        return { establishments };
    };

    const fetchData = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'deliveries'));
            const deliveries = [];
            querySnapshot.forEach((doc) => {
                deliveries.push({ id: doc.id, ...doc.data() });
            });
            setAllDeliveries(deliveries);

            const estSnapshot = await getDocs(collection(db, 'establishments'));
            const estMap = {};
            estSnapshot.forEach(docSnap => {
                estMap[docSnap.id] = {
                    ...docSnap.data(),
                    count: 0,
                    value: 0
                };
            });

            const baseStats = calculateStats(deliveries, filter);

            Object.keys(estMap).forEach(id => {
                if (baseStats.establishments[id]) {
                    estMap[id].count = baseStats.establishments[id].count;
                    estMap[id].value = baseStats.establishments[id].value;
                }
            });

            const pSnapshot = await getDocs(collection(db, 'establishment_payments'));
            const pList = [];
            pSnapshot.forEach(docSnap => {
                pList.push({ id: docSnap.id, ...docSnap.data() });
            });
            setEstablishmentPayments(pList);

            setStats({ establishments: estMap });
        } catch (error) {
            console.error("Erro ao carregar relatório:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (allDeliveries.length > 0) {
            const newStats = calculateStats(allDeliveries, filter);
            setStats(prev => {
                const updatedEsts = { ...prev.establishments };
                Object.keys(updatedEsts).forEach(id => {
                    updatedEsts[id].count = newStats.establishments[id]?.count || 0;
                    updatedEsts[id].value = newStats.establishments[id]?.value || 0;
                });
                return { establishments: updatedEsts };
            });
        }
    }, [filter]);

    const updateDeliveryFee = async (estId, newFee) => {
        try {
            const fee = parseFloat(newFee);
            if (isNaN(fee)) return;

            await updateDoc(doc(db, 'establishments', estId), {
                deliveryFee: fee
            });

            setStats(prev => ({
                establishments: {
                    ...prev.establishments,
                    [estId]: {
                        ...prev.establishments[estId],
                        deliveryFee: fee
                    }
                }
            }));
            alert('Taxa atualizada!');
        } catch (error) {
            console.error(error);
            alert('Erro ao atualizar.');
        }
    };

    const toggleBlock = async (estId, currentStatus) => {
        try {
            const newStatus = !currentStatus;
            await updateDoc(doc(db, 'establishments', estId), {
                isBlocked: newStatus
            });
            setStats(prev => ({
                establishments: {
                    ...prev.establishments,
                    [estId]: {
                        ...prev.establishments[estId],
                        isBlocked: newStatus
                    }
                }
            }));
            alert(`Estabelecimento ${newStatus ? 'bloqueado' : 'desbloqueado'} com sucesso!`);
        } catch (error) {
            console.error(error);
            alert('Erro ao alterar status de bloqueio.');
        }
    };

    const handleUpdatePaymentStatus = async (paymentId, newStatus) => {
        try {
            await updateDoc(doc(db, 'establishment_payments', paymentId), {
                status: newStatus
            });
            alert(`Pagamento ${newStatus === 'approved' ? 'aprovado' : 'rejeitado'}!`);
            fetchData(); // Refresh to update balances
        } catch (error) {
            console.error(error);
            alert("Erro ao atualizar pagamento.");
        }
    };

    const handleRecordPayment = async (estId) => {
        try {
            const amount = parseFloat(paymentAmount[estId]);
            if (isNaN(amount) || amount <= 0) {
                alert("Por favor, insira um valor válido.");
                return;
            }

            await addDoc(collection(db, 'establishment_payments'), {
                establishmentId: estId,
                establishmentName: stats.establishments[estId]?.name || 'Lojista',
                amount: amount,
                status: 'approved',
                createdAt: serverTimestamp()
            });

            alert("Pagamento direto registrado e aprovado!");
            setPaymentAmount(prev => ({ ...prev, [estId]: '' }));
            fetchData();
        } catch (error) {
            console.error("Erro ao registrar pagamento:", error);
            alert("Erro ao registrar pagamento.");
        }
    };

    if (loading) return <div className="p-8 text-center">Carregando relatório de lojistas...</div>;

    const pendingPayments = establishmentPayments.filter(p => p.status === 'pending');
    const recentPayments = establishmentPayments.filter(p => p.status !== 'pending');

    return (
        <div className="admin-report fade-in" style={{ padding: '15px', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '15px',
                marginBottom: '25px'
            }}>
                <button
                    onClick={() => navigate('/admin/dashboard')}
                    style={{
                        width: 'fit-content',
                        padding: '8px 16px',
                        backgroundColor: 'var(--background)',
                        color: 'var(--text)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        fontSize: '14px'
                    }}
                >
                    ⬅ Voltar ao Painel
                </button>
                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>🏪 Relatório por Lojista</h2>
            </div>

            {/* Filtros */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '10px',
                marginBottom: '20px'
            }}>
                {[
                    { id: 'today', label: 'Hoje' },
                    { id: 'week', label: 'Semana' },
                    { id: 'month', label: 'Mês' },
                    { id: 'all', label: 'Tudo' }
                ].map(f => (
                    <button
                        key={f.id}
                        onClick={() => setFilter(f.id)}
                        style={{
                            backgroundColor: filter === f.id ? 'var(--primary)' : 'white',
                            color: filter === f.id ? 'white' : 'var(--text)',
                            border: `1px solid ${filter === f.id ? 'var(--primary)' : 'var(--border)'}`,
                            width: '100%',
                            padding: '12px',
                            fontSize: '14px',
                            fontWeight: '500',
                            borderRadius: 'var(--radius)',
                            boxShadow: filter === f.id ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                        }}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="card" style={{ padding: '15px' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Nome do Estabelecimento</th>
                                <th>Entregas</th>
                                <th>Total (R$)</th>
                                <th>Taxa Atual</th>
                                <th>Status</th>
                                <th>Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(stats.establishments).map(([id, est], i) => (
                                <tr key={id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '10px' }}>{est.name}</td>
                                    <td style={{ padding: '10px' }}>{est.count}</td>
                                    <td style={{ padding: '10px' }}>{est.value.toFixed(2)}</td>
                                    <td style={{ padding: '10px' }}>
                                        <input
                                            type="number"
                                            defaultValue={est.deliveryFee || 2}
                                            style={{ width: '60px', padding: '4px' }}
                                            onBlur={(e) => est.tempFee = e.target.value}
                                        />
                                    </td>
                                    <td style={{ padding: '10px' }}>
                                        <span style={{
                                            color: est.isBlocked ? 'var(--error)' : '#28a745',
                                            fontWeight: 'bold',
                                            fontSize: '12px'
                                        }}>
                                            {est.isBlocked ? 'Bloqueado' : 'Ativo'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        <button
                                            onClick={() => updateDeliveryFee(id, est.tempFee || est.deliveryFee)}
                                            style={{ width: 'auto', padding: '5px 12px', fontSize: '12px', borderRadius: 'var(--radius)' }}
                                        >
                                            Salvar Taxa
                                        </button>
                                        <button
                                            onClick={() => toggleBlock(id, est.isBlocked)}
                                            style={{
                                                width: 'auto',
                                                padding: '5px 12px',
                                                fontSize: '12px',
                                                borderRadius: 'var(--radius)',
                                                backgroundColor: est.isBlocked ? '#28a745' : 'var(--error)'
                                            }}
                                        >
                                            {est.isBlocked ? 'Desbloquear' : 'Bloquear'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagamentos Pendentes */}
            {pendingPayments.length > 0 && (
                <div className="card" style={{ padding: '15px', marginTop: '30px', border: '2px solid var(--primary)' }}>
                    <h3 className="mb-4" style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                        🔔 Pagamentos Aguardando Confirmação
                    </h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Lojista</th>
                                    <th>Valor Informado</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingPayments.map((p, i) => {
                                    const date = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt?.seconds * 1000 || 0);
                                    return (
                                        <tr key={i}>
                                            <td>{date.toLocaleDateString('pt-BR')} {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                                            <td style={{ fontWeight: 'bold' }}>{p.establishmentName || 'Lojista'}</td>
                                            <td style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '1.1rem' }}>R$ {parseFloat(p.amount).toFixed(2)}</td>
                                            <td style={{ display: 'flex', gap: '8px' }}>
                                                <button onClick={() => handleUpdatePaymentStatus(p.id, 'approved')} style={{ background: 'var(--success)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Confirmar Recebimento</button>
                                                <button onClick={() => handleUpdatePaymentStatus(p.id, 'rejected')} style={{ background: 'var(--error)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Rejeitar</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="card" style={{ padding: '15px', marginTop: '30px' }}>
                <h3 className="mb-4" style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    💰 Gestão de Dívidas e Acertos
                </h3>
                <div style={{ overflowX: 'auto' }}>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Lojista</th>
                                <th>Total Devido (110%)</th>
                                <th>Total Pago</th>
                                <th>Saldo Devedor</th>
                                <th>Baixa Direta (R$)</th>
                                <th>Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(stats.establishments).map(([id, est]) => {
                                const totalDebt = est.value * 1.10;
                                const totalPaid = establishmentPayments
                                    .filter(p => p.establishmentId === id && p.status === 'approved')
                                    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                                const pending = Math.max(0, totalDebt - totalPaid);

                                return (
                                    <tr key={id}>
                                        <td style={{ fontWeight: 'bold' }}>{est.name}</td>
                                        <td style={{ color: 'var(--error)', fontWeight: 'bold' }}>R$ {totalDebt.toFixed(2)}</td>
                                        <td style={{ color: 'var(--success)', fontWeight: 'bold' }}>R$ {totalPaid.toFixed(2)}</td>
                                        <td>
                                            <span style={{
                                                padding: '4px 8px',
                                                borderRadius: '8px',
                                                backgroundColor: pending > 0 ? '#fff3cd' : '#d4edda',
                                                color: pending > 0 ? '#856404' : '#155724',
                                                fontWeight: 'bold'
                                            }}>
                                                R$ {pending.toFixed(2)}
                                            </span>
                                        </td>
                                        <td>
                                            <input 
                                                type="number" 
                                                placeholder="0.00"
                                                value={paymentAmount[id] || ''}
                                                onChange={(e) => setPaymentAmount(prev => ({ ...prev, [id]: e.target.value }))}
                                                style={{ width: '100px', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }}
                                            />
                                        </td>
                                        <td>
                                            <button 
                                                onClick={() => handleRecordPayment(id)}
                                                style={{ background: 'var(--success)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                                            >
                                                Baixar
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="card" style={{ padding: '15px', marginTop: '30px' }}>
                <h3 className="mb-4" style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📜 Histórico de Pagamentos (Aprovados/Rejeitados)
                </h3>
                <div style={{ overflowX: 'auto' }}>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Lojista</th>
                                <th>Valor Pago</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentPayments.slice().sort((a,b) => {
                                const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt?.seconds * 1000 || 0);
                                const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt?.seconds * 1000 || 0);
                                return db - da;
                            }).slice(0, 15).map((p, i) => {
                                const date = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt?.seconds * 1000 || 0);
                                const estName = stats.establishments[p.establishmentId]?.name || p.establishmentName || 'Lojista';
                                return (
                                    <tr key={i}>
                                        <td>{date.toLocaleDateString('pt-BR')} {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td>{estName}</td>
                                        <td style={{ color: p.status === 'approved' ? 'var(--success)' : 'var(--error)', fontWeight: 'bold' }}>R$ {parseFloat(p.amount).toFixed(2)}</td>
                                        <td>
                                            <span style={{ 
                                                fontSize: '11px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px',
                                                backgroundColor: p.status === 'approved' ? '#d4edda' : '#f8d7da',
                                                color: p.status === 'approved' ? '#155724' : '#721c24'
                                            }}>
                                                {p.status === 'approved' ? 'APROVADO' : 'REJEITADO'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="card" style={{ padding: '15px', marginTop: '30px' }}>
                <h3 className="mb-4" style={{ fontSize: '1.2rem' }}>📝 Detalhamento de Entregas (Lojistas)</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Data/Hora</th>
                                <th>Lojista</th>
                                <th>Entregador</th>
                                <th>Valor</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allDeliveries
                                .filter(d => {
                                    if (filter === 'all') return true;
                                    const dateSource = (d.status === 'delivered' && d.completedAt) ? d.completedAt : d.createdAt;
                                    if (!dateSource) return false;
                                    const deliveryDate = dateSource.toDate ? dateSource.toDate() : new Date(dateSource.seconds ? dateSource.seconds * 1000 : dateSource);
                                    const now = new Date();
                                    if (filter === 'today') return deliveryDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                    if (filter === 'week') return deliveryDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                                    if (filter === 'month') return deliveryDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                                    return true;
                                })
                                .sort((a,b) => {
                                    const ta = (a.completedAt || a.createdAt)?.seconds || 0;
                                    const tb = (b.completedAt || b.createdAt)?.seconds || 0;
                                    return tb - ta;
                                })
                                .slice(0, 50)
                                .map((d, i) => {
                                    const ds = d.completedAt || d.createdAt;
                                    const date = ds?.toDate ? ds.toDate() : new Date(ds?.seconds * 1000 || 0);
                                    return (
                                        <tr key={i} style={{ fontSize: '13px' }}>
                                            <td>{date.toLocaleDateString('pt-BR')} {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                                            <td style={{ fontWeight: 'bold' }}>{d.establishmentName}</td>
                                            <td>{d.courierName || '---'}</td>
                                            <td style={{ fontWeight: 'bold' }}>R$ {parseFloat(d.value).toFixed(2)}</td>
                                            <td>
                                                <span style={{ 
                                                    padding: '2px 6px', 
                                                    borderRadius: '4px', 
                                                    fontSize: '11px',
                                                    backgroundColor: d.status === 'delivered' ? '#d4edda' : '#eee' 
                                                }}>{d.status}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
