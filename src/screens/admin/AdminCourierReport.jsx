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
    const [withdrawals, setWithdrawals] = useState([]);
    const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
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

                const wSnapshot = await getDocs(collection(db, 'withdrawals'));
                const wList = [];
                wSnapshot.forEach(docSnap => {
                    wList.push({ id: docSnap.id, ...docSnap.data() });
                });
                wList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                setWithdrawals(wList);

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

    if (loading) return <div className="p-8 text-center">Carregando relatório de entregadores...</div>;

    return (
        <div className="admin-report fade-in" style={{ padding: '15px', maxWidth: '800px', margin: '0 auto' }}>
            <div className="no-print">
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

                <div className="card" style={{ padding: '15px', marginTop: '30px' }}>
                    <h3 className="mb-4" style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🏦 Solicitações de Saque
                    </h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Entregador</th>
                                    <th>Valor</th>
                                    <th>Status</th>
                                    <th>Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {withdrawals.map((w, i) => {
                                    const ds = w.createdAt;
                                    const date = ds?.toDate ? ds.toDate() : (ds?.seconds ? new Date(ds.seconds * 1000) : new Date(0));
                                    const courierName = stats.couriers[w.courierId]?.name || 'Entregador Desconhecido';
                                    return (
                                        <tr key={i}>
                                            <td>{date.toLocaleDateString('pt-BR')}</td>
                                            <td style={{ fontWeight: 'bold' }}>{courierName}</td>
                                            <td style={{ color: 'var(--primary)', fontWeight: 'bold' }}>R$ {parseFloat(w.amount || 0).toFixed(2)}</td>
                                            <td>
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
                                            <td>
                                                <button 
                                                    onClick={() => setSelectedWithdrawal(w)}
                                                    style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                                                >
                                                    Analisar
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
                        📜 Histórico de Saques (Últimos 20)
                    </h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Entregador</th>
                                    <th>Valor</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {withdrawals.slice(0, 20).map((w, i) => {
                                    const ds = w.createdAt;
                                    const date = ds?.toDate ? ds.toDate() : (ds?.seconds ? new Date(ds.seconds * 1000) : new Date(0));
                                    const courierName = stats.couriers[w.courierId]?.name || 'Entregador';
                                    return (
                                        <tr key={i}>
                                            <td>{date.toLocaleDateString('pt-BR')} {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                                            <td style={{ fontWeight: 'bold' }}>{courierName}</td>
                                            <td style={{ color: 'var(--primary)', fontWeight: 'bold' }}>R$ {parseFloat(w.amount || 0).toFixed(2)}</td>
                                            <td>
                                                <span style={{
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    fontSize: '11px',
                                                    backgroundColor: w.status === 'completed' ? '#d4edda' : w.status === 'pending' ? '#fff3cd' : '#f8d7da',
                                                    color: w.status === 'completed' ? '#155724' : w.status === 'pending' ? '#856404' : '#721c24'
                                                }}>
                                                    {w.status === 'completed' ? 'CONCLUÍDO' : w.status === 'pending' ? 'PENDENTE' : 'REJEITADO'}
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
                    <h3 className="mb-4" style={{ fontSize: '1.2rem' }}>📝 Detalhamento de Entregas (Entregadores)</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Data/Hora</th>
                                    <th>Entregador</th>
                                    <th>Estabelecimento</th>
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
                                                <td style={{ fontWeight: 'bold' }}>{d.courierName || '---'}</td>
                                                <td>{d.establishmentName}</td>
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

            {/* Modal de Análise de Saque */}
            {selectedWithdrawal && (() => {
                const courierId = selectedWithdrawal.courierId;
                const courierName = stats.couriers[courierId]?.name || 'Entregador Desconhecido';
                const courierDeliveries = allDeliveries.filter(d => d.courierId === courierId && d.status === 'delivered');
                courierDeliveries.sort((a, b) => ((b.completedAt || b.createdAt)?.seconds || 0) - ((a.completedAt || a.createdAt)?.seconds || 0));
                
                const courierWithdrawals = withdrawals.filter(w => w.courierId === courierId);
                const totalEarnings = courierDeliveries.reduce((sum, d) => sum + parseFloat(d.value || 0), 0);
                const totalWithdrawn = courierWithdrawals.filter(w => w.status === 'completed').reduce((sum, w) => sum + parseFloat(w.amount || 0), 0);
                const totalPending = courierWithdrawals.filter(w => w.status === 'pending').reduce((sum, w) => sum + parseFloat(w.amount || 0), 0);
                const available = totalEarnings - totalWithdrawn - totalPending;

                return (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
                        <div id="printable-area" className="card fade-in" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', padding: '30px', position: 'relative' }}>
                            <button onClick={() => setSelectedWithdrawal(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border)', paddingBottom: '16px', marginBottom: '24px' }}>
                                <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--secondary)' }}>Análise de Saque</h2>
                                <button onClick={handlePrintCourierReport} style={{ background: 'var(--primary)', color: 'white', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>🖨️ Imprimir</button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                                <div style={{ background: 'var(--surface-muted)', padding: '20px', borderRadius: '16px' }}>
                                    <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>👤 Entregador</h3>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{courierName}</div>
                                </div>
                                <div style={{ background: 'var(--primary-light)', padding: '20px', borderRadius: '16px', border: '2px dashed var(--primary)' }}>
                                    <h3 style={{ fontSize: '0.9rem', color: 'var(--primary-dark)' }}>💰 Solicitação Atual</h3>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--primary)' }}>R$ {parseFloat(selectedWithdrawal.amount).toFixed(2)}</div>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' }}>
                                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>TOTAL GANHO</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>R$ {totalEarnings.toFixed(2)}</div>
                                </div>
                                <div style={{ background: '#d4edda', padding: '12px', borderRadius: '12px', border: '1px solid #c3e6cb' }}>
                                    <div style={{ fontSize: '0.7rem', color: '#155724', fontWeight: 'bold' }}>DISPONÍVEL</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>R$ {available.toFixed(2)}</div>
                                </div>
                            </div>

                            {/* Detalhamento para Impressão/Recibo */}
                            <div style={{ marginTop: '10px' }}>
                                <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '12px', color: 'var(--secondary)' }}>🛵 Detalhamento das Corridas</h3>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                                                <th style={{ padding: '8px 4px' }}>Data/Hora</th>
                                                <th style={{ padding: '8px 4px' }}>Estabelecimento</th>
                                                <th style={{ padding: '8px 4px' }}>Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {courierDeliveries.map((d, i) => {
                                                const ds = d.completedAt || d.createdAt;
                                                const date = ds?.toDate ? ds.toDate() : new Date(ds?.seconds * 1000 || 0);
                                                return (
                                                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                                        <td style={{ padding: '8px 4px' }}>{date.toLocaleDateString('pt-BR')} {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                                                        <td style={{ padding: '8px 4px' }}>{d.establishmentName}</td>
                                                        <td style={{ padding: '8px 4px', fontWeight: 'bold' }}>R$ {parseFloat(d.value).toFixed(2)}</td>
                                                    </tr>
                                                );
                                            })}
                                            {courierDeliveries.length === 0 && (
                                                <tr>
                                                    <td colSpan="3" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Nenhuma corrida encontrada.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            {selectedWithdrawal.status === 'pending' && (
                                <div className="no-print" style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                                    <button onClick={() => handleUpdateWithdrawalStatus(selectedWithdrawal.id, 'completed')} style={{ flex: 1, background: 'var(--success)', color: 'white', padding: '12px', borderRadius: '12px', fontWeight: 'bold' }}>Aprovar Pagamento</button>
                                    <button onClick={() => handleUpdateWithdrawalStatus(selectedWithdrawal.id, 'rejected')} style={{ flex: 1, background: 'var(--error)', color: 'white', padding: '12px', borderRadius: '12px', fontWeight: 'bold' }}>Rejeitar</button>
                                </div>
                            )}
                        </div>
                        <style>{`
                            @media print {
                                @page { margin: 1cm; size: auto; }
                                .no-print { display: none !important; }
                                body { background: white !important; margin: 0 !important; padding: 0 !important; }
                                #printable-area { 
                                    position: relative !important; 
                                    width: 100% !important; 
                                    height: auto !important;
                                    max-height: none !important;
                                    overflow: visible !important;
                                    margin: 0 !important; 
                                    padding: 0 !important; 
                                    box-shadow: none !important;
                                    border: none !important;
                                    display: block !important;
                                    visibility: visible !important;
                                }
                                .fade-in { animation: none !important; }
                                * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                            }
                        `}</style>
                    </div>
                );
            })()}
        </div>
    );
}
