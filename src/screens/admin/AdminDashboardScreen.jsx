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
        filteredDeliveries: [],
        totalRegistrations: 0,
        totalEstablishments: 0,
        totalCouriers: 0
    });
    const [allDeliveries, setAllDeliveries] = useState([]);
    const [withdrawals, setWithdrawals] = useState([]);
    const [couriersData, setCouriersData] = useState({});
    const [filter, setFilter] = useState('today');
    const [loading, setLoading] = useState(true);
    const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
    const navigate = useNavigate();

    const calculateStats = (deliveries, currentFilter) => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const filtered = deliveries.filter(d => {
            if (currentFilter === 'all') return true;
            
            // Priorizar data de finalização para relatórios históricos
            const dateSource = (d.status === 'delivered' && d.completedAt) ? d.completedAt : d.createdAt;
            if (!dateSource) return false;

            const deliveryDate = dateSource.toDate ? dateSource.toDate() : new Date(dateSource.seconds ? dateSource.seconds * 1000 : dateSource);
            
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
                const dateA_source = (a.status === 'delivered' && a.completedAt) ? a.completedAt : a.createdAt;
                const dateB_source = (b.status === 'delivered' && b.completedAt) ? b.completedAt : b.createdAt;
                
                const timeA = dateA_source?.toDate ? dateA_source.toDate().getTime() : 0;
                const timeB = dateB_source?.toDate ? dateB_source.toDate().getTime() : 0;
                
                return timeB - timeA;
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

                // Fetch all couriers to count os entregadores cadastrados e mapear nomes
                const courierSnapshot = await getDocs(collection(db, 'couriers'));
                const courierMap = {};
                courierSnapshot.forEach(docSnap => {
                    courierMap[docSnap.id] = docSnap.data();
                });
                setCouriersData(courierMap);

                // Fetch withdrawals
                const wSnapshot = await getDocs(collection(db, 'withdrawals'));
                const wList = [];
                wSnapshot.forEach(docSnap => {
                    wList.push({ id: docSnap.id, ...docSnap.data() });
                });
                wList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                setWithdrawals(wList);

                // Merge with stats
                Object.keys(establishmentMap).forEach(estId => {
                    if (!baseStats.establishments[estId]) {
                        baseStats.establishments[estId] = { name: establishmentMap[estId].name || 'Unknown', count: 0, value: 0 };
                    }
                    baseStats.establishments[estId].deliveryFee = establishmentMap[estId].deliveryFee || 2.00;
                });

                setStats({
                    ...baseStats,
                    totalEstablishments: Object.keys(establishmentMap).length,
                    totalCouriers: Object.keys(courierMap).length,
                    totalRegistrations: Object.keys(establishmentMap).length + Object.keys(courierMap).length
                });
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

                return {
                    ...newStats,
                    totalEstablishments: prev.totalEstablishments,
                    totalCouriers: prev.totalCouriers,
                    totalRegistrations: prev.totalRegistrations
                };
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

    const handleUpdateWithdrawalStatus = async (id, newStatus) => {
        try {
            await updateDoc(doc(db, 'withdrawals', id), {
                status: newStatus
            });
            setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: newStatus } : w));
            alert(`Saque marcado como ${newStatus === 'completed' ? 'concluído' : 'rejeitado'}!`);
            if (selectedWithdrawal && selectedWithdrawal.id === id) {
                setSelectedWithdrawal(null);
            }
        } catch (error) {
            console.error("Erro ao atualizar saque:", error);
            alert("Erro ao atualizar status do saque.");
        }
    };

    const handlePrintCourierReport = () => {
        window.print();
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
                        style={{ 
                            backgroundColor: filter === 'today' ? 'var(--primary)' : '#ccc', 
                            width: 'auto', 
                            padding: '8px 20px', 
                            fontSize: '14px',
                            borderRadius: 'var(--radius-full)',
                            border: 'none',
                            color: 'white',
                            fontWeight: '600'
                        }}
                    >Hoje</button>
                    <button
                        onClick={() => setFilter('week')}
                        style={{ 
                            backgroundColor: filter === 'week' ? 'var(--primary)' : '#ccc', 
                            width: 'auto', 
                            padding: '8px 20px', 
                            fontSize: '14px',
                            borderRadius: 'var(--radius-full)',
                            border: 'none',
                            color: 'white',
                            fontWeight: '600'
                        }}
                    >Esta Semana</button>
                    <button
                        onClick={() => setFilter('month')}
                        style={{ 
                            backgroundColor: filter === 'month' ? 'var(--primary)' : '#ccc', 
                            width: 'auto', 
                            padding: '8px 20px', 
                            fontSize: '14px',
                            borderRadius: 'var(--radius-full)',
                            border: 'none',
                            color: 'white',
                            fontWeight: '600'
                        }}
                    >Este Mês</button>
                    <button
                        onClick={() => setFilter('all')}
                        style={{ 
                            backgroundColor: filter === 'all' ? 'var(--primary)' : '#ccc', 
                            width: 'auto', 
                            padding: '8px 20px', 
                            fontSize: '14px',
                            borderRadius: 'var(--radius-full)',
                            border: 'none',
                            color: 'white',
                            fontWeight: '600'
                        }}
                    >Sempre</button>
            </div>

            {/* Resumo Geral */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '30px' }}>
                <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
                    <h3 style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Cadastros Totais</h3>
                    <p style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary)' }}>{stats.totalRegistrations}</p>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
                    <h3 style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Lojistas</h3>
                    <p style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary)' }}>{stats.totalEstablishments}</p>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
                    <h3 style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Entregadores</h3>
                    <p style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary)' }}>{stats.totalCouriers}</p>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
                    <h3 style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Total de Entregas</h3>
                    <p style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary)' }}>{stats.totalDeliveries}</p>
                </div>
            </div>

            {/* Solicitações de Saque */}
            <div className="card" style={{ padding: '15px', marginTop: '20px' }}>
                <h3 className="mb-4" style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🏦 Solicitações de Saque (Entregadores)
                </h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                                <th style={{ padding: '10px' }}>Data</th>
                                <th style={{ padding: '10px' }}>Entregador</th>
                                <th style={{ padding: '10px' }}>Valor</th>
                                <th style={{ padding: '10px' }}>Chave PIX/Conta</th>
                                <th style={{ padding: '10px' }}>Status</th>
                                <th style={{ padding: '10px' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {withdrawals.map((w, i) => {
                                const ds = w.createdAt;
                                const date = ds?.toDate ? ds.toDate() : (ds?.seconds ? new Date(ds.seconds * 1000) : new Date(0));
                                const courierName = couriersData[w.courierId]?.name || 'Entregador Desconhecido';
                                return (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border)', fontSize: '14px' }}>
                                        <td style={{ padding: '10px' }}>{date.toLocaleDateString('pt-BR')} {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td style={{ padding: '10px', fontWeight: 'bold' }}>{courierName}</td>
                                        <td style={{ padding: '10px', color: 'var(--primary)', fontWeight: 'bold' }}>R$ {parseFloat(w.amount || 0).toFixed(2)}</td>
                                        <td style={{ padding: '10px' }}>{w.bankAccount || '---'}</td>
                                        <td style={{ padding: '10px' }}>
                                            <span style={{
                                                padding: '4px 8px',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                backgroundColor: w.status === 'completed' ? '#d4edda' : w.status === 'pending' ? '#fff3cd' : '#f8d7da',
                                                color: w.status === 'completed' ? '#155724' : w.status === 'pending' ? '#856404' : '#721c24'
                                            }}>
                                                {w.status === 'completed' ? 'Concluído' : w.status === 'pending' ? 'Pendente' : 'Rejeitado'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px' }}>
                                            <button 
                                                onClick={() => setSelectedWithdrawal(w)}
                                                style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                                            >
                                                Analisar
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {withdrawals.length === 0 && (
                                <tr>
                                    <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>Nenhuma solicitação de saque encontrada.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
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
                                const ds = (d.status === 'delivered' && d.completedAt) ? d.completedAt : d.createdAt;
                                const date = ds?.toDate ? ds.toDate() : (ds?.seconds ? new Date(ds.seconds * 1000) : new Date(0));
                                return (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border)', fontSize: '14px' }}>
                                        <td style={{ padding: '10px' }}>{date.toLocaleDateString('pt-BR')} {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
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

            {/* Modal de Análise de Saque */}
            {selectedWithdrawal && (() => {
                const courierId = selectedWithdrawal.courierId;
                const courierName = couriersData[courierId]?.name || 'Entregador Desconhecido';
                
                const courierDeliveries = allDeliveries.filter(d => d.courierId === courierId && d.status === 'delivered');
                // Sort newest first
                courierDeliveries.sort((a, b) => {
                    const da = (a.completedAt || a.createdAt)?.seconds || 0;
                    const db = (b.completedAt || b.createdAt)?.seconds || 0;
                    return db - da;
                });

                const courierWithdrawals = withdrawals.filter(w => w.courierId === courierId);
                
                const totalEarnings = courierDeliveries.reduce((sum, d) => sum + parseFloat(d.value || 0), 0);
                const totalWithdrawn = courierWithdrawals.filter(w => w.status === 'completed').reduce((sum, w) => sum + parseFloat(w.amount || 0), 0);
                const totalPending = courierWithdrawals.filter(w => w.status === 'pending').reduce((sum, w) => sum + parseFloat(w.amount || 0), 0);
                const available = totalEarnings - totalWithdrawn - totalPending;

                return (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 9999, padding: '20px'
                    }}>
                        <div className="card fade-in" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', padding: '30px', position: 'relative' }}>
                            <button onClick={() => setSelectedWithdrawal(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border)', paddingBottom: '16px', marginBottom: '24px' }}>
                                <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--secondary)' }}>Análise de Saque</h2>
                                <button onClick={handlePrintCourierReport} style={{ background: 'var(--primary)', color: 'white', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>🖨️ Imprimir Relatório</button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                                <div style={{ background: 'var(--surface-muted)', padding: '20px', borderRadius: '16px' }}>
                                    <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '16px' }}>👤 Dados do Entregador</h3>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>{courierName}</div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>ID: {courierId.slice(-6).toUpperCase()}</div>
                                </div>
                                <div style={{ background: 'var(--primary-light)', padding: '20px', borderRadius: '16px', border: '2px dashed var(--primary)' }}>
                                    <h3 style={{ fontSize: '1rem', color: 'var(--primary-dark)', marginBottom: '16px' }}>💰 Solicitação Atual</h3>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '8px' }}>R$ {parseFloat(selectedWithdrawal.amount).toFixed(2).replace('.', ',')}</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--secondary)' }}>Chave PIX: {selectedWithdrawal.bankAccount}</div>
                                </div>
                            </div>

                            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--secondary)' }}>📊 Resumo da Carteira</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
                                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Total de Ganhos</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--secondary)' }}>R$ {totalEarnings.toFixed(2)}</div>
                                </div>
                                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Já Sacado</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--secondary)' }}>R$ {totalWithdrawn.toFixed(2)}</div>
                                </div>
                                <div style={{ background: '#fff3cd', padding: '16px', borderRadius: '12px', textAlign: 'center', border: '1px solid #ffeeba' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#856404', fontWeight: 'bold', textTransform: 'uppercase' }}>Bloqueado (Pendente)</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#856404' }}>R$ {totalPending.toFixed(2)}</div>
                                </div>
                                <div style={{ background: '#d4edda', padding: '16px', borderRadius: '12px', textAlign: 'center', border: '1px solid #c3e6cb' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#155724', fontWeight: 'bold', textTransform: 'uppercase' }}>Disponível</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#155724' }}>R$ {available.toFixed(2)}</div>
                                </div>
                            </div>

                            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--secondary)' }}>📋 Histórico Simplificado (Últimas Entregas)</h3>
                            <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '24px', border: '1px solid var(--border)', borderRadius: '12px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-muted)' }}>
                                        <tr>
                                            <th style={{ padding: '10px', textAlign: 'left', fontSize: '0.85rem' }}>Data</th>
                                            <th style={{ padding: '10px', textAlign: 'left', fontSize: '0.85rem' }}>Estabelecimento</th>
                                            <th style={{ padding: '10px', textAlign: 'right', fontSize: '0.85rem' }}>Valor Ganho</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {courierDeliveries.length === 0 ? (
                                            <tr><td colSpan="3" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma entrega encontrada.</td></tr>
                                        ) : (
                                            courierDeliveries.slice(0, 50).map((d, i) => {
                                                const ds = d.completedAt || d.createdAt;
                                                const date = ds?.toDate ? ds.toDate() : (ds?.seconds ? new Date(ds.seconds * 1000) : new Date(0));
                                                return (
                                                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                                        <td style={{ padding: '10px', fontSize: '0.85rem' }}>{date.toLocaleDateString('pt-BR')} {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                                                        <td style={{ padding: '10px', fontSize: '0.85rem', fontWeight: 'bold' }}>{d.establishmentName}</td>
                                                        <td style={{ padding: '10px', fontSize: '0.85rem', textAlign: 'right', color: 'var(--primary)', fontWeight: 'bold' }}>R$ {parseFloat(d.value || 0).toFixed(2)}</td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {selectedWithdrawal.status === 'pending' && (
                                <div style={{ display: 'flex', gap: '16px', marginTop: '24px', borderTop: '2px solid var(--border)', paddingTop: '24px' }}>
                                    <button 
                                        onClick={() => handleUpdateWithdrawalStatus(selectedWithdrawal.id, 'completed')}
                                        style={{ flex: 1, background: 'var(--success)', color: 'white', border: 'none', padding: '16px', borderRadius: '12px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold', boxShadow: 'var(--shadow)' }}
                                    >
                                        ✅ Aprovar (Já Transferi)
                                    </button>
                                    <button 
                                        onClick={() => handleUpdateWithdrawalStatus(selectedWithdrawal.id, 'rejected')}
                                        style={{ flex: 1, background: 'var(--error)', color: 'white', border: 'none', padding: '16px', borderRadius: '12px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold', boxShadow: 'var(--shadow)' }}
                                    >
                                        ❌ Rejeitar Solicitação
                                    </button>
                                </div>
                            )}
                            
                            {selectedWithdrawal.status !== 'pending' && (
                                <div style={{ textAlign: 'center', padding: '20px', background: 'var(--surface-muted)', borderRadius: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                                    Esta solicitação já foi {selectedWithdrawal.status === 'completed' ? 'concluída' : 'rejeitada'}.
                                </div>
                            )}
                        </div>
                        
                        <style>{`
                            @media print {
                                body * { visibility: hidden; }
                                .card * { visibility: visible; }
                                .card { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; border: none; padding: 0; }
                                button { display: none !important; }
                            }
                        `}</style>
                    </div>
                );
            })()}

        </div>
    );
}

