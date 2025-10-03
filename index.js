const fs = require('fs');
const path = require('path');
const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// ======================= CONFIGURAÇÕES =======================
const API_URL = ""; //preencha com a url do seu site
const CONSUMER_KEY = "ck_"; //preencha com a ck do seu site
const CONSUMER_SECRET = "cs_"; //preencha com a cs do seu site

const WHATSAPP_NUMERO_SETOR = ""; // Número completo do setor comercial que recebe ex: 5521999999999

const INTERVALO_MINUTOS = 2; // Tempo entre verificações

const ARQUIVO_PEDIDOS_ENVIADOS = path.join(__dirname, "pedidos_enviados.json");
const ARQUIVO_LOG = path.join(__dirname, "log_envio_pedidos.txt");
// =============================================================


// Função de Log
function log(texto) {
    const dataHora = new Date().toLocaleString('pt-BR');
    const linha = `[${dataHora}] ${texto}\n`;
    console.log(linha.trim());
    fs.appendFileSync(ARQUIVO_LOG, linha, { encoding: 'utf-8' });
}

// Carrega os IDs dos pedidos já enviados de um arquivo JSON
function carregarPedidosEnviados() {
    if (!fs.existsSync(ARQUIVO_PEDIDOS_ENVIADOS)) {
        return new Set();
    }
    try {
        const data = fs.readFileSync(ARQUIVO_PEDIDOS_ENVIADOS, 'utf-8');
        const arrayPedidos = JSON.parse(data);
        return new Set(arrayPedidos);
    } catch (error) {
        log("Erro ao ler arquivo de pedidos, começando com uma lista vazia.");
        return new Set();
    }
}

// Salva os IDs dos pedidos no arquivo JSON
function salvarPedidosEnviados(pedidosSet) {
    const arrayPedidos = Array.from(pedidosSet);
    fs.writeFileSync(ARQUIVO_PEDIDOS_ENVIADOS, JSON.stringify(arrayPedidos, null, 2), { encoding: 'utf-8' });
}

// Emite um som de "beep" no terminal
function notificarSom() {
    process.stdout.write('\u0007');
}

// Formata a mensagem final
function formatarMensagem(pedido) {
    const nome = `${pedido.billing.first_name} ${pedido.billing.last_name}`;
    const cpf = pedido.billing.cpf || "Não informado";
    const email = pedido.billing.email;
    const telefone = pedido.billing.phone;
    const status = pedido.status.charAt(0).toUpperCase() + pedido.status.slice(1);
    
    // Formatando data para o padrão brasileiro
    const data = new Date(pedido.date_created);
    const dataCriacao = `${data.toLocaleDateString('pt-BR')} ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    const endereco = `${pedido.billing.address_1}, ${pedido.billing.number || ''} ${pedido.billing.address_2}, ${pedido.billing.city} - ${pedido.billing.state} CEP: ${pedido.billing.postcode}`;

    let produtos = "";
    for (const item of pedido.line_items) {
        const nomeProduto = item.name;
        const quantidade = item.quantity;
        const preco = parseFloat(item.total);
        produtos += `- ${nomeProduto} x${quantidade} (R$ ${preco.toFixed(2).replace('.', ',')})\n`;
    }

    const total = parseFloat(pedido.total);
    const pagamento = pedido.payment_method_title;


    const mensagem = `*Novo pedido recebido!*\n\n` +
                     `*ID:* ${pedido.id}\n` +
                     `*Status:* ${status}\n` +
                     `*Data:* ${dataCriacao}\n\n` +
                     `*Cliente:* ${nome}\n` +
                     `*CPF:* ${cpf}\n` +
                     `*E-mail:* ${email}\n` +
                     `*Telefone:* ${telefone}\n` +
                     `*Endereço:* ${endereco}\n\n` +
                     `*Produtos:*\n${produtos}\n` +
                     `*Total:* R$ ${total.toFixed(2).replace('.', ',')}\n` +
                     `*Pagamento:* ${pagamento}`;
    
    return mensagem;
}

// Instância da API do WooCommerce
const wooApi = new WooCommerceRestApi({
    url: API_URL,
    consumerKey: CONSUMER_KEY,
    consumerSecret: CONSUMER_SECRET,
    version: 'wc/v3'
});

// Função principal que busca e envia os pedidos
async function verificarEEnviarPedidos(client, pedidosEnviados) {
    log("Buscando novos pedidos...");
    try {
        const response = await wooApi.get("orders", {
            orderby: "date",
            order: "desc",
            status:
            "processing, pending, cancelled, on-hold"
        });

        //pegar apenas pedidos que ainda não foram enviados
        const novosPedidos = response.data.filter(p => !pedidosEnviados.has(`${p.id}-${p.status}`));

        if (novosPedidos.length > 0) {
            log(`${novosPedidos.length} novo(s) pedido(s) encontrado(s).`);
            //processar do mais antigo para o mais novo
            for (const pedido of novosPedidos.reverse()) {
                const mensagem = formatarMensagem(pedido);
                const numeroDestino = `${WHATSAPP_NUMERO_SETOR}@c.us`;

                try {
                    await client.sendMessage(numeroDestino, mensagem);
                    log(`Pedido ${pedido.id} enviado com sucesso para o setor.`);
                    pedidosEnviados.add(`${pedido.id}-${pedido.status}`)
                    salvarPedidosEnviados(pedidosEnviados);
                    notificarSom();
                } catch (e) {
                    log(`FALHA ao enviar mensagem para o pedido ${pedido.id}: ${e.message}`);
                }
            }
        } else {
            log("Nenhum novo pedido encontrado.");
        }
    } catch (error) {
        log(`Erro ao buscar pedidos da API WooCommerce: ${error.message}`);
    }
}


// ======================= INICIALIZAÇÃO =======================
function start() {
    log("Iniciando o bot de pedidos...");
    const pedidosEnviados = carregarPedidosEnviados();

    const client = new Client({
        authStrategy: new LocalAuth() // Salva a sessão localmente
    });

    client.on('qr', qr => {
        log("ESCANEIE O QR CODE ABAIXO COM SEU WHATSAPP:");
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        log('✅ Cliente WhatsApp conectado e pronto!');
        // Roda a verificação imediatamente ao iniciar
        verificarEEnviarPedidos(client, pedidosEnviados); 
        // E depois agenda para rodar no intervalo definido
        setInterval(() => verificarEEnviarPedidos(client, pedidosEnviados), INTERVALO_MINUTOS * 60 * 1000);
    });
    
    client.on('auth_failure', msg => {
        log(`❌ FALHA DE AUTENTICAÇÃO: ${msg}`);
    });

    client.initialize();
}

start();
