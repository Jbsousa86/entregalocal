import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, messaging, getToken } from '../../firebaseClient';
import { useNavigate } from 'react-router-dom';
import backgroundImage from '../../assets/image.png';

export default function CourierHomeScreen() {
  const [isOnline, setIsOnline] = useState(false);
  const [courierName, setCourierName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [deliveries, setDeliveries] = useState([]);
  const [hasActiveDelivery, setHasActiveDelivery] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
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
        setIsInitialLoad(true); // Reseta para o próximo snapshot
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
      const list = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });

      // Se não for o carregamento inicial e houver NOVAS entregas (added)
      if (!isInitialLoad) {
        const hasNew = querySnapshot.docChanges().some(change => change.type === 'added');
        if (hasNew) {
          console.log("Novo pedido detectado via Snapshot!");
          playNotification();
        }
      }

      setDeliveries(list);
      setIsInitialLoad(false);
    });

    return () => unsubscribe();
  }, [isOnline, isInitialLoad]);

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
    <div
      className="courier-home-screen card fade-in"
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '0'
      }}
    >
      {/* Background Hero - Full primary area */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '220px',
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        zIndex: 0
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(to bottom, rgba(5, 150, 105, 0.4), var(--surface) 90%)'
        }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, padding: '40px 24px 24px' }}>
        {/* Profile Section */}
        <div className="text-center mb-6">
          <div style={{
            width: '110px',
            height: '110px',
            borderRadius: '50%',
            backgroundColor: 'var(--background)',
            margin: '0 auto 16px',
            border: '4px solid var(--surface)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}>
            {photoURL ? (
              <img src={photoURL} alt="Perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '32px' }}>👤</span>
            )}
          </div>
          <h2 style={{
            color: 'var(--secondary)',
            textShadow: '0 1px 2px rgba(0,0,0,0.1)',
            marginBottom: '4px',
            fontWeight: '800'
          }}>
            {courierName || 'Portal do Entregador'}
          </h2>
          {courierName && (
            <p style={{
              color: 'var(--primary)',
              fontWeight: '600',
              fontSize: '15px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              ENTREGADOR PARCEIRO
            </p>
          )}
        </div>

        <div className="mb-6" style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => navigate('/courier/history')}>📜 Histórico</button>
          <button onClick={() => navigate('/courier/profile')} style={{ backgroundColor: 'var(--text-muted)' }}>👤 Perfil</button>
        </div>

        <div className="mb-8" style={{ padding: '24px', backgroundColor: 'var(--background)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div className="mb-4" style={{ fontWeight: '700', fontSize: '20px' }}>
            Status: <span style={{ color: isOnline ? 'var(--primary)' : 'var(--error)' }}>
              {isOnline ? '🟢 Online' : '🔴 Offline'}
            </span>
          </div>
          <button
            onClick={toggleStatus}
            style={{
              backgroundColor: isOnline ? 'var(--error)' : 'var(--primary)',
              padding: '16px',
              fontSize: '18px'
            }}
          >
            {isOnline ? '⏸️ Ficar Offline' : '🚀 Ficar Online'}
          </button>
        </div>

        <h3 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          📦 Entregas disponíveis
        </h3>

        {!isOnline && (
          <div className="text-center" style={{ padding: '20px', backgroundColor: 'var(--primary-light)', borderRadius: 'var(--radius)', color: 'var(--secondary)' }}>
            <p>Fique online para começar a receber entregas!</p>
          </div>
        )}

        {isOnline && deliveries.length === 0 && (
          <div className="text-center" style={{ padding: '40px' }}>
            <div className="loader" style={{ marginBottom: '15px', fontSize: '24px' }}>📡</div>
            <p>Procurando novas entregas na sua área...</p>
          </div>
        )}

        {hasActiveDelivery && (
          <div className="text-center mb-6" style={{ padding: '20px', backgroundColor: '#fff3cd', borderRadius: 'var(--radius)', border: '1px solid #ffeeba', color: '#856404' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '12px' }}>⚠️ Você já possui uma entrega em andamento!</p>
            <button
              onClick={() => navigate('/courier/accepted')}
              style={{ backgroundColor: '#856404', color: 'white', border: 'none' }}
            >
              Ir para entrega ativa
            </button>
          </div>
        )}

        <div className="deliveries-list" style={{ opacity: hasActiveDelivery ? 0.6 : 1, pointerEvents: hasActiveDelivery ? 'none' : 'auto' }}>
          {deliveries.map(item => (
            <div key={item.id} className="mb-4" style={{ padding: '20px', borderRadius: 'var(--radius)', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
              <h4 style={{ marginBottom: '12px', color: 'var(--secondary)', fontSize: '18px' }}>
                🏪 {item.establishmentName || 'Estabelecimento'}
              </h4>
              <div style={{ fontSize: '15px', marginBottom: '20px' }}>
                <p style={{ margin: '8px 0', display: 'flex', gap: '8px' }}><strong>📍</strong> {item.pickupAddress}</p>
                <p style={{ margin: '8px 0', display: 'flex', gap: '8px' }}><strong>🏁</strong> {item.deliveryAddress}</p>
                <p style={{ margin: '12px 0 0', fontSize: '20px', color: 'var(--primary)', fontWeight: '800' }}>
                  💰 R$ {item.value}
                </p>
              </div>
              <button onClick={() => navigate('/courier/delivery-details', { state: { deliveryId: item.id } })}>
                Ver Detalhes / Aceitar
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
