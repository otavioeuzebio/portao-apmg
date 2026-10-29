/* Configuração da sincronização (Firebase).
   Projeto Firebase próprio do Portão: "portaoapmg" (ID portaoapgm).
   A chave abaixo é pública por natureza (identifica o projeto); quem protege os dados
   são as regras do Firestore (arquivo firestore.rules deste repositório).
   Para usar o app só no modo local (sem nuvem), deixe apiKey vazio. */
"use strict";
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBK97ShbEzRM0IgqJOGVglzDwb9OiZ-KvA',
  authDomain: 'portaoapgm.firebaseapp.com',
  projectId: 'portaoapgm',
  appId: '1:952528610314:web:671a965545d302c13cabf3',
};
/** Administradores: liberam contas e definem papéis. Deve bater com admin() em firestore.rules. */
const ADMIN_EMAILS = ['otaviosilva.oe@gmail.com'];
const FIREBASE_VERSAO = '10.12.2';
/** Nome do banco Firestore do projeto (foi criado como "default", não "(default)"). */
const FIREBASE_DB = 'default';
