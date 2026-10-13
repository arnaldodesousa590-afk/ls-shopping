// =========================================================
// LS SHOPPING - Contacto e chat do site (chat.js)
// Versão Supabase Integrada e com Selo iOS
// =========================================================

const supabaseChat = window.supabase ? window.supabase.createClient('https://anlzhexippncsdxnwiel.supabase.co', 'sb_publishable_XUgtq7ktyeAhE8_bFya5ug_UBFoY') : null;

document.addEventListener('DOMContentLoaded', () => {

    const DIAS_HISTORICO = 7;
    const UM_DIA = 24 * 60 * 60 * 1000;

    let conversaAtiva = null;
    let cacheConversas = [];

    function usuarioAtual() {
        return localStorage.getItem('ls_sessao') || localStorage.getItem('ls_usuario') || '';
    }

    function nomeDe(email) {
        return String(email || '').split('@')[0];
    }

    async function lerConversasSupabase() {
        if (!supabaseChat) return [];
        const eu = usuarioAtual();
        if (!eu) return [];

        const { data, error } = await supabaseChat
            .from('mensagens')
            .select('*')
            .or(`comprador.eq.${eu},vendedor.eq.${eu}`)
            .order('atualizada_em', { ascending: false });

        if (error || !data) return [];

        cacheConversas = data.map(c => ({
            id: c.id,
            produtoId: c.produto_id,
            produtoNome: c.produto_nome,
            vendedor: c.vendedor,
            comprador: c.comprador,
            criadaEm: new Date(c.criada_em).getTime(),
            atualizadaEm: new Date(c.atualizada_em).getTime(),
            expiraEm: new Date(c.expira_em).getTime(),
            mensagens: c.mensagens || [],
            lidas: c.lidas || {}
        }));

        return cacheConversas;
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

    async function limparExpiradas() {
        if (!supabaseChat) return;
        const agora = new Date().toISOString();
        await supabaseChat.from('mensagens').delete().lt('expira_em', agora);
    }

    function naoLidas(c, eu) {
        const visto = (c.lidas && c.lidas[eu]) || 0;
        return c.mensagens.filter(m => m.de !== eu && m.em > visto).length;
    }

    function totalNaoLidas(eu) {
        return cacheConversas
            .filter(c => c.vendedor === eu || c.comprador === eu)
            .reduce((soma, c) => soma + naoLidas(c, eu), 0);
    }

    async function marcarLida(idConversa) {
        const eu = usuarioAtual();
        const c = cacheConversas.find(x => x.id === idConversa);
        if (!c) return;
        const ultimaDoOutro = c.mensagens.reduce(
            (max, m) => (m.de !== eu && m.em > max) ? m.em : max, 0
        );
        const visto = (c.lidas && c.lidas[eu]) || 0;
        if (ultimaDoOutro <= visto) return;
        
        c.lidas = c.lidas || {};
        c.lidas[eu] = Date.now();

        if (supabaseChat) {
            await supabaseChat
                .from('mensagens')
                .update({ lidas: c.lidas })
                .eq('id', idConversa);
        }
    }

    // Criar ou obter conversa
    async function obterConversa(prod, comprador) {
        const donoProd = prod.dono || prod.user_id || comprador;
        const idConv = 'p' + prod.id + '_' + comprador;
        
        let c = cacheConversas.find(x => x.id === idConv);
        if (!c) {
            const agora = new Date();
            const expira = new Date(agora.getTime() + DIAS_HISTORICO * UM_DIA);
            
            const novaConv = {
                id: idConv,
                produto_id: String(prod.id),
                produto_nome: prod.nome || prod.titulo,
                vendedor: donoProd,
                comprador: comprador,
                criada_em: agora.toISOString(),
                atualizada_em: agora.toISOString(),
                expira_em: expira.toISOString(),
                mensagens: [],
                lidas: {}
            };

            if (supabaseChat) {
                await supabaseChat.from('mensagens').upsert([novaConv]);
            }

            c = {
                id: idConv,
                produtoId: prod.id,
                produtoNome: prod.nome || prod.titulo,
                vendedor: donoProd,
                comprador: comprador,
                criadaEm: agora.getTime(),
                atualizadaEm: agora.getTime(),
                expiraEm: expira.getTime(),
                mensagens: [],
                lidas: {}
            };
            cacheConversas.unshift(c);
        }
        return c;
    }

    // =====================================================
    // SELO DE MENSAGENS NO TOPO
    // =====================================================
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

    async function atualizarSelo() {
        if (!selo) return;
        await lerConversasSupabase();
        const eu = usuarioAtual();
        const n = eu ? totalNaoLidas(eu) : 0;
        selo.textContent = n > 9 ? '9+' : String(n);
        selo.style.display = n > 0 ? 'inline-flex' : 'none';
    }

    window.abrirChatComVendedor = async function(prod) {
        const eu = usuarioAtual();
        if (!eu) {
            clicar('btn-abrir-login');
            return;
        }
        
        const donoProd = prod.dono || prod.user_id;
        if (donoProd && donoProd === eu) {
            alert('Este anúncio é seu.');
            return;
        }

        const conversa = await obterConversa(prod, eu);
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

    async function desenharLista() {
        const eu = usuarioAtual();
        const caixa = painel.querySelector('.msg-lista');
        if (!caixa) return;
        caixa.innerHTML = '';

        await lerConversasSupabase();
        const minhas = cacheConversas
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
            item.querySelector('.msg-avatar').textContent = nome.charAt(0).toUpperCase();
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

    async function desenharMensagens() {
        const caixa = painel.querySelector('.msg-mensagens');
        if (!caixa || !conversaAtiva) return;

        await marcarLida(conversaAtiva);
        const c = cacheConversas.find(x => x.id === conversaAtiva);
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

    async function mostrarConversa(id) {
        conversaAtiva = id;
        const area = painel.querySelector('.msg-conversa');
        const eu = usuarioAtual();
        const c = id ? cacheConversas.find(x => x.id === id) : null;

        if (!c) {
            conversaAtiva = null;
            area.innerHTML = '<div class="msg-vazio">Escolha uma conversa para começar.</div>';
            await desenharLista();
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

        area.querySelector('.msg-avatar').textContent = nomeDe(outro).charAt(0).toUpperCase();
        area.querySelector('.msg-conv-nome').textContent = nomeDe(outro);
        area.querySelector('.msg-conv-produto').textContent = 'Produto: ' + c.produtoNome;

        area.querySelector('.msg-conv-voltar').addEventListener('click', () => {
            painel.classList.remove('ver-conversa');
        });

        const form = area.querySelector('.msg-form');
        const input = area.querySelector('.msg-input');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const texto = input.value.trim();
            if (!texto) return;
            input.value = '';
            await enviar(texto);
        });

        await desenharMensagens();
        await desenharLista();
        await atualizarSelo();
        input.focus();
    }

    async function enviar(texto) {
        const eu = usuarioAtual();
        const c = cacheConversas.find(x => x.id === conversaAtiva);
        if (!c || !eu) {
            alert('Esta conversa já não existe.');
            return;
        }

        const agora = Date.now();
        const novaMsg = { de: eu, texto: texto, em: agora };
        c.mensagens.push(novaMsg);
        c.atualizadaEm = agora;
        c.expiraEm = agora + DIAS_HISTORICO * UM_DIA;
        c.lidas = c.lidas || {};
        c.lidas[eu] = agora;

        if (supabaseChat) {
            const { error } = await supabaseChat
                .from('mensagens')
                .update({
                    mensagens: c.mensagens,
                    atualizada_em: new Date(c.atualizadaEm).toISOString(),
                    expira_em: new Date(c.expiraEm).toISOString(),
                    lidas: c.lidas
                })
                .eq('id', c.id);

            if (error) {
                alert('Não foi possível enviar a mensagem.');
                return;
            }
        }

        await desenharMensagens();
        await desenharLista();
    }

    async function abrirMensagens(id) {
        if (!usuarioAtual()) {
            clicar('btn-abrir-login');
            return;
        }
        await limparExpiradas();
        painel.classList.add('aberta');
        document.body.classList.add('sem-scroll');

        if (id) {
            await mostrarConversa(id);
            painel.classList.add('ver-conversa');
        } else {
            painel.classList.remove('ver-conversa');
            await mostrarConversa(null);
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

    window.addEventListener('ls:sessao', async () => {
        fecharMensagens();
        await atualizarSelo();
    });

    limparExpiradas();
    atualizarSelo();
});