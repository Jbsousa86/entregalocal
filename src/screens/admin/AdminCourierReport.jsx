import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseClient';
import { useNavigate } from 'react-router-dom';

export default function AdminCourierReport() {
    const [stats, setStats] = useState({
        couriers: {}
    });
    const [allDeliveries, setAllDeliveries] = useState([]);
    const [filter, setFilter] = useState('today');
    const [loading, setLoading] = useState(true);
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

        const couriers = {};

        filtered.forEach(d => {
            const val = parseFloat(d.value) || 0;
            if (d.courierId) {
                if (!couriers[d.courierId]) {
                    couriers[d.courierId] = { name: d.courierName || 'N/A', count: 0, value: 0 };
                }
                couriers[d.courierId].count += 1;
                couriers[d.courierId].value += val;
            }
        });

        return { couriers };
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

                const courierSnapshot = await getDocs(collection(db, 'couriers'));
                const courierMap = {};
                courierSnapshot.forEach(docSnap => {
                    courierMap[docSnap.id] = {
                        ...docSnap.data(),
                        count: 0,
                        value: 0
                    };
                });

                const baseStats = calculateStats(deliveries, filter);

                Object.keys(courierMap).forEach(id => {
                    if (baseStats.couriers[id]) {
                        courierMap[id].count = baseStats.couriers[id].count;
                        courierMap[id].value = baseStats.couriers[id].value;
                    }
                });

                setStats({ couriers: courierMap });
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
                const updatedCouriers = { ...prev.couriers };
                Object.keys(updatedCouriers).forEach(id => {
                    updatedCouriers[id].count = newStats.couriers[id]?.count || 0;
                    updatedCouriers[id].value = newStats.couriers[id]?.value || 0;
                });
                return { couriers: updatedCouriers };
            });
        }
    }, [filter]);

    const toggleBlock = async (courierId, currentStatus) => {
        try {
            const newStatus = !currentStatus;
            await updateDoc(doc(db, 'couriers', courierId), {
                isBlocked: newStatus
            });
            setStats(prev => ({
                couriers: {
                    ...prev.couriers,
                    [courierId]: {
                        ...prev.couriers[courierId],
                        isBlocked: newStatus
                    }
                }
            }));
            alert(`Entregador ${newStatus ? 'bloqueado' : 'desbloqueado'} com sucesso!`);
        } catch (error) {
            console.error(error);
            alert('Erro ao alterar status.');
        }
    };

    if (loading) return <div className="p-8 text-center">Carregando relatório de entregadores...</div>;

    return (
        <div className="admin-report fade-in" style={{ padding: '15px', maxWidth: '800px', margin: '0 auto' }}>
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
                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>🛵 Relatório por Entregador</h2>
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
                                <th>Nome do Entregador</th>
                                <th>Entregas</th>
                                <th>Total Gerado (R$)</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(stats.couriers).map(([id, courier], i) => (
                                <tr key={id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '10px' }}>{courier.name}</td>
                                    <td style={{ padding: '10px' }}>{courier.count}</td>
                                    <td style={{ padding: '10px' }}>{courier.value.toFixed(2)}</td>
                                    <td style={{ padding: '10px' }}>
                                        <span style={{
                                            color: courier.isBlocked ? 'var(--error)' : '#28a745',
                                            fontWeight: 'bold',
                                            fontSize: '12px'
                                        }}>
                                            {courier.isBlocked ? 'Bloqueado' : 'Ativo'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px' }}>
                                        <button
                                            onClick={() => toggleBlock(id, courier.isBlocked)}
                                            style={{
                                                width: 'auto',
                                                padding: '8px 16px',
                                                fontSize: '12px',
                                                borderRadius: 'var(--radius)',
                                                backgroundColor: courier.isBlocked ? '#28a745' : 'var(--error)'
                                            }}
                                        >
                                            {courier.isBlocked ? 'Desbloquear' : 'Bloquear'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {Object.entries(stats.couriers).length === 0 && (
                                <tr>
                                    <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                                        Nenhum entregador cadastrado encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
