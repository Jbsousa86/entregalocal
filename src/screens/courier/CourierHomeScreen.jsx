import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, messaging, getToken, onMessage } from '../../firebaseClient';
import { useNavigate } from 'react-router-dom';
import backgroundImage from '../../assets/image.png';

const normalizeAddress = (address = '') => {
  return address
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const extractStreet = (address = '') => {
  const normalized = normalizeAddress(address);
  const match = normalized.match(/^(.*?)(?:\s\d|,|$)/);
  return match ? match[1].trim() : normalized;
};

const isNearbyAddress = (a = '', b = '') => {
  const streetA = extractStreet(a);
  const streetB = extractStreet(b);
  if (!streetA || !streetB) return false;
  return streetA === streetB || streetA.includes(streetB) || streetB.includes(streetA);
};

const samePickupAddress = (a = '', b = '') => {
  return normalizeAddress(a) === normalizeAddress(b);
};

export default function CourierHomeScreen() {
  const [isOnline, setIsOnline] = useState(false);
  const [courierName, setCourierName] = useState('');
  const [courierArea, setCourierArea] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [deliveries, setDeliveries] = useState([]);
  const [hasActiveDelivery, setHasActiveDelivery] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Para forçar o re-render do listener
  const isInitialLoad = useRef(true);
  const notifiedIds = useRef(new Set());
  const mountTime = useRef(Date.now());
  const navigate = useNavigate();

  // Inicializar o objeto de áudio persistente para evitar atrasos e permitir desbloqueio no mobile
  const [audio] = useState(new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"));

  const playNotification = () => {
    console.log("Tentando tocar som de notificação...");
    // Tenta tocar o som. Se ainda não foi desbloqueado, o erro será capturado no catch.
    audio.currentTime = 0;
    audio.play().then(() => {
      console.log("Som reproduzido com sucesso.");
    }).catch(err => {
      console.warn("Áudio ainda não desbloqueado ou erro na reprodução:", err);
    });

    // Disparar notificação local do navegador (além do som)
    if (Notification.permission === 'granted') {
      new Notification("Nova Entrega Disponível!", {
        body: "Abra o aplicativo para ver os detalhes da entrega.",
        icon: '/logo.png',
        tag: 'new-delivery' // Evita múltiplas notificações iguais acumuladas
      });
    }
  };

  const unlockAudio = () => {
    // Tocar um som curto/silencioso para "desbloquear" o áudio no navegador mobile
    audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
      console.log("Áudio desbloqueado com sucesso.");
    }).catch(err => console.error("Erro ao desbloquear áudio:", err));

    // Também solicitar permissão de notificação se ainda não tiver
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  // 0. Ouvir mensagens em primeiro plano (quando o app está aberto)
  useEffect(() => {
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log("Mensagem em primeiro plano recebida:", payload);
      // O playNotification já lida com o som e a notificação local do navegador
      playNotification();
    });
    return () => unsubscribe();
  }, [messaging]);

  // Função para solicitar permissão de notificações e salvar token FCM
  const requestNotificationPermission = async () => {
    if (!auth.currentUser) return;

    try {
      const permission = await Notification.requestPermission();
      console.log("Permissão de notificação:", permission);
      if (permission === 'granted') {
        const token = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY // O usuário precisará adicionar isso ao .env
        });

        if (token) {
          console.log("FCM Token:", token);
          await setDoc(doc(db, 'couriers', auth.currentUser.uid), {
            fcmToken: token
          }, { merge: true });
        } else {
          console.warn("Nenhum token FCM recebido. Verifique o VAPID key.");
        }
      } else {
        console.warn("Permissão de notificação negada.");
      }
    } catch (error) {
      console.error("Erro ao solicitar permissão de notificação:", error);
    }
  };

  // 1. Verificar status atual do entregador ao carregar
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const courierRef = doc(db, 'couriers', user.uid);
        const docSnap = await getDoc(courierRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setIsOnline(data.isOnline === true);
          setCourierName(data.name || '');
          setCourierArea(data.area || '');
          setPhotoURL(data.photoURL || '');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Função para ficar Online/Offline
  const toggleStatus = async () => {
    if (!auth.currentUser) return;
    try {
      const newStatus = !isOnline;

      // Se estiver ficando online, desbloqueia o áudio e solicita permissão de notificações
      if (newStatus) {
        unlockAudio();
        requestNotificationPermission();
        isInitialLoad.current = true; // Reseta para o próximo snapshot
      }

      // Usar setDoc con merge: true cria o documento se ele não existir
      await setDoc(doc(db, 'couriers', auth.currentUser.uid), {
        isOnline: newStatus
      }, { merge: true });
      setIsOnline(newStatus);
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      alert("Erro ao mudar status.");
    }
  };

  // 3. Buscar entregas em tempo real quando estiver online
  useEffect(() => {
    if (!isOnline) {
      setDeliveries([]);
      return;
    }

    const q = query(collection(db, 'deliveries'), where('status', '==', 'pending'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      console.log(`Snapshot recebido: ${querySnapshot.size} pedidos pendentes.`);
      const list = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });

      // Lógica de notificação mais robusta
      if (!isInitialLoad.current) {
        querySnapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const id = change.doc.id;

            // Só notifica se ainda não notificamos este ID nesta sessão
            // E se o pedido foi criado após o carregamento desta tela (evita notificar antigos no refresh)
            const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : 0;

            if (!notifiedIds.current.has(id) && createdAt > mountTime.current - 5000) {
              console.log("🔔 Novo pedido detectado:", id);
              notifiedIds.current.add(id);
              playNotification();
            }
          }
        });
      }

      setDeliveries(list);
      isInitialLoad.current = false;
    }, (error) => {
      console.error("Erro no listener de entregas:", error);
    });

    return () => unsubscribe();
  }, [isOnline, refreshKey]);

  // 4. Resetar o listener quando o app volta do background (ajuda no mobile)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isOnline) {
        console.log("App voltou ao primeiro plano, atualizando lista...");
        setRefreshKey(prev => prev + 1);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isOnline]);

  const manualRefresh = () => {
    console.log("🔄 Atualização manual solicitada");
    isInitialLoad.current = true;
    setRefreshKey(prev => prev + 1);
  };

  const deliveriesWithGroupInfo = useMemo(() => {
    return deliveries.map((item) => {
      let groupCount = 0;
      for (const other of deliveries) {
        if (other.id === item.id) continue;
        if (other.establishmentId !== item.establishmentId) continue;
        if (!samePickupAddress(item.pickupAddress, other.pickupAddress)) continue;
        if (!isNearbyAddress(item.deliveryAddress, other.deliveryAddress)) continue;
        groupCount += 1;
        if (groupCount >= 2) break;
      }
      return {
        ...item,
        groupCount
      };
    });
  }, [deliveries]);

  // 4. Verificar se já existe entrega ativa vinculada a este entregador
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'deliveries'),
      where('courierId', '==', auth.currentUser.uid),
      where('status', 'in', ['accepted', 'arrived_pickup', 'in_progress'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHasActiveDelivery(!snapshot.empty);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="courier-home-screen fade-in" style={{ paddingBottom: '40px' }}>
      {/* Background Hero */}
      <div style={{
        height: '220px',
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
        borderRadius: '0 0 40px 40px',
        boxShadow: 'var(--shadow-lg)'
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.2), var(--secondary-hover) 95%)',
          borderRadius: '0 0 40px 40px'
        }} />
        
        <div style={{ 
          position: 'absolute', 
          bottom: '24px', 
          left: '24px', 
          right: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end'
        }}>
          <div>
            <h2 style={{ color: 'white', fontSize: '1.5rem', fontWeight: '800', marginBottom: '4px' }}>
              Olá, {courierName.split(' ')[0] || 'Entregador'}!
            </h2>
            <div className="badge badge-primary" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', color: 'white', border: 'none' }}>
              ID: #{auth.currentUser?.uid.slice(-4).toUpperCase()}
            </div>
          </div>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            backgroundColor: 'var(--surface)',
            border: '4px solid rgba(255,255,255,0.2)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden'
          }}>
            {photoURL ? (
              <img src={photoURL} alt="Perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>👤</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '24px' }}>
        {/* Quick Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          <button 
            onClick={() => navigate('/courier/wallet')} 
            className="card"
            style={{ 
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px',
              border: 'none', cursor: 'pointer', background: 'var(--surface)'
            }}
          >
            <div style={{ color: 'var(--primary)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--secondary)' }}>Carteira</span>
          </button>

          <button 
            onClick={() => navigate('/courier/history')} 
            className="card"
            style={{ 
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px',
              border: 'none', cursor: 'pointer', background: 'var(--surface)'
            }}
          >
            <div style={{ color: 'var(--primary)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v10l4.5 4.5"/><circle cx="12" cy="12" r="10"/></svg>
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--secondary)' }}>Histórico</span>
          </button>
          
          <button 
            onClick={() => navigate('/courier/profile')} 
            className="card"
            style={{ 
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px',
              border: 'none', cursor: 'pointer', background: 'var(--surface)'
            }}
          >
            <div style={{ color: 'var(--primary)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--secondary)' }}>Meu Perfil</span>
          </button>
        </div>

        {/* Status Card */}
        <div className="card" style={{ 
          padding: '24px', 
          marginBottom: '32px', 
          background: isOnline ? 'var(--primary-light)' : 'var(--surface)',
          border: `2px solid ${isOnline ? 'var(--primary)' : 'var(--border)'}`,
          textAlign: 'center'
        }}>
          <div style={{ 
            fontSize: '0.75rem', 
            fontWeight: '800', 
            textTransform: 'uppercase', 
            letterSpacing: '1px',
            color: isOnline ? 'var(--primary)' : 'var(--text-muted)',
            marginBottom: '16px'
          }}>
            Status Atual: {isOnline ? 'Disponível' : 'Indisponível'}
          </div>
          
          <button
            onClick={toggleStatus}
            className="btn"
            style={{
              backgroundColor: isOnline ? 'var(--error)' : 'var(--primary)',
              boxShadow: isOnline ? '0 10px 20px rgba(239, 68, 68, 0.3)' : '0 10px 20px rgba(16, 185, 129, 0.3)',
              width: '100%',
              height: '60px',
              fontSize: '1rem'
            }}
          >
            {isOnline ? 'Ficar Offline' : 'Começar a Trabalhar'}
          </button>
        </div>

        {/* Delivery List Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800' }}>Disponíveis agora</h3>
          <button
            onClick={manualRefresh}
            style={{
              background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
            Atualizar
          </button>
        </div>

        {!isOnline && (
          <div className="glass" style={{ padding: '30px', borderRadius: '24px', textAlign: 'center', border: '2px dashed var(--border)' }}>
            <p style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Fique online para ver as entregas disponíveis na sua região.</p>
          </div>
        )}

        {isOnline && deliveries.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div className="loader-container" style={{ position: 'relative', width: '60px', height: '60px', margin: '0 auto 20px' }}>
              <div style={{ position: 'absolute', inset: 0, border: '4px solid var(--primary-light)', borderRadius: '50%' }}></div>
              <div style={{ position: 'absolute', inset: 0, border: '4px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Buscando novas entregas...</p>
          </div>
        )}

        {hasActiveDelivery && (
          <div className="card fade-in" style={{ padding: '20px', backgroundColor: '#fffbeb', border: '2px solid #fbbf24', marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ color: '#d97706' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <p style={{ color: '#92400e', fontWeight: '700', fontSize: '0.9rem' }}>Você possui uma entrega ativa.</p>
            </div>
            <button
              onClick={() => navigate('/courier/accepted')}
              className="btn"
              style={{ backgroundColor: '#d97706', width: '100%', height: '50px' }}
            >
              Ver Entrega Ativa
            </button>
          </div>
        )}

        <div className="deliveries-list" style={{ opacity: hasActiveDelivery ? 0.5 : 1, pointerEvents: hasActiveDelivery ? 'none' : 'auto' }}>
          {deliveriesWithGroupInfo.map(item => (
            <div key={item.id} className="card fade-in" style={{ padding: '24px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '40px', height: '40px', background: 'var(--primary-light)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/></svg>
                  </div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>{item.establishmentName || 'Estabelecimento'}</h4>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary)' }}>
                  R$ {Number(item.value).toFixed(2).replace('.', ',')}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ color: 'var(--primary)', paddingTop: '2px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>
                    <div style={{ color: 'var(--text-muted)', fontWeight: '700', fontSize: '0.7rem', textTransform: 'uppercase' }}>Retirada</div>
                    <div style={{ fontWeight: '600' }}>{item.pickupAddress}</div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ color: 'var(--accent)', paddingTop: '2px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>
                    <div style={{ color: 'var(--text-muted)', fontWeight: '700', fontSize: '0.7rem', textTransform: 'uppercase' }}>Entrega</div>
                    <div style={{ fontWeight: '600' }}>{item.deliveryAddress}</div>
                  </div>
                </div>
              </div>

              {item.groupCount > 0 && (
                <div style={{
                  marginBottom: '16px',
                  padding: '14px',
                  borderRadius: '16px',
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.18)',
                  color: 'var(--primary)'
                }}>
                  Pode ser agrupado com mais {item.groupCount} pedido{item.groupCount > 1 ? 's' : ''} do mesmo estabelecimento.
                </div>
              )}

              <button 
                onClick={() => navigate('/courier/delivery-details', { state: { deliveryId: item.id } })}
                className="btn btn-outline"
                style={{ width: '100%', height: '50px' }}
              >
                Ver Detalhes
              </button>
            </div>
          ))}
        </div>
      </div>
      
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
