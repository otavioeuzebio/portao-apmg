/* Configuração da sincronização (Firebase).
   Usa o mesmo projeto Firebase da Agenda do Cadete ("agenda-esfo"): o login é o mesmo,
   mas o acesso ao Portão é liberado à parte, pelo administrador, dentro deste app.
   A chave abaixo é pública por natureza; quem protege os dados são as regras do
   Firestore (bloco "Portão APMG" em firestore.rules).
   Para usar o app só no modo local (sem nuvem), deixe apiKey vazio. */
"use strict";
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCmFBkytK2xGocP53F0BPlb-39kFtvPB_g',
  authDomain: 'agenda-esfo.firebaseapp.com',
  projectId: 'agenda-esfo',
  appId: '1:32285182241:web:fec6f3a2eda4498e111660',
};
/** Administradores: liberam contas e definem quem é gestor. Deve bater com firestore.rules. */
const ADMIN_EMAILS = ['otaviosilva.oe@gmail.com'];
const FIREBASE_VERSAO = '10.12.2';
