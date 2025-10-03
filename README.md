# Bot de Notificação de Pedidos no WhatsApp

Este script conecta uma loja WooCommerce com o WhatsApp para notificar automaticamente novos pedidos.

## 🚀 Como usar
 Clone o repositório:

 git clone https://github.com/yusou7/automacao_woocommerce_node_js
   cd seu-repositorio


Instale as dependências:

npm install


Preencha os campos de configuração no script index.js:

API_URL

CONSUMER_KEY

CONSUMER_SECRET

WHATSAPP_NUMERO_SETOR

Execute o bot:

node index.js


📦 Dependências
whatsapp-web.js

@woocommerce/woocommerce-rest-api

qrcode-terminal

⚠️ Observação
As credenciais de acesso à API WooCommerce e o número de WhatsApp devem ser inseridos manualmente no script antes da execução.

🔒 Nunca compartilhe essas informações publicamente, especialmente em repositórios públicos.

EM BREVE ENSINAREI COMO RODAR ELE AUTOMATICAMENTE VIA PM2