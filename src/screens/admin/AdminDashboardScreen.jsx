import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebaseClient';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboardScreen() {
    const [stats, setStats] = useState({
        totalDeliveries: 0,
        totalValue: 0,
        statusCounts: {},
        establishments: {},
        couriers: {},
        filteredDeliveries: []
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

        const statusCounts = {};
        let totalValue = 0;
        const establishments = {};
        const couriers = {};

        filtered.forEach(d => {
            statusCounts[d.status] = (statusCounts[d.status] || 0) + 1;
            const val = parseFloat(d.value) || 0;
            totalValue += val;

            if (d.establishmentId) {
                if (!establishments[d.establishmentId]) {
                    establishments[d.establishmentId] = { name: d.establishmentName || 'Unknown', count: 0, value: 0 };
                }
                establishments[d.establishmentId].count += 1;
                establishments[d.establishmentId].value += val;
            }

            if (d.courierId) {
                if (!couriers[d.courierId]) {
                    couriers[d.courierId] = { name: d.courierName || 'N/A', count: 0, value: 0 };
                }
                couriers[d.courierId].count += 1;
                couriers[d.courierId].value += val;
            }
        });

        return {
            totalDeliveries: filtered.length,
            totalValue,
            statusCounts,
            establishments,
            couriers,
            filteredDeliveries: filtered.sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                return dateB - dateA;
            })
        };
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

                const baseStats = calculateStats(deliveries, filter);

                // Fetch all establishments to get their delivery fees and names (keep this global)
                const estSnapshot = await getDocs(collection(db, 'establishments'));
                const establishmentMap = {};
                estSnapshot.forEach(docSnap => {
                    establishmentMap[docSnap.id] = docSnap.data();
                });

                // Merge with stats
                Object.keys(establishmentMap).forEach(estId => {
                    if (!baseStats.establishments[estId]) {
                        baseStats.establishments[estId] = { name: establishmentMap[estId].name || 'Unknown', count: 0, value: 0 };
                    }
                    baseStats.establishments[estId].deliveryFee = establishmentMap[estId].deliveryFee || 2.00;
                });

                setStats(baseStats);
            } catch (error) {
                console.error("Erro ao carregar dados admin:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        if (allDeliveries.length > 0) {
            setStats(prev => {
                const newStats = calculateStats(allDeliveries, filter);
                // Preserve deliveryFees from current state
                Object.keys(prev.establishments).forEach(id => {
                    if (newStats.establishments[id]) {
                        newStats.establishments[id].deliveryFee = prev.establishments[id].deliveryFee;
                    } else if (filter !== 'all') {
                        // If filtered out, still show in table but with 0 count? 
                        // The user said "reflitam as do período selecionado", usually meaning only show active ones or keep the list.
                        // Let's only show establishments with deliveries in that period in the summary, 
                        // BUT we need to be able to edit fees for everyone.
                        // Let's keep all establishments in the table but with filter-specific counts.
                    }
                });

                // Better approach: ensure all establishments are in the newStats
                Object.keys(prev.establishments).forEach(id => {
                    if (!newStats.establishments[id]) {
                        newStats.establishments[id] = {
                            name: prev.establishments[id].name,
                            count: 0,
                            value: 0,
                            deliveryFee: prev.establishments[id].deliveryFee
                        };
                    } else {
                        newStats.establishments[id].deliveryFee = prev.establishments[id].deliveryFee;
                    }
                });

                return newStats;
            });
        }
    }, [filter]);

    const handleLogout = async () => {
        try {
            await auth.signOut();
            navigate('/admin/login');
        } catch (error) {
            console.error("Erro ao deslogar:", error);
        }
    };

    const updateDeliveryFee = async (estId, newFee) => {
        try {
            const fee = parseFloat(newFee);
            if (isNaN(fee)) return;

            await updateDoc(doc(db, 'establishments', estId), {
                deliveryFee: fee
            });

            setStats(prev => ({
                ...prev,
                establishments: {
                    ...prev.establishments,
                    [estId]: {
                        ...prev.establishments[estId],
                        deliveryFee: fee
                    }
                }
            }));
            alert('Valor atualizado com sucesso!');
        } catch (error) {
            console.error("Erro ao atualizar valor:", error);
            alert('Erro ao atualizar valor.');
        }
    };

    if (loading) return <div className="p-8 text-center">Carregando dados globais...</div>;

    return (
        <div className="admin-dashboard fade-in" style={{ padding: '10px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                marginBottom: '30px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <h2 style={{ fontSize: '1.5rem', margin: 0 }}>📊 Painel Administrativo</h2>
                    <button onClick={handleLogout} style={{
                        backgroundColor: 'var(--error)',
                        width: 'auto',
                        padding: '10px 20px',
                        fontSize: '14px',
                        borderRadius: 'var(--radius)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>Sair</button>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px'
                }}>
                    <button
                        onClick={() => navigate('/admin/reports/establishments')}
                        style={{
                            backgroundColor: 'white',
                            color: 'var(--text)',
                            border: '1px solid var(--border)',
                            width: '100%',
                            padding: '15px',
                            fontSize: '14px',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            borderRadius: 'var(--radius)',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <span style={{ fontSize: '20px' }}>🏪</span> Relatório por Lojista
                    </button>
                    <button
                        onClick={() => navigate('/admin/reports/couriers')}
                        style={{
                            backgroundColor: 'white',
                            color: 'var(--text)',
                            border: '1px solid var(--border)',
                            width: '100%',
                            padding: '15px',
                            fontSize: '14px',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            borderRadius: 'var(--radius)',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <span style={{ fontSize: '20px' }}>🛵</span> Relatório por Entregador
                    </button>
                </div>
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <button
                    onClick={() => setFilter('today')}
                    style={{ backgroundColor: filter === 'today' ? 'var(--primary)' : '#ccc', width: 'auto', padding: '8px 15px', fontSize: '14px' }}
                >Hoje</button>
                <button
                    onClick={() => setFilter('week')}
                    style={{ backgroundColor: filter === 'week' ? 'var(--primary)' : '#ccc', width: 'auto', padding: '8px 15px', fontSize: '14px' }}
                >Esta Semana</button>
                <button
                    onClick={() => setFilter('month')}
                    style={{ backgroundColor: filter === 'month' ? 'var(--primary)' : '#ccc', width: 'auto', padding: '8px 15px', fontSize: '14px' }}
                >Este Mês</button>
                <button
                    onClick={() => setFilter('all')}
                    style={{ backgroundColor: filter === 'all' ? 'var(--primary)' : '#ccc', width: 'auto', padding: '8px 15px', fontSize: '14px' }}
                >Sempre</button>
            </div>

            {/* Resumo Geral */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '30px' }}>

                <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
                    <h3 style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Total de Entregas</h3>
                    <p style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary)' }}>{stats.totalDeliveries}</p>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
                    <h3 style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Valor Total</h3>
                    <p style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary)' }}>R$ {stats.totalValue.toFixed(2)}</p>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
                    <h3 style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Finalizadas</h3>
                    <p style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary)' }}>{stats.statusCounts['delivered'] || 0}</p>
                </div>
            </div>


            {/* Detalhamento de Entregas */}
            <div className="card" style={{ padding: '15px', marginTop: '20px' }}>
                <h3 className="mb-4" style={{ fontSize: '1.2rem' }}>📝 Detalhamento das Entregas ({filter === 'all' ? 'Sempre' : filter === 'today' ? 'Hoje' : filter === 'week' ? 'Semana' : 'Mês'})</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                                <th style={{ padding: '10px' }}>Data/Hora</th>
                                <th style={{ padding: '10px' }}>Estabelecimento</th>
                                <th style={{ padding: '10px' }}>Entregador</th>
                                <th style={{ padding: '10px' }}>Valor</th>
                                <th style={{ padding: '10px' }}>Status</th>
                                <th style={{ padding: '10px' }}>Descrição/Obs</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.filteredDeliveries.map((d, i) => {
                                const date = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
                                return (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border)', fontSize: '14px' }}>
                                        <td style={{ padding: '10px' }}>{date.toLocaleString('pt-BR')}</td>
                                        <td style={{ padding: '10px' }}>{d.establishmentName}</td>
                                        <td style={{ padding: '10px' }}>{d.courierName || '---'}</td>
                                        <td style={{ padding: '10px' }}>R$ {parseFloat(d.value).toFixed(2)}</td>
                                        <td style={{ padding: '10px' }}>
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                backgroundColor: d.status === 'delivered' ? '#d4edda' : d.status === 'pending' ? '#fff3cd' : '#e2e3e5',
                                                color: d.status === 'delivered' ? '#155724' : d.status === 'pending' ? '#856404' : '#383d41'
                                            }}>
                                                {d.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px' }}>{d.observation || '---'}</td>
                                    </tr>
                                );
                            })}
                            {stats.filteredDeliveries.length === 0 && (
                                <tr>
                                    <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>Nenhuma entrega encontrada para este período.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}

