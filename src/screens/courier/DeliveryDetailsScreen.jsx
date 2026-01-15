import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc, runTransaction, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../../firebaseClient';

export default function DeliveryDetailsScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { deliveryId } = location.state || {};
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deliveryId) {
      navigate('/courier/home');
      return;
    }

    const fetchDelivery = async () => {
      try {
        const docRef = doc(db, 'deliveries', deliveryId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          let currentEstName = data.establishmentName;

          // Buscar nome atualizado do estabelecimento se possível
          if (data.establishmentId) {
            try {
              const estDoc = await getDoc(doc(db, 'establishments', data.establishmentId));
              if (estDoc.exists() && estDoc.data().name) {
                currentEstName = estDoc.data().name;
              }
            } catch (err) {
              console.error("Erro ao buscar nome do estabelecimento:", err);
            }
          }

          setDelivery({ id: docSnap.id, ...data, establishmentName: currentEstName });
        } else {
          alert('Entrega não encontrada ou já removida.');
          navigate('/courier/home');
        }
      } catch (error) {
        console.error("Erro ao buscar detalhes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDelivery();
  }, [deliveryId, navigate]);

  const handleAccept = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        // Verificar se o entregador já tem uma entrega ativa
        const activeQuery = query(
          collection(db, 'deliveries'),
          where('courierId', '==', auth.currentUser.uid),
          where('status', 'in', ['accepted', 'arrived_pickup', 'in_progress'])
        );
        const activeSnapshot = await getDocs(activeQuery);

        if (!activeSnapshot.empty) {
          throw new Error("Você já possui uma entrega em andamento. Conclua-a antes de aceitar uma nova.");
        }

        const deliveryRef = doc(db, 'deliveries', deliveryId);
        const deliveryDoc = await transaction.get(deliveryRef);

        if (!deliveryDoc.exists()) {
          throw new Error("Entrega não encontrada.");
        }

        if (deliveryDoc.data().status !== 'pending') {
          throw new Error("Esta entrega já foi aceita por outro entregador.");
        }

        const courierRef = doc(db, 'couriers', auth.currentUser.uid);
        const courierDoc = await transaction.get(courierRef);
        const courierName = courierDoc.exists() ? courierDoc.data().name : 'Entregador';

        transaction.update(deliveryRef, {
          status: 'accepted',
          courierId: auth.currentUser.uid,
          courierName: courierName
        });
      });

      alert('Entrega aceita com sucesso!');
      navigate('/courier/accepted');
    } catch (error) {
      console.error("Erro ao aceitar entrega:", error);
      alert(error.message);
      if (error.message === "Esta entrega já foi aceita por outro entregador." || error.message === "Entrega não encontrada.") {
        navigate('/courier/home');
      } else {
        setLoading(false);
      }
    }
  };

  if (loading) return <p>Carregando...</p>;
  if (!delivery) return null;

  return (
    <div className="delivery-details-screen card fade-in">
      <h2 className="text-center mb-6">📦 Detalhes da Entrega</h2>

      <div className="mb-6" style={{ textAlign: 'left', padding: '20px', backgroundColor: 'var(--background)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <p className="mb-4"><strong>🏪 Estabelecimento:</strong> {delivery.establishmentName || 'Nome indisponível'}</p>
        <p className="mb-4"><strong>📍 Retirada:</strong> {delivery.pickupAddress}</p>
        <p className="mb-4"><strong>🏁 Entrega:</strong> {delivery.deliveryAddress}</p>
        <p className="mb-4" style={{ color: 'var(--primary)', fontSize: '1.2rem', fontWeight: '700' }}><strong>💰 Valor: R$ {delivery.value}</strong></p>
        <p><strong>📝 Observações:</strong> {delivery.observation || 'Nenhuma'}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button onClick={handleAccept} disabled={loading}>
          {loading ? 'Processando...' : '✅ Aceitar Entrega'}
        </button>

        <button
          onClick={() => navigate('/courier/home')}
          style={{ backgroundColor: 'var(--error)' }}
        >
          ❌ Voltar / Recusar
        </button>
      </div>
    </div>
  );
}
