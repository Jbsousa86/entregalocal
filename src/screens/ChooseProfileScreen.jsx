import React from 'react';

export default function ChooseProfileScreen({ onChoose }) {
  return (
    <div className="choose-profile-screen card fade-in">
      <h2 className="text-center mb-6">Como deseja entrar?</h2>
      <p className="text-center mb-6">Selecione o tipo de perfil para continuar o cadastro</p>
      <button onClick={() => onChoose('establishment')} className="mb-4">
        Sou Estabelecimento
      </button>
      <button onClick={() => onChoose('courier')}>
        Sou Entregador
      </button>
    </div>
  );
}
