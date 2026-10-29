# Portão APMG

App (PWA) de controle de acesso no portão da APMG. Publicado pelo GitHub Pages:
https://otavioeuzebio.github.io/portao-apmg/

## O que tem

- **Leitura de placa pela câmera** (OCR no próprio aparelho, Mercosul e padrão antigo). Cada quadro é lido em duas
  versões (contraste e preto-e-branco) e a placa só é aceita depois de confirmada em vários quadros. Tem zoom,
  lanterna, leitura por foto e o recorte da placa lida aparece no resultado para conferência.
- **Resultado em tela cheia**: autorizado, bloqueado, vencido, visita agendada, agendado fora do horário ou não cadastrado,
  com foto do responsável, posto/graduação, marca, modelo e cor.
- **Lista de alerta** (placas de interesse): consulta especial **discreta**, sem som e sem tela vermelha, com motivo e procedimento.
- **Agendados**: visitas, prestadores e entregas com data e horário; lista "Esperados hoje" e reconhecimento automático
  pela placa ou pelo documento do pedestre.
- **Pedestres**: entrada e saída por nome e documento, com foto opcional e busca de quem já veio.
- **Viaturas da APMG**: cadastro por prefixo e/ou placa; saída e retorno exigem **motorista** e **KM inicial/final**
  (com checagem de KM menor que o anterior e percurso longo). A câmera reconhece a placa da viatura. Lista de viaturas fora,
  KM rodados na passagem de serviço e nos relatórios.
- **Cadastro rápido de Uber/app e entregadores** (iFood, Correios etc.), com limite de permanência próprio em minutos.
  Placa em lista de alerta ou bloqueada abre a consulta normal antes.
- **Checklist da viatura** na saída e no retorno: combustível, itens (lista editável por viatura), avarias com foto;
  o app aponta o que saiu com a viatura e voltou faltando.
- **Viaturas de outras unidades pelo prefixo**: o campo de consulta aceita placa ou prefixo; prefixo desconhecido abre o
  registro de entrada com unidade/OPM e motorista.
- **Ocorrências do posto** (defeito, energia, suspeito, visita de autoridade…) com foto, na passagem e nos relatórios.
- **Rondas com QR Code**: pontos cadastrados em Mais → Rondas, folha de QR em PDF para imprimir, leitura pela câmera,
  registro "sem QR" com motivo e aviso de ponto atrasado.
- **Visitantes frequentes**: agendamento que repete nos dias da semana marcados, com validade.
- **Vagas do pátio**: contador de vagas de visitantes, com confirmação quando lotado.
- **Painel do comando**: sentinela de serviço, quem está no local, viaturas fora, alertas, permanências, rondas e
  ocorrências do dia. Papel **comando** (só consulta) vê painel, livro e relatórios.
- **Alertas de permanência**: aviso quando visitante ou veículo passa do tempo (configurável) ou do horário agendado.
- **Livro** de entradas e saídas, "no local agora", **passagem de serviço** pronta para copiar/enviar e CSV do dia.
- **Relatórios para o comando**: entradas por dia e por hora (pico), visitantes, pedestres, ocorrências, veículos mais
  frequentes e permanência média, com exportação em **PDF** e **Excel**.
- **Importação** para veículos, viaturas (placa ou prefixo), lista de alerta e agendados a partir de planilhas
  (Excel, ODS, CSV), Word (.docx com fotos na tabela, .doc antigo), ODT, RTF, HTML, TXT, PDF (com texto ou escaneado),
  **foto de uma lista** (leitura de texto no aparelho) ou texto colado (WhatsApp, e-mail, ofício). Tabelas têm conferência
  de colunas; textos corridos viram uma **lista solta** de placas e prefixos para marcar e importar.
  Fotos em lote pelo nome do arquivo (`BRA2E19.jpg`).
- **Dois modos**:
  - **Com a guarda (nuvem)**: todos os celulares do portão veem o mesmo cadastro, agendados, lista de alerta e livro.
    Funciona sem internet e sincroniza depois. Login por e-mail e senha, com acesso liberado
    pelo administrador. Papéis: **sentinela** (consulta e registra) e **gestor** (também edita).
    O administrador também **cria usuários com e-mail e senha** dentro do app (entram sem confirmar e-mail) e uma
    **conta geral da guarda**, que só abre nos celulares autorizados pelo código exibido em cada aparelho (padrão: 2).
    Na conta geral, o app pede o nome do sentinela a cada serviço (12 h).
  - **Só neste aparelho**: sem conta, dados no IndexedDB, PIN de administrador e backup manual.

## Configuração da nuvem (uma vez, pelo administrador)

O Portão usa um **projeto Firebase próprio**: `portaoapmg` (ID `portaoapgm`), configurado em `js/config.js`.

1. Authentication → Método de login → **E-mail/senha** ativado; Configurações → Domínios autorizados com
   `otavioeuzebio.github.io`.
2. Firestore Database criado; em **Regras**, cole o arquivo `firestore.rules` deste repositório → **Publicar**.
3. Abra o app, escolha **Com a guarda**, toque em "Não tenho conta — criar" e crie a conta do administrador
   (`otaviosilva.oe@gmail.com`, o mesmo de `js/config.js` e de `admin()` nas regras); confirme o e-mail.
4. Em **Mais → Acessos ao Portão**, crie os usuários e a conta geral da guarda, ou libere os pedidos.
5. Se já havia cadastro no modo local, use **Mais → Enviar para a nuvem o cadastro deste aparelho**.

Para usar só no modo local, deixe `apiKey` vazio em `js/config.js`.

## Privacidade

O código deste repositório não contém dados pessoais. No modo nuvem, cadastro, fotos, agendados, lista de alerta e livro
ficam no Firestore do projeto, acessíveis só a contas liberadas (regras do Firestore). Use com autorização do comando (LGPD).

## Publicar no GitHub Pages

Settings → Pages → *Deploy from a branch* → **main** / **(root)** → Save. O repositório precisa ser público no plano grátis.

## Desenvolvimento

Arquivos estáticos, sem build. Bibliotecas sob demanda: Tesseract.js (placas), SheetJS (planilhas), Mammoth (Word),
pdf.js (PDF), jsPDF + AutoTable (relatório), Firebase (nuvem). Testes: `node --test tests/*.test.mjs`.
Ao publicar mudanças, altere `CACHE` em `sw.js`.
