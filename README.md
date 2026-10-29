# Portão APMG

App (PWA) de controle de acesso de veículos no portão da APMG. Publicado pelo GitHub Pages:
https://otavioeuzebio.github.io/portao-apmg/

## O que tem

- **Leitura de placa pela câmera** (OCR no próprio aparelho, Mercosul e padrão antigo), por foto ou digitada.
- **Resultado em tela cheia**: autorizado, bloqueado, vencido ou não cadastrado, com foto do responsável, posto/graduação, marca, modelo e cor. Alerta sonoro e vibração para bloqueados.
- **Cadastro** com foto, situação (ativo/bloqueado) e validade; **visitante rápido** válido até o fim do dia.
- **Importação** de Excel, CSV, ODS, Word (.docx, inclusive fotos dentro da tabela) e PDF com tabela, com conferência das colunas antes de gravar. Fotos em lote pelo nome do arquivo (`BRA2E19.jpg`).
- **Livro de entradas e saídas**, lista de veículos no pátio, **passagem de serviço** (12 h / 24 h) pronta para copiar ou enviar, exportação CSV.
- **PIN de administrador**, backup/restauração em JSON, tema claro/escuro, funciona offline.

## Privacidade

Não há servidor: cadastro, fotos e livro ficam só no aparelho (IndexedDB). Para passar o cadastro a
outro celular, use *Mais → Salvar backup* e *Restaurar backup*. Este repositório contém apenas o código,
sem dados pessoais. Use o app com autorização do comando e mantenha o PIN ativo (LGPD).

## Publicar no GitHub Pages (uma vez)

Settings → Pages → *Build and deployment* → Source: **Deploy from a branch** → Branch: **main** / **(root)** → Save.
Em 1–2 minutos o endereço acima passa a funcionar. Abra no celular e instale:
Chrome (Android) → menu ⋮ → *Instalar app*; Safari (iPhone) → Compartilhar → *Adicionar à Tela de Início*.

## Desenvolvimento

Arquivos estáticos, sem build. Bibliotecas carregadas sob demanda pela CDN: Tesseract.js (leitura de placas),
SheetJS (planilhas), Mammoth (Word) e pdf.js (PDF). Ao publicar mudanças, altere `CACHE` em `sw.js`.
