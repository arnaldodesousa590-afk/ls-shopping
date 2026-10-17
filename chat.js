// =========================================================
// LS SHOPPING - Chat do site (chat.js)
//
// - Cada mensagem é uma linha própria na base de dados (já não se perdem
//   mensagens quando duas pessoas escrevem ao mesmo tempo).
// - Tempo real: as mensagens aparecem sem recarregar a página
//   (se o tempo real falhar, atualiza sozinho de 15 em 15 segundos).
// - Selo de mensagens não lidas, apagar conversa e histórico de 7 dias.
// - Se não conseguir iniciar uma conversa, diz o motivo (tabela em falta,
//   permissão, vendedor sem perfil...) e escreve o detalhe na consola (F12).
//
// Precisa de ter corrido o ficheiro supabase-setup.sql no Supabase.
// =========================================================

const supabaseChat = window.supabaseLS;

document.addEventListener('DOMContentLoaded', () => {

    const DIAS_HISTORICO = 7;
    const MAX_MENSAGENS = 200;          // mensagens mostradas por conversa
    const TITULO_ORIGINAL = document.title;

    let meuId = '';                     // ID da pessoa com sessão (Supabase)
    let meuNome = '';                   // nome mostrado no chat
    let conversas = [];                 // as minhas conversas
    let conversaAtiva = null;           // id da conversa aberta
    let mensagens = [];                 // mensagens da conversa aberta
    let canal = null;                   // ligação em tempo real
    let tempoRealOk = false;
    let timerAtualizacao = null;

    // Estilos extra (ficam aqui dentro: não é preciso mexer no style.css)
    const estiloChat = document.createElement('style');
    estiloChat.textContent = `
        .msg-conv-apagar {
            margin-left: auto; flex: none; background: none;
            border: 1px solid #c62828; color: #c62828; border-radius: 8px;
            padding: 6px 12px; font-size: 13px; font-weight: 600; cursor: pointer;
        }
        .msg-conv-apagar:hover { background: #c62828; color: #fff; }
        .msg-dia {
            align-self: center; font-size: 11px; color: #667085; background: #e8ecf5;
            border-radius: 10px; padding: 3px 10px; margin: 6px 0;
        }
        .msg-bolha.pendente { opacity: .6; }
        .msg-bolha.falhou { background: #fdecea; color: #8a1c1c; border: 1px solid #f5c2c0; cursor: pointer; }
        .msg-bolha.falhou small { opacity: 1; font-weight: 600; }
    `;
    document.head.appendChild(estiloChat);

    // ---------------------------------------------------------
    // Funções pequenas de ajuda
    // ---------------------------------------------------------
    function notificar(mensagem, tipo) {
        if (window.avisar) window.avisar(mensagem, tipo);
        else alert(mensagem);
    }

    function clicar(id) {
        const el = document.getElementById(id);
        if (el) el.click();
    }

    function nomeDe(email) {
        return String(email || '').split('@')[0];
    }

    function hora(ts) {
        const d = new Date(ts);
        return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }

    function formatarHora(ts) {
        const d = new Date(ts);
        if (d.toDateString() === new Date().toDateString()) return hora(ts);
        return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + ' ' + hora(ts);
    }

    function nomeDoDia(ts) {
        const d = new Date(ts);
        const hoje = new Date();
        const ontem = new Date();
        ontem.setDate(hoje.getDate() - 1);
        if (d.toDateString() === hoje.toDateString()) return 'Hoje';
        if (d.toDateString() === ontem.toDateString()) return 'Ontem';
        return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    }

    // Vai buscar o ID e o nome da pessoa com sessão
    async function carregarMeuId() {
        meuId = '';
        meuNome = '';
        if (!supabaseChat) return false;
        const { data } = await supabaseChat.auth.getSession();
        if (data && data.session && data.session.user) {
            const u = data.session.user;
            meuId = u.id;
            meuNome = (u.user_metadata && u.user_metadata.nome) || nomeDe(u.email);
        }
        return !!meuId;
    }

    async function garantirSessao() {
        if (meuId) return true;
        return carregarMeuId();
    }

    // ---------------------------------------------------------
    // Ler conversas e mensagens
    // ---------------------------------------------------------
    function mapearConversa(c) {
        const souVendedor = c.vendedor_id === meuId;
        return {
            id: c.id,
            produtoNome: c.produto_nome || '',
            nomeOutro: souVendedor ? (c.comprador_nome || 'Cliente') : (c.vendedor_nome || 'Vendedor'),
            atualizadaEm: new Date(c.atualizada_em).getTime(),
            ultimaMensagem: c.ultima_mensagem || '',
            ultimaDe: c.ultima_de || '',
            ultimaEm: c.ultima_em ? new Date(c.ultima_em).getTime() : 0,
            naoLidas: (souVendedor ? c.vendedor_nao_lidas : c.comprador_nao_lidas) || 0
        };
    }

    function mapearMensagem(m) {
        return { id: m.id, de: m.de_id, texto: m.texto, em: new Date(m.criada_em).getTime(), estado: '' };
    }

    async function carregarConversas() {
        if (!supabaseChat || !meuId) {
            conversas = [];
            return conversas;
        }
        const { data, error } = await supabaseChat
            .from('chat_conversas')
            .select('*')
            .order('atualizada_em', { ascending: false });

        if (error) {
            console.error('chat.js: erro a ler as conversas:', error.message);
            return conversas;
        }
        conversas = (data || []).map(mapearConversa);
        return conversas;
    }

    async function carregarMensagens(id) {
        const { data, error } = await supabaseChat
            .from('chat_mensagens')
            .select('id,de_id,texto,criada_em')
            .eq('conversa_id', id)
            .order('id', { ascending: false })
            .limit(MAX_MENSAGENS);

        if (error) {
            console.error('chat.js: erro a ler as mensagens:', error.message);
            return null;
        }
        return (data || []).reverse().map(mapearMensagem);
    }

    // Apaga as minhas conversas que já passaram os 7 dias
    async function limparExpiradas() {
        if (!supabaseChat || !meuId) return;
        await supabaseChat.from('chat_conversas').delete().lt('expira_em', new Date().toISOString());
    }

    function totalNaoLidas() {
        return conversas.reduce((soma, c) => soma + c.naoLidas, 0);
    }

    // ---------------------------------------------------------
    // Selo de mensagens no topo
    // ---------------------------------------------------------
    const btnChatTopo = document.getElementById('btn-abrir-chat');
    let selo = null;

    if (btnChatTopo) {
        selo = btnChatTopo.querySelector('.chat-selo');
        if (!selo) {
            selo = document.createElement('span');
            selo.className = 'chat-selo';
            btnChatTopo.appendChild(selo);
        }

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
        const n = meuId ? totalNaoLidas() : 0;
        if (selo) {
            selo.textContent = n > 9 ? '9+' : String(n);
            selo.style.display = n > 0 ? 'inline-flex' : 'none';
        }
        document.title = (n > 0 ? '(' + (n > 9 ? '9+' : n) + ') ' : '') + TITULO_ORIGINAL;
    }

    // ---------------------------------------------------------
    // O painel do Messenger
    // ---------------------------------------------------------
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

    function painelAberto() {
        return painel.classList.contains('aberta');
    }

    // A lista da esquerda (usa as conversas que já temos em memória)
    function desenharLista() {
        const caixa = painel.querySelector('.msg-lista');
        if (!caixa) return;
        caixa.innerHTML = '';

        const visiveis = conversas
            .filter(c => c.ultimaMensagem || c.id === conversaAtiva)
            .sort((a, b) => b.atualizadaEm - a.atualizadaEm);

        if (visiveis.length === 0) {
            const vazio = document.createElement('p');
            vazio.className = 'msg-lista-vazia';
            vazio.textContent = 'Ainda não tem conversas. Clique em "Contactar Vendedor" num anúncio para começar.';
            caixa.appendChild(vazio);
            return;
        }

        visiveis.forEach(c => {
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
            item.querySelector('.msg-avatar').textContent = c.nomeOutro.charAt(0).toUpperCase();
            item.querySelector('.msg-item-nome').textContent = c.nomeOutro;
            item.querySelector('.msg-item-produto').textContent = c.produtoNome;
            item.querySelector('.msg-item-previa').textContent = c.ultimaMensagem
                ? ((c.ultimaDe === meuId ? 'Você: ' : '') + c.ultimaMensagem)
                : 'Sem mensagens';
            item.querySelector('.msg-item-hora').textContent = c.ultimaEm ? formatarHora(c.ultimaEm) : '';

            if (c.naoLidas > 0) {
                const bolinha = document.createElement('span');
                bolinha.className = 'msg-item-selo';
                bolinha.textContent = c.naoLidas > 9 ? '9+' : c.naoLidas;
                item.querySelector('.msg-item-lado').appendChild(bolinha);
            }

            item.addEventListener('click', () => {
                mostrarConversa(c.id);
                painel.classList.add('ver-conversa');
            });
            caixa.appendChild(item);
        });
    }

    // As bolhas da conversa aberta
    function desenharMensagens(opcoes) {
        const caixa = painel.querySelector('.msg-mensagens');
        if (!caixa || !conversaAtiva) return;
        const o = opcoes || {};

        const pertoDoFim = (caixa.scrollHeight - caixa.scrollTop - caixa.clientHeight) < 80;
        caixa.innerHTML = '';

        if (mensagens.length === 0) {
            const vazio = document.createElement('p');
            vazio.className = 'msg-sem-mensagens';
            vazio.textContent = 'Ainda não há mensagens. Escreva a primeira!';
            caixa.appendChild(vazio);
        }

        let diaAnterior = '';
        mensagens.forEach(m => {
            const dia = new Date(m.em).toDateString();
            if (dia !== diaAnterior) {
                diaAnterior = dia;
                const sep = document.createElement('div');
                sep.className = 'msg-dia';
                sep.textContent = nomeDoDia(m.em);
                caixa.appendChild(sep);
            }

            const bolha = document.createElement('div');
            bolha.className = 'msg-bolha ' + (m.de === meuId ? 'minha' : 'dele')
                + (m.estado ? ' ' + m.estado : '');

            const texto = document.createElement('span');
            texto.textContent = m.texto;
            texto.style.whiteSpace = 'pre-wrap';        // respeita as mudanças de linha
            texto.style.overflowWrap = 'anywhere';

            const info = document.createElement('small');
            info.textContent = m.estado === 'falhou'
                ? 'Não enviada. Toque para tentar outra vez'
                : (m.estado === 'pendente' ? 'A enviar...' : hora(m.em));

            bolha.appendChild(texto);
            bolha.appendChild(info);

            if (m.estado === 'falhou') {
                bolha.addEventListener('click', () => {
                    mensagens = mensagens.filter(x => x !== m);
                    enviar(m.texto);
                });
            }
            caixa.appendChild(bolha);
        });

        if (o.fim || pertoDoFim) caixa.scrollTop = caixa.scrollHeight;
    }

    // ---------------------------------------------------------
    // Ler / apagar / enviar
    // ---------------------------------------------------------
    async function marcarLida(id, forcar) {
        if (!supabaseChat || !meuId) return;
        const c = conversas.find(x => x.id === id);
        if (!forcar && (!c || c.naoLidas === 0)) return;
        if (c) {
            c.naoLidas = 0;
            atualizarSelo();
            desenharLista();
        }
        const { error } = await supabaseChat.rpc('chat_marcar_lida', { p_conversa: id });
        if (error) console.error('chat.js: erro a marcar como lida:', error.message);
    }

    async function recarregarMensagens() {
        const id = conversaAtiva;
        if (!id || !supabaseChat) return;
        const lista = await carregarMensagens(id);
        if (!lista || id !== conversaAtiva) return;
        const pendentes = mensagens.filter(m => m.estado);   // as que ainda estão a enviar / falharam
        mensagens = lista.concat(pendentes);
        desenharMensagens();
    }

    function agendarAtualizacao() {
        clearTimeout(timerAtualizacao);
        timerAtualizacao = setTimeout(async () => {
            if (!meuId) return;
            await carregarConversas();
            atualizarSelo();
            if (painelAberto()) {
                desenharLista();
                // se a conversa aberta tem mensagens novas por ler, marca-as como lidas
                if (conversaAtiva) marcarLida(conversaAtiva);
            }
        }, 200);
    }

    function textoDoErroDeEnvio(error) {
        const msg = String((error && error.message) || '');
        if (/depressa demais/i.test(msg)) return msg;
        if (error && (error.code === '42501' || error.code === '23503' || /row-level security|foreign key/i.test(msg))) {
            return 'Esta conversa já não existe.';
        }
        return 'Não foi possível enviar a mensagem. Verifique a ligação e tente outra vez.';
    }

    // Explica porque falhou ao iniciar uma conversa (e não só "tente novamente")
    function textoDoErroDeConversa(error) {
        const msg = String((error && error.message) || '');
        const codigo = String((error && error.code) || '');

        if (codigo === '42P01' || codigo === 'PGRST205' ||
            /does not exist|schema cache|could not find the table/i.test(msg)) {
            return 'O chat ainda não está instalado na base de dados (falta correr o supabase-setup.sql no Supabase).';
        }
        if (codigo === '42501' || /row-level security|permission denied/i.test(msg)) {
            return 'Sem permissão para iniciar a conversa. Verifique as regras (RLS) da tabela chat_conversas.';
        }
        if (codigo === '23503' || /foreign key/i.test(msg)) {
            return 'Não foi possível iniciar a conversa: o vendedor deste anúncio não tem perfil registado.';
        }
        if (codigo === '22P02' || /invalid input syntax/i.test(msg)) {
            return 'Não foi possível iniciar a conversa: um identificador não tem o formato esperado pela base de dados.';
        }
        if (/failed to fetch|network/i.test(msg)) {
            return 'Sem ligação à internet. Tente outra vez.';
        }
        return 'Não foi possível iniciar a conversa. Tente outra vez.';
    }

    async function enviar(texto) {
        const c = conversas.find(x => x.id === conversaAtiva);
        if (!c || !meuId) {
            notificar('Esta conversa já não existe.', 'erro');
            return;
        }

        // Aparece logo (a cinzento) e é confirmada quando o servidor responder
        const provisoria = { id: -Date.now(), de: meuId, texto: texto, em: Date.now(), estado: 'pendente' };
        mensagens.push(provisoria);
        desenharMensagens({ fim: true });

        const { data, error } = await supabaseChat
            .from('chat_mensagens')
            .insert({ conversa_id: c.id, de_id: meuId, texto: texto })
            .select('id,de_id,texto,criada_em')
            .single();

        mensagens = mensagens.filter(m => m !== provisoria);

        if (error || !data) {
            console.error('chat.js: erro a enviar:', error && error.message);
            provisoria.estado = 'falhou';
            mensagens.push(provisoria);
            desenharMensagens({ fim: true });
            notificar(textoDoErroDeEnvio(error), 'erro');
            if (error && (error.code === '42501' || error.code === '23503')) agendarAtualizacao();
            return;
        }

        const real = mapearMensagem(data);
        if (!mensagens.some(m => m.id === real.id)) mensagens.push(real);   // o tempo real pode já a ter trazido
        desenharMensagens({ fim: true });
        agendarAtualizacao();
    }

    async function apagarConversa(id) {
        const aviso = 'Tem a certeza que quer apagar esta conversa?\n' +
                      'As mensagens serão eliminadas para os dois lados e não poderão ser recuperadas.';
        const confirmado = window.confirmar
            ? await window.confirmar(aviso, { titulo: 'Apagar conversa', sim: 'Sim', nao: 'Não', perigo: true })
            : window.confirm(aviso);
        if (!confirmado) return;

        // .select() devolve as linhas apagadas: se vier vazio, a base de dados bloqueou
        const { data, error } = await supabaseChat
            .from('chat_conversas')
            .delete()
            .eq('id', id)
            .select('id');

        if (error || !data || data.length === 0) {
            if (error) console.error('chat.js: erro a apagar:', error.message);
            notificar('Não foi possível apagar a conversa. Tente outra vez.', 'erro');
            return;
        }

        conversas = conversas.filter(x => x.id !== id);
        conversaAtiva = null;
        mensagens = [];
        painel.classList.remove('ver-conversa');
        await mostrarConversa(null);
        atualizarSelo();
        notificar('Conversa apagada com sucesso.', 'ok');
    }

    // ---------------------------------------------------------
    // Mostrar uma conversa (lado direito)
    // ---------------------------------------------------------
    async function mostrarConversa(id) {
        conversaAtiva = id;
        const area = painel.querySelector('.msg-conversa');
        const c = id ? conversas.find(x => x.id === id) : null;

        if (!c) {
            conversaAtiva = null;
            mensagens = [];
            area.innerHTML = '<div class="msg-vazio">Escolha uma conversa para começar.</div>';
            desenharLista();
            return;
        }

        mensagens = [];
        area.innerHTML = `
            <div class="msg-conv-topo">
                <button type="button" class="msg-conv-voltar" aria-label="Voltar à lista">←</button>
                <div class="msg-avatar"></div>
                <div class="msg-conv-info">
                    <strong class="msg-conv-nome"></strong>
                    <small class="msg-conv-produto"></small>
                </div>
                <button type="button" class="msg-conv-apagar" aria-label="Apagar conversa">Apagar</button>
            </div>
            <div class="msg-mensagens" aria-live="polite"></div>
            <p class="msg-aviso-historico">Por privacidade, a conversa é guardada ${DIAS_HISTORICO} dias após a última mensagem e depois é eliminada.</p>
            <form class="msg-form">
                <textarea class="msg-input" rows="1" placeholder="Escreva a mensagem..." maxlength="1000" autocomplete="off" enterkeyhint="enter"></textarea>
                <button type="submit">Enviar</button>
            </form>
        `;

        area.querySelector('.msg-avatar').textContent = c.nomeOutro.charAt(0).toUpperCase();
        area.querySelector('.msg-conv-nome').textContent = c.nomeOutro;
        area.querySelector('.msg-conv-produto').textContent = 'Produto: ' + c.produtoNome;

        area.querySelector('.msg-conv-voltar').addEventListener('click', () => {
            painel.classList.remove('ver-conversa');
        });
        area.querySelector('.msg-conv-apagar').addEventListener('click', () => {
            apagarConversa(c.id);
        });

        const form = area.querySelector('.msg-form');
        const input = area.querySelector('.msg-input');

        // Campo de várias linhas que cresce à medida que se escreve (até 5 linhas)
        input.style.resize = 'none';
        input.style.fontFamily = 'inherit';
        input.style.overflowY = 'auto';
        input.style.lineHeight = '1.4';
        input.style.maxHeight = '120px';
        function ajustarAltura() {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        }
        input.addEventListener('input', ajustarAltura);

        // No telemóvel o Enter muda de linha (envia-se com o botão "Enviar").
        // No computador o Enter envia e Shift+Enter muda de linha.
        const ecraDeToque = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !ecraDeToque) {
                e.preventDefault();
                const botaoEnviar = form.querySelector('button[type="submit"]');
                if (botaoEnviar) botaoEnviar.click();
            }
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const texto = input.value.trim();
            if (!texto) return;
            input.value = '';
            ajustarAltura();
            input.focus();   // o teclado do telemóvel fica aberto para a mensagem seguinte
            await enviar(texto);
        });

        desenharMensagens();     // "Ainda não há mensagens" enquanto carrega
        desenharLista();

        const lista = await carregarMensagens(id);
        if (id !== conversaAtiva) return;     // a pessoa já abriu outra conversa
        if (lista) mensagens = lista;
        desenharMensagens({ fim: true });
        await marcarLida(id);
        // No telemóvel não abre o teclado sozinho (era isso que desalinhava o ecrã)
        if (!ecraDeToque) input.focus();
    }

    // ---------------------------------------------------------
    // TELEMÓVEL: o chat ocupa o ecrã todo e a página do início fica "congelada"
    //  - o body fica fixo (não se mexe nem com o teclado aberto)
    //  - o painel acompanha a área realmente visível (com o teclado)
    //  - tudo o que está por trás fica desativado (não se clica, não recebe foco)
    // ---------------------------------------------------------
    const vv = window.visualViewport;
    let scrollGuardado = 0;
    let bloqueado = false;
    let desativados = [];

    function ajustarAoEcra() {
        if (!bloqueado) return;
        if (vv) {
            painel.style.setProperty('height', vv.height + 'px', 'important');
            painel.style.setProperty('top', vv.offsetTop + 'px', 'important');
        }
        // se o navegador empurrou a página, volta ao sítio
        if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
    }

    function bloquearPagina() {
        if (bloqueado) return;
        bloqueado = true;
        scrollGuardado = window.pageYOffset || document.documentElement.scrollTop || 0;
        const b = document.body.style;
        b.position = 'fixed';
        b.top = (-scrollGuardado) + 'px';
        b.left = '0';
        b.right = '0';
        b.width = '100%';
        b.overflow = 'hidden';

        desativados = [];
        Array.from(document.body.children).forEach(el => {
            if (el === painel || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
            // janelas do aviso.js (avisos/confirmações) têm de continuar a funcionar
            if (/aviso|toast|confirm|ls-/i.test(el.id + ' ' + el.className)) return;
            if (el.hasAttribute('inert')) return;
            el.setAttribute('inert', '');
            desativados.push(el);
        });

        ajustarAoEcra();
    }

    function libertarPagina() {
        if (!bloqueado) return;
        bloqueado = false;
        const b = document.body.style;
        b.position = b.top = b.left = b.right = b.width = b.overflow = '';
        painel.style.removeProperty('height');
        painel.style.removeProperty('top');
        desativados.forEach(el => el.removeAttribute('inert'));
        desativados = [];
        window.scrollTo(0, scrollGuardado);
    }

    if (vv) {
        vv.addEventListener('resize', ajustarAoEcra);
        vv.addEventListener('scroll', ajustarAoEcra);
    }
    window.addEventListener('scroll', ajustarAoEcra, { passive: true });

    // a lista e as mensagens deslizam sozinhas, sem arrastar a página
    const estiloEcra = document.createElement('style');
    estiloEcra.textContent = `
        .msg-painel { overscroll-behavior: none; touch-action: manipulation; }
        .msg-lista, .msg-mensagens { overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
        .msg-input { font-size: 16px; }  /* evita o "zoom" automático do iPhone ao escrever */
    `;
    document.head.appendChild(estiloEcra);

    // ---------------------------------------------------------
    // Abrir e fechar o painel
    // ---------------------------------------------------------
    async function abrirMensagens(id) {
        if (!(await garantirSessao())) {
            clicar('btn-abrir-login');
            return;
        }
        painel.classList.add('aberta');
        document.body.classList.add('sem-scroll');
        bloquearPagina();

        if (!conversas.length || id) await carregarConversas();
        desenharLista();

        if (id) {
            await mostrarConversa(id);
            painel.classList.add('ver-conversa');
        } else {
            painel.classList.remove('ver-conversa');
            await mostrarConversa(null);
        }
        limparExpiradas();
    }

    function fecharMensagens() {
        painel.classList.remove('aberta');
        painel.classList.remove('ver-conversa');
        document.body.classList.remove('sem-scroll');
        libertarPagina();
        conversaAtiva = null;
        mensagens = [];
        atualizarSelo();
        if (meuId) agendarAtualizacao();
    }

    // Chamado pela montra ("Contactar Vendedor" > "Falar no Site")
    window.abrirChatComVendedor = async function (prod) {
        if (!supabaseChat) {
            notificar('O chat não está disponível neste momento.', 'erro');
            return;
        }
        if (!(await garantirSessao())) {
            clicar('btn-abrir-login');
            return;
        }

        const dono = String((prod && (prod.dono || prod.user_id)) || '');
        if (!dono) {
            notificar('Este anúncio não tem chat disponível. Use o WhatsApp.', 'aviso');
            return;
        }
        if (dono === meuId) {
            notificar('Este anúncio é seu. Não pode enviar mensagens a si próprio.', 'aviso');
            return;
        }

        const idConversa = 'p' + prod.id + '_' + meuId;
        await carregarConversas();

        if (!conversas.some(c => c.id === idConversa)) {
            const { error } = await supabaseChat.from('chat_conversas').insert({
                id: idConversa,
                produto_id: String(prod.id),
                produto_nome: prod.nome || prod.titulo || '',
                vendedor_id: dono,
                vendedor_nome: prod.donoNome || '',
                comprador_id: meuId,
                comprador_nome: meuNome
            });
            // 23505 = a conversa já existe (aberta noutro separador): não é erro
            if (error && error.code !== '23505') {
                // O detalhe completo fica na consola (F12) para se perceber a causa
                console.error('chat.js: erro a iniciar a conversa:',
                    { codigo: error.code, mensagem: error.message, detalhes: error.details, dica: error.hint });
                notificar(textoDoErroDeConversa(error), 'erro');
                return;
            }
            await carregarConversas();

            // Foi criada mas não aparece na leitura: falta a permissão de leitura (SELECT)
            if (!conversas.some(c => c.id === idConversa)) {
                console.error('chat.js: a conversa foi criada mas não pode ser lida (verifique a regra SELECT de chat_conversas).');
                notificar('A conversa foi criada mas não pode ser lida. Verifique a permissão de leitura da tabela chat_conversas.', 'erro');
                return;
            }
        }
        abrirMensagens(idConversa);
    };

    if (btnChatTopo) btnChatTopo.addEventListener('click', () => abrirMensagens());
    painel.querySelector('.msg-voltar').addEventListener('click', fecharMensagens);

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (painelAberto()) fecharMensagens();
    });

    // ---------------------------------------------------------
    // Tempo real
    // ---------------------------------------------------------
    function aoChegarMensagem(m) {
        if (!m) return;
        if (m.conversa_id === conversaAtiva) {
            if (mensagens.some(x => x.id === m.id)) return;

            // o "eco" da minha própria mensagem substitui a cinzenta que ainda está a enviar
            if (m.de_id === meuId) {
                const i = mensagens.findIndex(x => x.estado === 'pendente' && x.texto === m.texto);
                if (i >= 0) mensagens.splice(i, 1);
            }

            mensagens.push(mapearMensagem(m));
            desenharMensagens({ fim: m.de_id === meuId });
            if (m.de_id !== meuId && painelAberto()) marcarLida(conversaAtiva, true);
        }
        agendarAtualizacao();
    }

    // A outra pessoa apagou a conversa (ou expirou): sai da minha lista na hora
    function aoApagarConversa(velha) {
        const id = velha && velha.id;
        if (!id) return;
        if (!conversas.some(c => c.id === id)) return;   // fui eu que apaguei: já foi tratado

        conversas = conversas.filter(c => c.id !== id);
        atualizarSelo();

        if (conversaAtiva === id) {
            conversaAtiva = null;
            mensagens = [];
            painel.classList.remove('ver-conversa');
            mostrarConversa(null);
            notificar('Esta conversa foi apagada.', 'aviso');
        } else if (painelAberto()) {
            desenharLista();
        }
    }

    function pararTempoReal() {
        if (canal) {
            try { supabaseChat.removeChannel(canal); } catch (e) { /* ignorar */ }
            canal = null;
        }
        tempoRealOk = false;
    }

    function iniciarTempoReal() {
        pararTempoReal();
        if (!supabaseChat || !meuId || typeof supabaseChat.channel !== 'function') return;
        try {
            canal = supabaseChat
                .channel('ls-chat-' + meuId)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensagens' },
                    (p) => aoChegarMensagem(p.new))
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_conversas' },
                    () => agendarAtualizacao())
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_conversas' },
                    () => agendarAtualizacao())
                .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_conversas' },
                    (p) => aoApagarConversa(p.old))
                .subscribe((estado) => {
                    tempoRealOk = (estado === 'SUBSCRIBED');
                    if (estado === 'SUBSCRIBED') {
                        // (re)ligou: apanha o que possa ter chegado entretanto
                        agendarAtualizacao();
                        if (conversaAtiva) recarregarMensagens();
                    }
                });
        } catch (e) {
            console.error('chat.js: tempo real indisponível:', e);
            tempoRealOk = false;
        }
    }

    // Se o tempo real falhar, atualiza de 15 em 15 segundos
    setInterval(() => {
        if (!meuId || document.hidden || tempoRealOk) return;
        agendarAtualizacao();
        if (conversaAtiva) recarregarMensagens();
    }, 15000);

    // Ao voltar ao separador, atualiza logo
    document.addEventListener('visibilitychange', () => {
        if (document.hidden || !meuId) return;
        agendarAtualizacao();
        if (conversaAtiva) recarregarMensagens();
    });

    // ---------------------------------------------------------
    // Início e mudança de sessão
    // ---------------------------------------------------------
    window.addEventListener('ls:sessao', async () => {
        pararTempoReal();
        conversas = [];
        mensagens = [];
        conversaAtiva = null;
        const ok = await carregarMeuId();
        fecharMensagens();
        if (ok) {
            await limparExpiradas();
            await carregarConversas();
            iniciarTempoReal();
        }
        atualizarSelo();
    });

    (async () => {
        if (await carregarMeuId()) {
            await limparExpiradas();
            await carregarConversas();
            iniciarTempoReal();
        }
        atualizarSelo();
    })();
});