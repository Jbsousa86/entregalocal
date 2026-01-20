import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseClient';
import { useNavigate } from 'react-router-dom';

export default function AdminEstablishmentReport() {
    const [stats, setStats] = useState({
        establishments: {}
    });
    const [allDeliveries, setAllDeliveries] = useState([]);
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const calculateStats = (deliveries, currentFilter) => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const filtered = deliveries.filter(d => {
            if (currentFilter === 'all') return true;
            const deliveryDate = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
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

    useEffect(() => {
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

                // Merge all establishments with their stats for the period
                Object.keys(estMap).forEach(id => {
                    if (baseStats.establishments[id]) {
                        estMap[id].count = baseStats.establishments[id].count;
                        estMap[id].value = baseStats.establishments[id].value;
                    }
                });

                setStats({ establishments: estMap });
            } catch (error) {
                console.error("Erro ao carregar relatório:", error);
            } finally {
                setLoading(false);
            }
        };

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

    if (loading) return <div className="p-8 text-center">Carregando relatório de lojistas...</div>;

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
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '500px' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                                <th style={{ padding: '10px' }}>Nome</th>
                                <th style={{ padding: '10px' }}>Entregas</th>
                                <th style={{ padding: '10px' }}>Total (R$)</th>
                                <th style={{ padding: '10px' }}>Taxa Atual</th>
                                <th style={{ padding: '10px' }}>Status</th>
                                <th style={{ padding: '10px' }}>Ação</th>
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
                                            style={{ width: 'auto', padding: '5px 10px', fontSize: '12px' }}
                                        >
                                            Salvar Taxa
                                        </button>
                                        <button
                                            onClick={() => toggleBlock(id, est.isBlocked)}
                                            style={{
                                                width: 'auto',
                                                padding: '5px 10px',
                                                fontSize: '12px',
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
        </div>
    );
}
