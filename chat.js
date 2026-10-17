// =========================================================
// LS SHOPPING - Contacto e chat do site (chat.js)
// Versão Supabase Integrada e com Selo iOS
// + Mensagens em tempo real (Supabase Realtime)
// + "Apagar conversa" só para quem apaga (a outra pessoa mantém a dela)
//
// PRECISA desta coluna na tabela "mensagens" (correr uma vez no SQL Editor):
//   alter table public.mensagens
//     add column if not exists apagou_em jsonb not null default '{}'::jsonb;
// =========================================================

const supabaseChat = window.supabaseLS;

document.addEventListener('DOMContentLoaded', () => {

    const DIAS_HISTORICO = 7;
    const UM_DIA = 24 * 60 * 60 * 1000;

    // Telemóvel/tablet (ecrã de toque)
    const ecraDeToque = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

    let conversaAtiva = null;
    let cacheConversas = [];
    let meuId = '';      // ID do utilizador no Supabase (identifica o vendedor)
    let meuNome = '';    // nome de utilizador (mostrado no chat)

    // --- Tempo real ---
    let canalRealtime = null;     // ligação em tempo real ao Supabase
    let realtimeAtivo = false;    // true quando a ligação está estabelecida

    // Estilo do botão "Apagar" (fica aqui dentro, não é preciso mexer no style.css)
    const estiloApagar = document.createElement('style');
    estiloApagar.textContent = `
        .msg-conv-apagar {
            margin-left: auto;
            flex: none;
            background: none;
            border: 1px solid #c62828;
            color: #c62828;
            border-radius: 8px;
            padding: 6px 12px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
        }
        .msg-conv-apagar:hover { background: #c62828; color: #fff; }
    `;
    document.head.appendChild(estiloApagar);

    function usuarioAtual() {
        return localStorage.getItem('ls_sessao') || localStorage.getItem('ls_usuario') || '';
    }

    function nomeDe(email) {
        return String(email || '').split('@')[0];
    }

    // Vai buscar o ID e o nome do utilizador com sessão no Supabase
    async function carregarMeuId() {
        meuId = '';
        meuNome = '';
        if (!supabaseChat) return;
        const { data } = await supabaseChat.auth.getSession();
        if (data && data.session && data.session.user) {
            const u = data.session.user;
            meuId = u.id;
            meuNome = (u.user_metadata && u.user_metadata.nome) || nomeDe(u.email);
        }
    }

    // O vendedor é guardado pelo ID; o comprador pelo e-mail
    function souVendedor(c) {
        return !!meuId && c.vendedor === meuId;
    }

    function participo(c) {
        return c.comprador === usuarioAtual() || souVendedor(c);
    }

    function nomeDoOutro(c) {
        if (souVendedor(c)) return c.compradorNome || nomeDe(c.comprador);
        return c.vendedorNome || 'Vendedor';
    }

    // Converte uma linha da tabela "mensagens" no formato usado pelo chat.
    // "antiga" (opcional) serve para não perder campos que o tempo real
    // às vezes não envia quando não mudaram.
    function mapearConversa(c, antiga) {
        return {
            id: c.id,
            produtoId: c.produto_id,
            produtoNome: c.produto_nome,
            vendedor: c.vendedor,
            vendedorNome: c.vendedor_nome || '',
            comprador: c.comprador,
            compradorNome: c.comprador_nome || '',
            criadaEm: new Date(c.criada_em).getTime(),
            atualizadaEm: new Date(c.atualizada_em).getTime(),
            expiraEm: new Date(c.expira_em).getTime(),
            mensagens: c.mensagens !== undefined ? (c.mensagens || []) : (antiga ? antiga.mensagens : []),
            lidas: c.lidas !== undefined ? (c.lidas || {}) : (antiga ? antiga.lidas : {}),
            // quando cada pessoa apagou a conversa só para si: { "email": timestamp }
            apagouEm: c.apagou_em !== undefined ? (c.apagou_em || {}) : (antiga ? (antiga.apagouEm || {}) : {})
        };
    }

    // Só as mensagens que EU ainda posso ver (as anteriores a quando apaguei ficam escondidas)
    function mensagensVisiveis(c) {
        const eu = usuarioAtual();
        const corte = (c.apagouEm && c.apagouEm[eu]) || 0;
        return corte ? c.mensagens.filter(m => m.em > corte) : c.mensagens;
    }

    async function lerConversasSupabase() {
        if (!supabaseChat) return [];
        const eu = usuarioAtual();
        if (!eu) return [];

        let filtro = `comprador.eq.${eu}`;
        if (meuId) filtro += `,vendedor.eq.${meuId}`;

        const { data, error } = await supabaseChat
            .from('mensagens')
            .select('*')
            .or(filtro)
            .order('atualizada_em', { ascending: false });

        if (error) console.error('chat.js: erro a ler as conversas:', error.message);
        if (error || !data) return [];

        cacheConversas = data.map(c => mapearConversa(c));

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
        return mensagensVisiveis(c).filter(m => m.de !== eu && m.em > visto).length;
    }

    function totalNaoLidas(eu) {
        return cacheConversas
            .filter(c => participo(c))
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
    async function obterConversa(prod, comprador, donoProd) {
        const idConv = 'p' + prod.id + '_' + comprador;

        // Atualiza a lista antes, para nunca apagar uma conversa que já existe
        await lerConversasSupabase();

        let c = cacheConversas.find(x => x.id === idConv);
        if (!c) {
            const agora = new Date();
            const expira = new Date(agora.getTime() + DIAS_HISTORICO * UM_DIA);

            const novaConv = {
                id: idConv,
                produto_id: String(prod.id),
                produto_nome: prod.nome || prod.titulo,
                vendedor: donoProd,
                vendedor_nome: prod.donoNome || '',
                comprador: comprador,
                comprador_nome: meuNome,
                criada_em: agora.toISOString(),
                atualizada_em: agora.toISOString(),
                expira_em: expira.toISOString(),
                mensagens: [],
                lidas: {}
            };

            if (supabaseChat) {
                const { error } = await supabaseChat
                    .from('mensagens')
                    .upsert([novaConv], { onConflict: 'id', ignoreDuplicates: true });
                if (error) {
                    alert('Não foi possível iniciar a conversa: ' + error.message);
                    return null;
                }
            }

            c = {
                id: idConv,
                produtoId: prod.id,
                produtoNome: prod.nome || prod.titulo,
                vendedor: donoProd,
                vendedorNome: prod.donoNome || '',
                comprador: comprador,
                compradorNome: meuNome,
                criadaEm: agora.getTime(),
                atualizadaEm: agora.getTime(),
                expiraEm: expira.getTime(),
                mensagens: [],
                lidas: {},
                apagouEm: {}
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

    // Só desenha o número (usa o que já está na memória, não vai à base de dados)
    function desenharSelo() {
        if (!selo) return;
        const eu = usuarioAtual();
        const n = eu ? totalNaoLidas(eu) : 0;
        selo.textContent = n > 9 ? '9+' : String(n);
        selo.style.display = n > 0 ? 'inline-flex' : 'none';
    }

    async function atualizarSelo() {
        if (!selo) return;
        await lerConversasSupabase();
        desenharSelo();
    }

    window.abrirChatComVendedor = async function(prod) {
        const eu = usuarioAtual();
        if (!eu) {
            clicar('btn-abrir-login');
            return;
        }

        if (!meuId) await carregarMeuId();

        const donoProd = prod.dono || prod.user_id;
        if (!donoProd) {
            alert('Este anúncio não tem chat disponível. Use o WhatsApp.');
            return;
        }
        if (donoProd === meuId || donoProd === eu) {
            alert('Este anúncio é seu. Para testar o chat, entre com outra conta.');
            return;
        }

        const conversa = await obterConversa(prod, eu, donoProd);
        if (!conversa) return;
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

    function painelAberto() {
        return painel.classList.contains('aberta');
    }

    async function desenharLista() {
        const eu = usuarioAtual();
        const caixa = painel.querySelector('.msg-lista');
        if (!caixa) return;
        if (!caixa.children.length) {
            caixa.innerHTML = '<p class="msg-lista-vazia">A carregar conversas...</p>';
        }

        await lerConversasSupabase();
        caixa.innerHTML = '';
        const minhas = cacheConversas
            .filter(c => participo(c) &&
                         (mensagensVisiveis(c).length > 0 || c.id === conversaAtiva))
            .sort((a, b) => (b.atualizadaEm || 0) - (a.atualizadaEm || 0));

        if (minhas.length === 0) {
            const vazio = document.createElement('p');
            vazio.className = 'msg-lista-vazia';
            vazio.textContent = 'Ainda não tem conversas. Clique em "Contactar Vendedor" num anúncio para começar.';
            caixa.appendChild(vazio);
            return;
        }

        minhas.forEach(c => {
            const nome = nomeDoOutro(c);
            const visiveis = mensagensVisiveis(c);
            const ultima = visiveis[visiveis.length - 1];
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

    // forcar = true -> desce sempre até à última mensagem (usado ao enviar).
    // Caso contrário, só desce se a pessoa já estava no fim da conversa,
    // para não "saltar" quando ela está a ler mensagens antigas.
    async function desenharMensagens(forcar) {
        if (!conversaAtiva) return;

        await marcarLida(conversaAtiva);

        const caixa = painel.querySelector('.msg-mensagens');
        if (!caixa || !conversaAtiva) return;
        const c = cacheConversas.find(x => x.id === conversaAtiva);
        if (!c) return;
        const eu = usuarioAtual();
        const visiveis = mensagensVisiveis(c);

        const distanciaDoFim = caixa.scrollHeight - caixa.scrollTop - caixa.clientHeight;
        const estavaNoFim = distanciaDoFim < 80;
        const scrollAnterior = caixa.scrollTop;

        caixa.innerHTML = '';
        if (visiveis.length === 0) {
            const vazio = document.createElement('p');
            vazio.className = 'msg-sem-mensagens';
            vazio.textContent = 'Ainda não há mensagens. Escreva a primeira!';
            caixa.appendChild(vazio);
        }

        visiveis.forEach(m => {
            const bolha = document.createElement('div');
            bolha.className = 'msg-bolha ' + (m.de === eu ? 'minha' : 'dele');
            const texto = document.createElement('span');
            texto.textContent = m.texto;
            texto.style.whiteSpace = 'pre-wrap';        // respeita as mudanças de linha
            texto.style.overflowWrap = 'anywhere';
            const hora = document.createElement('small');
            hora.textContent = formatarHora(m.em);
            bolha.appendChild(texto);
            bolha.appendChild(hora);
            caixa.appendChild(bolha);
        });

        if (forcar || estavaNoFim) {
            caixa.scrollTop = caixa.scrollHeight;
        } else {
            caixa.scrollTop = scrollAnterior;
        }
    }

    // =====================================================
    // APAGAR CONVERSA - só para quem apaga
    // A outra pessoa continua a ver as mensagens dela.
    // Se a outra pessoa escrever outra vez, a conversa volta a aparecer
    // (só com as mensagens novas). Passados os 7 dias a conversa é
    // eliminada de vez para os dois lados.
    // =====================================================
    function faltaColunaApagou(erro) {
        return !!erro && /apagou_em/i.test(String(erro.message || ''));
    }

    const AVISO_COLUNA = 'Falta criar a coluna "apagou_em" na tabela "mensagens" do Supabase. ' +
        'Corra no SQL Editor: alter table public.mensagens add column if not exists apagou_em jsonb not null default \'{}\'::jsonb;';

    async function apagarConversa(id) {
        const c = cacheConversas.find(x => x.id === id);
        if (!c) return;

        const aviso = 'Tem a certeza que quer apagar esta conversa?\n' +
                      'Ela desaparece só para si. A outra pessoa continua a ver as mensagens dela.';
        let confirmado;
        if (typeof window.confirmar === 'function') {
            confirmado = await window.confirmar(aviso, {
                titulo: 'Apagar conversa',
                sim: 'Sim',
                nao: 'Não',
                perigo: true
            });
        } else {
            confirmado = window.confirm(aviso);
        }
        if (!confirmado) return;

        const eu = usuarioAtual();
        const agora = Date.now();
        let apagouNovo = Object.assign({}, c.apagouEm || {}, { [eu]: agora });

        if (supabaseChat) {
            // Vai buscar o estado mais recente (para não apagar a marca da outra pessoa)
            const { data: atual, error: erroLer } = await supabaseChat
                .from('mensagens')
                .select('apagou_em')
                .eq('id', id)
                .maybeSingle();

            if (erroLer) {
                alert(faltaColunaApagou(erroLer)
                    ? AVISO_COLUNA
                    : 'Não foi possível apagar a conversa: ' + erroLer.message);
                return;
            }

            if (!atual) {
                // A conversa já não existe (por exemplo, expirou): só limpa da memória
                cacheConversas = cacheConversas.filter(x => x.id !== id);
                conversaAtiva = null;
                painel.classList.remove('ver-conversa');
                await mostrarConversa(null);
                await atualizarSelo();
                return;
            }

            apagouNovo = Object.assign({}, atual.apagou_em || {}, { [eu]: agora });

            // .select() devolve as linhas alteradas: se vier vazio, a base de dados bloqueou
            const { data, error } = await supabaseChat
                .from('mensagens')
                .update({ apagou_em: apagouNovo })
                .eq('id', id)
                .select('id');

            if (error) {
                alert(faltaColunaApagou(error)
                    ? AVISO_COLUNA
                    : 'Não foi possível apagar a conversa: ' + error.message);
                return;
            }
            if (!data || data.length === 0) {
                alert('Não foi possível apagar a conversa. Verifique a permissão de alterar (UPDATE) na tabela "mensagens" do Supabase.');
                return;
            }
        }

        c.apagouEm = apagouNovo;
        conversaAtiva = null;
        painel.classList.remove('ver-conversa');
        await mostrarConversa(null);
        await atualizarSelo();
        alert('Conversa apagada para si.');
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

        const nomeOutro = nomeDoOutro(c);
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
            <div class="msg-mensagens"></div>
            <p class="msg-aviso-historico">Por privacidade, a conversa é guardada ${DIAS_HISTORICO} dias após a última mensagem e depois é eliminada.</p>
            <form class="msg-form">
                <textarea class="msg-input" rows="1" placeholder="Escreva a mensagem..." maxlength="1000" autocomplete="off" enterkeyhint="enter"></textarea>
                <button type="submit">Enviar</button>
            </form>
        `;

        area.querySelector('.msg-avatar').textContent = nomeOutro.charAt(0).toUpperCase();
        area.querySelector('.msg-conv-nome').textContent = nomeOutro;
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
            const enviou = await enviar(texto);
            // Se falhou, devolve o texto à caixa para a pessoa não o perder
            if (!enviou && !input.value) {
                input.value = texto;
                ajustarAltura();
            }
        });

        await desenharMensagens(true);
        await desenharLista();
        await atualizarSelo();

        input.focus();
    }

    // Devolve true se a mensagem foi enviada, false se falhou
    async function enviar(texto) {
        const eu = usuarioAtual();
        const c = cacheConversas.find(x => x.id === conversaAtiva);
        if (!c || !eu) {
            alert('Esta conversa já não existe.');
            return false;
        }

        const agora = Date.now();
        const novaMsg = { de: eu, texto: texto, em: agora };

        // Vai buscar a versão mais recente da conversa antes de acrescentar,
        // para nunca apagar uma mensagem que a outra pessoa acabou de enviar.
        let mensagensBase = c.mensagens;
        let lidasBase = c.lidas || {};
        if (supabaseChat) {
            const { data: atual } = await supabaseChat
                .from('mensagens')
                .select('mensagens, lidas')
                .eq('id', c.id)
                .maybeSingle();
            if (atual) {
                mensagensBase = atual.mensagens || [];
                lidasBase = atual.lidas || {};
            }
        }

        const listaNova = mensagensBase.concat([novaMsg]);
        const lidasNovas = Object.assign({}, lidasBase, { [eu]: agora });
        const expiraNova = agora + DIAS_HISTORICO * UM_DIA;

        if (supabaseChat) {
            const { error } = await supabaseChat
                .from('mensagens')
                .update({
                    mensagens: listaNova,
                    atualizada_em: new Date(agora).toISOString(),
                    expira_em: new Date(expiraNova).toISOString(),
                    lidas: lidasNovas
                })
                .eq('id', c.id);

            if (error) {
                alert('Não foi possível enviar a mensagem: ' + error.message);
                return false;
            }
        }

        // Atualiza a memória (a conversa pode ter sido substituída pelo tempo real)
        const atualC = cacheConversas.find(x => x.id === c.id) || c;
        atualC.mensagens = listaNova;
        atualC.atualizadaEm = agora;
        atualC.expiraEm = expiraNova;
        atualC.lidas = lidasNovas;

        await desenharMensagens(true);
        await desenharLista();
        return true;
    }

    // =====================================================
    // TEMPO REAL: mensagens que chegam aparecem na hora
    // =====================================================
    async function aoReceberAlteracao(payload) {
        const eu = usuarioAtual();
        if (!eu || !payload) return;

        // Conversa eliminada de vez (por expirar os 7 dias)
        if (payload.eventType === 'DELETE') {
            const idApagado = payload.old && payload.old.id;
            if (!idApagado) return;
            const existia = cacheConversas.some(x => x.id === idApagado);
            if (!existia) return;

            cacheConversas = cacheConversas.filter(x => x.id !== idApagado);
            desenharSelo();

            if (conversaAtiva === idApagado) {
                conversaAtiva = null;
                painel.classList.remove('ver-conversa');
                await mostrarConversa(null);
            } else if (painelAberto()) {
                await desenharLista();
            }
            return;
        }

        // Conversa nova ou atualizada (nova mensagem, mensagem lida, apagada, etc.)
        const linha = payload.new;
        if (!linha || !linha.id) return;

        const posicao = cacheConversas.findIndex(x => x.id === linha.id);
        const antiga = posicao >= 0 ? cacheConversas[posicao] : null;
        const nova = mapearConversa(linha, antiga);

        // Só interessa se a conversa é minha (RLS já filtra, isto é uma segunda barreira)
        if (!participo(nova)) return;

        if (posicao >= 0) cacheConversas[posicao] = nova;
        else cacheConversas.unshift(nova);

        // Se estou a ver esta conversa, mostra a mensagem nova (e marca como lida)
        if (painelAberto() && conversaAtiva === nova.id) {
            await desenharMensagens();
        }

        desenharSelo();

        if (painelAberto()) {
            await desenharLista();
        }
    }

    function pararRealtime() {
        realtimeAtivo = false;
        if (canalRealtime && supabaseChat) {
            try { supabaseChat.removeChannel(canalRealtime); } catch (e) { /* ignora */ }
        }
        canalRealtime = null;
    }

    function iniciarRealtime() {
        pararRealtime();
        if (!supabaseChat || !usuarioAtual()) return;

        canalRealtime = supabaseChat
            .channel('ls-chat-' + (meuId || nomeDe(usuarioAtual())))
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'mensagens' },
                (payload) => {
                    aoReceberAlteracao(payload).catch(err =>
                        console.error('chat.js: erro no tempo real:', err));
                }
            )
            .subscribe((estado) => {
                realtimeAtivo = (estado === 'SUBSCRIBED');
                if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') {
                    console.error('chat.js: o tempo real não ligou (' + estado + '). ' +
                        'Verifique se o Realtime está ativo na tabela "mensagens" no Supabase.');
                }
            });
    }

    // Rede de segurança: se o tempo real não estiver ligado, atualiza a cada 8 segundos
    setInterval(async () => {
        if (realtimeAtivo || !usuarioAtual() || document.hidden) return;
        await atualizarSelo();
        if (painelAberto()) {
            if (conversaAtiva) await desenharMensagens();
            await desenharLista();
        }
    }, 8000);

    // Quando a pessoa volta ao separador/aplicação (telemóvel bloqueado, outro separador),
    // sincroniza o que possa ter chegado entretanto.
    document.addEventListener('visibilitychange', async () => {
        if (document.hidden || !usuarioAtual()) return;
        await atualizarSelo();
        if (painelAberto()) {
            if (conversaAtiva) await desenharMensagens();
            await desenharLista();
        }
    });

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
        cacheConversas = [];
        await carregarMeuId();
        fecharMensagens();
        await atualizarSelo();
        iniciarRealtime();   // religa (ou desliga, se saiu da conta) com o utilizador certo
    });

    (async () => {
        await carregarMeuId();
        await limparExpiradas();
        await atualizarSelo();
        iniciarRealtime();
    })();
});