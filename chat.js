// =========================================================
// LS SHOPPING - Contacto e chat do site (chat.js)
// Versão Otimizada, Integrada e com Selo iOS (Botão no sítio original)
// =========================================================

document.addEventListener('DOMContentLoaded', () => {

    const DIAS_HISTORICO = 7;
    const UM_DIA = 24 * 60 * 60 * 1000;
    const CHAVE = 'ls_conversas';

    let conversaAtiva = null;

    function usuarioAtual() {
        return localStorage.getItem('ls_sessao') || '';
    }

    function lerJSON(chave) {
        try { return JSON.parse(localStorage.getItem(chave)) || []; }
        catch (e) { return []; }
    }

    function nomeDe(email) {
        const conta = lerJSON('ls_contas').find(c => c.email === email);
        return conta ? conta.usuario : String(email || '').split('@')[0];
    }

    function lerConversas() {
        return lerJSON(CHAVE);
    }

    function guardarConversas(lista) {
        try {
            localStorage.setItem(CHAVE, JSON.stringify(lista));
            return true;
        } catch (e) {
            alert('Não foi possível guardar a mensagem (armazenamento cheio).');
            return false;
        }
    }

    function clicar(id) {
        const el = document.getElementById(id);
        if (el) el.click();
    }

    function formatarHora(ts) {
        const d = new Date(ts);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        if (d.toDateString() === new Date().toDateString()) return hh + ':' + mm;
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        return dia + '/' + mes + ' ' + hh + ':' + mm;
    }

    function limparExpiradas() {
        const todas = lerConversas();
        const validas = todas.filter(c => c.expiraEm > Date.now());
        if (validas.length !== todas.length) guardarConversas(validas);
    }

    function naoLidas(c, eu) {
        const visto = (c.lidas && c.lidas[eu]) || 0;
        return c.mensagens.filter(m => m.de !== eu && m.em > visto).length;
    }

    function totalNaoLidas(eu) {
        return lerConversas()
            .filter(c => c.vendedor === eu || c.comprador === eu)
            .reduce((soma, c) => soma + naoLidas(c, eu), 0);
    }

    function marcarLida(idConversa) {
        const eu = usuarioAtual();
        const todas = lerConversas();
        const c = todas.find(x => x.id === idConversa);
        if (!c) return;
        const ultimaDoOutro = c.mensagens.reduce(
            (max, m) => (m.de !== eu && m.em > max) ? m.em : max, 0
        );
        const visto = (c.lidas && c.lidas[eu]) || 0;
        if (ultimaDoOutro <= visto) return;
        c.lidas = c.lidas || {};
        c.lidas[eu] = Date.now();
        guardarConversas(todas);
    }

    // Criar ou obter conversa (com fallback para produtos antigos sem dono)
    function obterConversa(prod, comprador) {
        const donoProd = prod.dono || comprador;
        const id = 'p' + prod.id + '_' + comprador;
        const todas = lerConversas();
        let c = todas.find(x => x.id === id);
        if (!c) {
            c = {
                id: id,
                produtoId: prod.id,
                produtoNome: prod.nome,
                vendedor: donoProd,
                comprador: comprador,
                criadaEm: Date.now(),
                atualizadaEm: Date.now(),
                expiraEm: Date.now() + DIAS_HISTORICO * UM_DIA,
                mensagens: [],
                lidas: {}
            };
            todas.unshift(c);
            guardarConversas(todas);
        }
        return c;
    }

    // =====================================================
    // SELO DE MENSAGENS NO TOPO (Mantém o botão no sítio original)
    // =====================================================
    const btnChatTopo = document.getElementById('btn-abrir-chat');
    let selo = null;
    
    if (btnChatTopo) {
        // ATENÇÃO: NÃO MEXEMOS NO POSITION DO BOTÃO PAI PARA ELE NÃO SAIR DO SÍTIO!
        selo = btnChatTopo.querySelector('.chat-selo');
        if (!selo) {
            selo = document.createElement('span');
            selo.className = 'chat-selo';
            btnChatTopo.appendChild(selo);
        }

        // Estilo do selo estilo iOS integrado de forma segura
        selo.style.cssText = `
            position: absolute;
            top: -5px;
            right: -5px;
            background-color: #ff3b30;
            color: #ffffff;
            font-size: 11px;
            font-weight: 700;
            min-width: 18px;
            height: 18px;
            border-radius: 999px;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 0 4px;
            border: 2px solid #ffffff;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            line-height: 1;
            z-index: 10;
        `;
    }

    function atualizarSelo() {
        if (!selo) return;
        const eu = usuarioAtual();
        const n = eu ? totalNaoLidas(eu) : 0;
        selo.textContent = n > 9 ? '9+' : String(n);
        selo.style.display = n > 0 ? 'inline-flex' : 'none';
    }

    // =====================================================
    // FUNÇÃO GLOBAL CHAMADA PELA LOJA.JS AO CLICAR EM "FALAR NO SITE"
    // =====================================================
    window.abrirChatComVendedor = function(prod) {
        const eu = usuarioAtual();
        if (!eu) {
            clicar('btn-abrir-login');
            return;
        }
        
        if (prod.dono && prod.dono === eu) {
            alert('Este anúncio é seu.');
            return;
        }

        const conversa = obterConversa(prod, eu);
        abrirMensagens(conversa.id);
    };

    // =====================================================
    // O PAINEL DO MESSENGER
    // =====================================================
    const painel = document.createElement('div');
    painel.className = 'msg-painel';
    painel.innerHTML = `
        <div class="msg-topo">
            <button type="button" class="msg-voltar">← Voltar</button>
            <h2>Mensagens</h2>
        </div>
        <div class="msg-corpo">
            <aside class="msg-lista"></aside>
            <section class="msg-conversa"></section>
        </div>
    `;
    document.body.appendChild(painel);

    function desenharLista() {
        const eu = usuarioAtual();
        const caixa = painel.querySelector('.msg-lista');
        if (!caixa) return;
        caixa.innerHTML = '';

        const minhas = lerConversas()
            .filter(c => (c.vendedor === eu || c.comprador === eu) &&
                         (c.mensagens.length > 0 || c.id === conversaAtiva))
            .sort((a, b) => (b.atualizadaEm || 0) - (a.atualizadaEm || 0));

        if (minhas.length === 0) {
            const vazio = document.createElement('p');
            vazio.className = 'msg-lista-vazia';
            vazio.textContent = 'Ainda não tem conversas. Clique em "Contactar Vendedor" num anúncio para começar.';
            caixa.appendChild(vazio);
            return;
        }

        minhas.forEach(c => {
            const outro = (c.vendedor === eu) ? c.comprador : c.vendedor;
            const nome = nomeDe(outro);
            const ultima = c.mensagens[c.mensagens.length - 1];
            const n = naoLidas(c, eu);

            const item = document.createElement('div');
            item.className = 'msg-item' + (c.id === conversaAtiva ? ' ativa' : '');
            item.innerHTML = `
                <div class="msg-avatar"></div>
                <div class="msg-item-meio">
                    <span class="msg-item-nome"></span>
                    <span class="msg-item-produto"></span>
                    <span class="msg-item-previa"></span>
                </div>
                <div class="msg-item-lado"><span class="msg-item-hora"></span></div>
            `;
            item.querySelector('.msg-avatar').textContent = nome.charAt(0);
            item.querySelector('.msg-item-nome').textContent = nome;
            item.querySelector('.msg-item-produto').textContent = c.produtoNome;
            item.querySelector('.msg-item-previa').textContent = ultima
                ? ((ultima.de === eu ? 'Você: ' : '') + ultima.texto)
                : 'Sem mensagens';
            item.querySelector('.msg-item-hora').textContent = ultima ? formatarHora(ultima.em) : '';

            if (n > 0) {
                const bolinha = document.createElement('span');
                bolinha.className = 'msg-item-selo';
                bolinha.textContent = n;
                item.querySelector('.msg-item-lado').appendChild(bolinha);
            }

            item.addEventListener('click', () => {
                mostrarConversa(c.id);
                painel.classList.add('ver-conversa');
            });
            caixa.appendChild(item);
        });
    }

    function desenharMensagens() {
        const caixa = painel.querySelector('.msg-mensagens');
        if (!caixa || !conversaAtiva) return;

        marcarLida(conversaAtiva);
        const c = lerConversas().find(x => x.id === conversaAtiva);
        if (!c) return;
        const eu = usuarioAtual();

        caixa.innerHTML = '';
        if (c.mensagens.length === 0) {
            const vazio = document.createElement('p');
            vazio.className = 'msg-sem-mensagens';
            vazio.textContent = 'Ainda não há mensagens. Escreva a primeira!';
            caixa.appendChild(vazio);
        }

        c.mensagens.forEach(m => {
            const bolha = document.createElement('div');
            bolha.className = 'msg-bolha ' + (m.de === eu ? 'minha' : 'dele');
            const texto = document.createElement('span');
            texto.textContent = m.texto;
            const hora = document.createElement('small');
            hora.textContent = formatarHora(m.em);
            bolha.appendChild(texto);
            bolha.appendChild(hora);
            caixa.appendChild(bolha);
        });

        caixa.scrollTop = caixa.scrollHeight;
    }

    function mostrarConversa(id) {
        conversaAtiva = id;
        const area = painel.querySelector('.msg-conversa');
        const eu = usuarioAtual();
        const c = id ? lerConversas().find(x => x.id === id) : null;

        if (!c) {
            conversaAtiva = null;
            area.innerHTML = '<div class="msg-vazio">Escolha uma conversa para começar.</div>';
            desenharLista();
            return;
        }

        const outro = (c.vendedor === eu) ? c.comprador : c.vendedor;
        area.innerHTML = `
            <div class="msg-conv-topo">
                <button type="button" class="msg-conv-voltar" aria-label="Voltar à lista">←</button>
                <div class="msg-avatar"></div>
                <div class="msg-conv-info">
                    <strong class="msg-conv-nome"></strong>
                    <small class="msg-conv-produto"></small>
                </div>
            </div>
            <div class="msg-mensagens"></div>
            <p class="msg-aviso-historico">Por privacidade, a conversa é guardada ${DIAS_HISTORICO} dias após a última mensagem e depois é eliminada.</p>
            <form class="msg-form">
                <input type="text" class="msg-input" placeholder="Escreva a mensagem..." maxlength="1000" autocomplete="off">
                <button type="submit">Enviar</button>
            </form>
        `;

        area.querySelector('.msg-avatar').textContent = nomeDe(outro).charAt(0);
        area.querySelector('.msg-conv-nome').textContent = nomeDe(outro);
        area.querySelector('.msg-conv-produto').textContent = 'Produto: ' + c.produtoNome;

        area.querySelector('.msg-conv-voltar').addEventListener('click', () => {
            painel.classList.remove('ver-conversa');
        });

        const form = area.querySelector('.msg-form');
        const input = area.querySelector('.msg-input');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const texto = input.value.trim();
            if (!texto) return;
            input.value = '';
            enviar(texto);
        });

        desenharMensagens();
        desenharLista();
        atualizarSelo();
        input.focus();
    }

    function enviar(texto) {
        const eu = usuarioAtual();
        const todas = lerConversas();
        const c = todas.find(x => x.id === conversaAtiva);
        if (!c || !eu) {
            alert('Esta conversa já não existe.');
            return;
        }

        const agora = Date.now();
        c.mensagens.push({ de: eu, texto: texto, em: agora });
        c.atualizadaEm = agora;
        c.expiraEm = agora + DIAS_HISTORICO * UM_DIA;
        c.lidas = c.lidas || {};
        c.lidas[eu] = agora;

        if (!guardarConversas(todas)) return;
        desenharMensagens();
        desenharLista();
    }

    function abrirMensagens(id) {
        if (!usuarioAtual()) {
            clicar('btn-abrir-login');
            return;
        }
        limparExpiradas();
        painel.classList.add('aberta');
        document.body.classList.add('sem-scroll');

        if (id) {
            mostrarConversa(id);
            painel.classList.add('ver-conversa');
        } else {
            painel.classList.remove('ver-conversa');
            mostrarConversa(null);
        }
    }

    function fecharMensagens() {
        painel.classList.remove('aberta');
        painel.classList.remove('ver-conversa');
        document.body.classList.remove('sem-scroll');
        conversaAtiva = null;
        atualizarSelo();
    }

    if (btnChatTopo) btnChatTopo.addEventListener('click', () => abrirMensagens());

    painel.querySelector('.msg-voltar').addEventListener('click', fecharMensagens);

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (painel.classList.contains('aberta')) fecharMensagens();
    });

    window.addEventListener('ls:sessao', () => {
        fecharMensagens();
        atualizarSelo();
    });

    window.addEventListener('storage', (e) => {
        if (e.key !== null && e.key !== CHAVE) return;
        atualizarSelo();
        if (painel.classList.contains('aberta')) {
            desenharLista();
            desenharMensagens();
        }
    });

    limparExpiradas();
    atualizarSelo();
});