import React from 'react';

export default function WaitingCourierScreen({ courierName, onCancel }) {
  return (
    <div className="waiting-courier-screen">
      <h2>Aguardando Entregador</h2>
      <p>Status: Aguardando entregador</p>
      {courierName && <p>Nome do entregador: {courierName}</p>}
      <button onClick={onCancel}>Cancelar entrega</button>
    </div>
  );
}
