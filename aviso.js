// =========================================================
// LS SHOPPING - Avisos e "a processar" (aviso.js)
//
// 1. Os avisos (alert) passam a aparecer dentro do site, em vez da
//    janela do navegador.
// 2. window.confirmar(...) é a confirmação do site (Sim / Cancelar).
// 3. Sempre que o site fala com o Supabase aparece uma barra no topo e
//    um "A processar..." em baixo, e o botão que foi carregado fica ocupado.
// 4. Ao carregar em "Sair" aparece "Tem a certeza que quer sair?" (Sim / Não).
//
// Os estilos estão dentro deste ficheiro: não é preciso mexer no style.css.
// =========================================================
(function () {
    'use strict';

    var AZUL = '#002780';

    // =====================================================
    // 1. ESTILOS
    // =====================================================
    var css = `
    .ls-avisos {
        position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
        z-index: 2147483000; display: flex; flex-direction: column; gap: 10px;
        width: min(92vw, 420px); pointer-events: none;
    }
    .ls-aviso {
        pointer-events: auto; display: flex; align-items: flex-start; gap: 10px;
        padding: 12px 14px; border-radius: 10px; background: #fff; color: #0f172a;
        font: 500 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
        border-left: 5px solid ${AZUL}; cursor: pointer;
        opacity: 0; transform: translateY(-8px);
        transition: opacity .2s ease, transform .2s ease;
    }
    .ls-aviso.visivel { opacity: 1; transform: translateY(0); }
    .ls-aviso-ok { border-left-color: #2e7d32; }
    .ls-aviso-erro { border-left-color: #c62828; }
    .ls-aviso-aviso { border-left-color: #ef8f00; }
    .ls-aviso-icone {
        flex: none; width: 22px; height: 22px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        color: #fff; font-size: 13px; font-weight: 700; background: ${AZUL};
    }
    .ls-aviso-ok .ls-aviso-icone { background: #2e7d32; }
    .ls-aviso-erro .ls-aviso-icone { background: #c62828; }
    .ls-aviso-aviso .ls-aviso-icone { background: #ef8f00; }
    .ls-aviso-texto { flex: 1; white-space: pre-line; word-break: break-word; }
    .ls-aviso-fechar {
        flex: none; background: none; border: none; color: #64748b;
        font-size: 18px; line-height: 1; cursor: pointer; padding: 0 2px;
    }

    .ls-barra {
        position: fixed; top: 0; left: 0; right: 0; height: 3px;
        z-index: 2147483001; overflow: hidden; pointer-events: none;
        opacity: 0; transition: opacity .2s ease;
    }
    .ls-barra.ativa { opacity: 1; }
    .ls-barra::before {
        content: ''; position: absolute; top: 0; bottom: 0; left: -40%; width: 40%;
        background: #4da3ff; animation: ls-corre 1.1s ease-in-out infinite;
    }
    @keyframes ls-corre { 0% { left: -40%; } 100% { left: 100%; } }

    .ls-pilula {
        position: fixed; bottom: 20px; left: 50%; transform: translate(-50%, 12px);
        z-index: 2147483001; display: flex; align-items: center; gap: 10px;
        background: ${AZUL}; color: #fff; padding: 10px 16px; border-radius: 999px;
        font: 600 13px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
        box-shadow: 0 6px 18px rgba(15, 23, 42, 0.3); pointer-events: none;
        opacity: 0; transition: opacity .2s ease, transform .2s ease;
    }
    .ls-pilula.ativa { opacity: 1; transform: translate(-50%, 0); }

    .ls-spinner {
        flex: none; width: 16px; height: 16px; border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.35); border-top-color: #fff;
        animation: ls-gira .7s linear infinite; display: inline-block;
    }
    .ls-spinner-escuro { border-color: rgba(0, 39, 128, 0.2); border-top-color: ${AZUL}; }
    @keyframes ls-gira { to { transform: rotate(360deg); } }

    button.ls-ocupado, input[type="submit"].ls-ocupado {
        pointer-events: none; opacity: .75; cursor: progress;
    }
    button.ls-ocupado::after {
        content: ''; display: inline-block; width: 13px; height: 13px;
        margin-left: 8px; vertical-align: -2px; border-radius: 50%;
        border: 2px solid currentColor; border-right-color: transparent;
        animation: ls-gira .7s linear infinite;
    }

    .ls-confirmar-fundo {
        position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6);
        display: flex; align-items: center; justify-content: center;
        z-index: 2147483002; padding: 16px;
    }
    .ls-confirmar-caixa {
        background: #fff; border-radius: 12px; width: 100%; max-width: 400px;
        padding: 22px 20px 16px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    }
    .ls-confirmar-titulo { margin: 0 0 8px; font-size: 17px; font-weight: 700; color: #0f172a; }
    .ls-confirmar-texto {
        margin: 0 0 18px; font-size: 14px; color: #475569; line-height: 1.5;
        white-space: pre-line; word-break: break-word;
    }
    .ls-confirmar-botoes { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }
    .ls-confirmar-botoes button {
        padding: 10px 16px; border-radius: 8px; font-weight: 600; font-size: 14px;
        cursor: pointer; border: 2px solid ${AZUL};
    }
    .ls-btn-nao { background: #fff; color: ${AZUL}; }
    .ls-btn-sim { background: ${AZUL}; color: #fff; }
    .ls-btn-sim.perigo { background: #c62828; border-color: #c62828; }
    /* Pergunta "Sim / Não" com o "Não" em destaque (ex.: sair da conta) */
    .ls-btn-nao.destaque { background: ${AZUL}; color: #fff; }
    .ls-btn-sim.contorno { background: #fff; color: ${AZUL}; border-color: ${AZUL}; }
    .ls-confirmar-par button { flex: 1 1 0; min-width: 0; }
    `;

    var estilo = document.createElement('style');
    estilo.textContent = css;
    (document.head || document.documentElement).appendChild(estilo);

    // =====================================================
    // 2. ELEMENTOS (criados quando o body existir)
    // =====================================================
    var caixaAvisos = null;
    var barra = null;
    var pilula = null;

    function montar() {
        if (caixaAvisos || !document.body) return;

        caixaAvisos = document.createElement('div');
        caixaAvisos.className = 'ls-avisos';
        document.body.appendChild(caixaAvisos);

        barra = document.createElement('div');
        barra.className = 'ls-barra';
        barra.setAttribute('aria-hidden', 'true');
        document.body.appendChild(barra);

        pilula = document.createElement('div');
        pilula.className = 'ls-pilula';
        pilula.setAttribute('role', 'status');
        pilula.setAttribute('aria-live', 'polite');
        pilula.innerHTML = '<span class="ls-spinner"></span><span>A processar...</span>';
        document.body.appendChild(pilula);
    }

    if (document.body) montar();
    else document.addEventListener('DOMContentLoaded', montar);

    // =====================================================
    // 3. AVISOS (substituem o alert do navegador)
    // =====================================================
    function adivinharTipo(texto) {
        var t = texto.toLowerCase();
        if (/n[aã]o foi poss[ií]vel|erro|falh|incorret|inv[aá]lid|expirad|terminou|n[aã]o encontr/.test(t)) return 'erro';
        if (/sucesso|criada|publicado|eliminado|guardad|enviad|bem-vindo/.test(t)) return 'ok';
        if (/preencha|precisa|adicione|aten[cç][aã]o|escreva|este an[uú]ncio|n[aã]o tem chat|confirme/.test(t)) return 'aviso';
        return 'info';
    }

    function removerAviso(el) {
        if (!el || !el.parentNode) return;
        el.classList.remove('visivel');
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    }

    function avisar(mensagem, tipo) {
        montar();
        if (!caixaAvisos) return;

        var texto = String(mensagem == null ? '' : mensagem);
        var kind = tipo || adivinharTipo(texto);
        var icones = { ok: '\u2713', erro: '!', aviso: '!', info: 'i' };

        var el = document.createElement('div');
        el.className = 'ls-aviso ls-aviso-' + kind;
        el.setAttribute('role', kind === 'erro' ? 'alert' : 'status');

        var icone = document.createElement('span');
        icone.className = 'ls-aviso-icone';
        icone.textContent = icones[kind] || 'i';

        var corpo = document.createElement('span');
        corpo.className = 'ls-aviso-texto';
        corpo.textContent = texto;

        var fechar = document.createElement('button');
        fechar.type = 'button';
        fechar.className = 'ls-aviso-fechar';
        fechar.setAttribute('aria-label', 'Fechar aviso');
        fechar.textContent = '\u00d7';

        el.appendChild(icone);
        el.appendChild(corpo);
        el.appendChild(fechar);
        caixaAvisos.appendChild(el);

        while (caixaAvisos.children.length > 4) removerAviso(caixaAvisos.firstElementChild);

        requestAnimationFrame(function () { el.classList.add('visivel'); });

        // Mais texto = mais tempo no ecrã
        var duracao = Math.min(10000, Math.max(4000, 2500 + texto.length * 45));
        if (kind === 'erro') duracao += 1500;
        var timer = setTimeout(function () { removerAviso(el); }, duracao);

        el.addEventListener('mouseenter', function () { clearTimeout(timer); });
        el.addEventListener('mouseleave', function () {
            timer = setTimeout(function () { removerAviso(el); }, 2500);
        });
        el.addEventListener('click', function () { clearTimeout(timer); removerAviso(el); });
    }

    // =====================================================
    // 4. CONFIRMAÇÃO (substitui o confirm do navegador)
    //    Uso: if (await confirmar('Tem a certeza?')) { ... }
    // =====================================================
    var fecharConfirmacaoAberta = null;

    function confirmar(mensagem, opcoes) {
        montar();
        var o = opcoes || {};

        return new Promise(function (resolve) {
            if (fecharConfirmacaoAberta) fecharConfirmacaoAberta(false);

            var fundo = document.createElement('div');
            fundo.className = 'ls-confirmar-fundo';

            var caixa = document.createElement('div');
            caixa.className = 'ls-confirmar-caixa';
            caixa.setAttribute('role', 'dialog');
            caixa.setAttribute('aria-modal', 'true');

            var titulo = document.createElement('h3');
            titulo.className = 'ls-confirmar-titulo';
            titulo.textContent = o.titulo || 'LS SHOPPING';

            var texto = document.createElement('p');
            texto.className = 'ls-confirmar-texto';
            texto.textContent = String(mensagem == null ? '' : mensagem);

            var botoes = document.createElement('div');
            botoes.className = 'ls-confirmar-botoes';

            var btnNao = document.createElement('button');
            btnNao.type = 'button';
            btnNao.className = 'ls-btn-nao';
            btnNao.textContent = o.nao || 'Cancelar';

            var btnSim = document.createElement('button');
            btnSim.type = 'button';
            btnSim.className = 'ls-btn-sim' + (o.perigo ? ' perigo' : '');
            btnSim.textContent = o.sim || 'Confirmar';

            // destaque: 'nao' => o "Não" fica azul cheio e o "Sim" branco com contorno azul
            if (o.destaque === 'nao') {
                btnNao.classList.add('destaque');
                btnSim.classList.add('contorno');
                botoes.classList.add('ls-confirmar-par');
            }

            botoes.appendChild(btnNao);
            botoes.appendChild(btnSim);
            caixa.appendChild(titulo);
            caixa.appendChild(texto);
            caixa.appendChild(botoes);
            fundo.appendChild(caixa);

            function teclas(e) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    fechar(false);
                }
            }

            function fechar(valor) {
                document.removeEventListener('keydown', teclas, true);
                if (fundo.parentNode) fundo.parentNode.removeChild(fundo);
                fecharConfirmacaoAberta = null;
                resolve(valor);
            }

            btnSim.addEventListener('click', function () { fechar(true); });
            btnNao.addEventListener('click', function () { fechar(false); });
            fundo.addEventListener('click', function (e) { if (e.target === fundo) fechar(false); });

            fecharConfirmacaoAberta = fechar;
            document.addEventListener('keydown', teclas, true);
            document.body.appendChild(fundo);

            // Nas ações perigosas o foco fica no "Cancelar", para o Enter não apagar sem querer
            ((o.perigo || o.destaque === 'nao') ? btnNao : btnSim).focus();
        });
    }

    // =====================================================
    // 5. "A PROCESSAR..." (todos os pedidos ao Supabase passam por aqui)
    // =====================================================
    var pendentes = 0;
    var tBarra = null;
    var tPilula = null;
    var tEsconder = null;

    // O ícone da aba do navegador gira enquanto o site processa
    // (como o círculo de carregamento que os outros sites mostram)
    var iconeLink = null;
    var iconeOriginal = null;
    var tIcone = null;
    var angulo = 0;

    function desenharIcone() {
        var c = document.createElement('canvas');
        c.width = 32;
        c.height = 32;
        var g = c.getContext('2d');
        g.lineWidth = 4;
        g.lineCap = 'round';
        g.strokeStyle = 'rgba(0, 39, 128, 0.2)';
        g.beginPath(); g.arc(16, 16, 11, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = AZUL;
        g.beginPath(); g.arc(16, 16, 11, angulo, angulo + Math.PI * 1.2); g.stroke();
        return c.toDataURL('image/png');
    }

    function iniciarIcone() {
        if (tIcone) return;
        try {
            iconeLink = document.querySelector('link[rel~="icon"]');
            if (iconeLink) {
                iconeOriginal = { href: iconeLink.getAttribute('href'), type: iconeLink.getAttribute('type') };
            } else {
                iconeLink = document.createElement('link');
                iconeLink.rel = 'icon';
                document.head.appendChild(iconeLink);
                iconeOriginal = null;
            }
            tIcone = setInterval(function () {
                angulo += 0.55;
                iconeLink.setAttribute('type', 'image/png');
                iconeLink.setAttribute('href', desenharIcone());
            }, 90);
        } catch (e) { /* o ícone a girar é só um extra */ }
    }

    function pararIcone() {
        if (!tIcone) return;
        clearInterval(tIcone);
        tIcone = null;
        try {
            if (iconeOriginal) {
                iconeLink.setAttribute('href', iconeOriginal.href);
                if (iconeOriginal.type) iconeLink.setAttribute('type', iconeOriginal.type);
                else iconeLink.removeAttribute('type');
            } else if (iconeLink && iconeLink.parentNode) {
                iconeLink.parentNode.removeChild(iconeLink);
            }
        } catch (e) { /* ignorar */ }
        iconeLink = null;
    }

    function mudou(delta) {
        pendentes = Math.max(0, pendentes + delta);
        montar();
        if (!barra || !pilula) return;

        if (pendentes > 0) {
            clearTimeout(tEsconder);
            // Pedidos rápidos não mostram nada (evita piscar)
            if (!tBarra && !barra.classList.contains('ativa')) {
                tBarra = setTimeout(function () { barra.classList.add('ativa'); iniciarIcone(); tBarra = null; }, 150);
            }
            if (!tPilula && !pilula.classList.contains('ativa')) {
                tPilula = setTimeout(function () { pilula.classList.add('ativa'); tPilula = null; }, 500);
            }
        } else {
            clearTimeout(tBarra); tBarra = null;
            clearTimeout(tPilula); tPilula = null;
            clearTimeout(tEsconder);
            tEsconder = setTimeout(function () {
                barra.classList.remove('ativa');
                pilula.classList.remove('ativa');
                pararIcone();
            }, 200);
        }
    }

    function lsFetch() {
        var args = arguments;
        mudou(+1);
        var p;
        try {
            p = fetch.apply(window, args);
        } catch (e) {
            mudou(-1);
            throw e;
        }
        return p.finally(function () { mudou(-1); });
    }

    // O botão que foi carregado fica "ocupado" enquanto há pedidos a decorrer
    // (evita carregar duas vezes e publicar o mesmo anúncio duas vezes)
    function marcarOcupado(botao) {
        if (!botao || botao.classList.contains('ls-ocupado')) return;
        botao.classList.add('ls-ocupado');
        var inicio = Date.now();
        var livreDesde = 0;
        var t = setInterval(function () {
            var passou = Date.now() - inicio;
            if (pendentes === 0) { if (!livreDesde) livreDesde = Date.now(); }
            else { livreDesde = 0; }
            var livre = livreDesde && (Date.now() - livreDesde > 300);
            if ((livre && passou > 400) || passou > 15000) {
                botao.classList.remove('ls-ocupado');
                clearInterval(t);
            }
        }, 100);
    }

    document.addEventListener('submit', function (e) {
        var form = e.target;
        if (!form || !form.querySelector) return;
        var botao = form.querySelector('button[type="submit"], button:not([type])');
        marcarOcupado(botao);
    }, true);

    // =====================================================
    // 6. LIGAR TUDO AO SITE
    // =====================================================
    window.alertNativo = window.alert.bind(window);
    window.alert = function (mensagem) { avisar(mensagem); };
    window.avisar = avisar;
    window.confirmar = confirmar;
    window.lsFetch = lsFetch;

    // =====================================================
    // 7. CONFIRMAR ANTES DE SAIR
    //    Apanha o botão "Sair" do topo (#btn-sair) e o "Sair" do menu lateral
    //    (data-acao="sair"). Se a pessoa disser Sim, o clique segue normalmente
    //    e o código de logout que já existe faz o resto.
    // =====================================================
    var sairConfirmado = false;
    var sairAPerguntar = false;

    document.addEventListener('click', function (e) {
        var alvo = e.target && e.target.closest
            ? e.target.closest('#btn-sair, [data-acao="sair"]')
            : null;
        if (!alvo) return;

        // Clique já confirmado: deixa passar para o código de logout
        if (sairConfirmado) return;

        // Se ninguém tem sessão iniciada, não faz sentido perguntar
        var painel = document.getElementById('usuario-logado');
        if (painel && painel.style.display === 'none') return;

        // Bloqueia o logout até a pessoa responder
        e.preventDefault();
        e.stopImmediatePropagation();

        if (sairAPerguntar) return;
        sairAPerguntar = true;

        confirmar('Tem a certeza que quer sair da sua conta?', {
            titulo: 'Sair',
            sim: 'Sim',
            nao: 'Não',
            destaque: 'nao'
        }).then(function (resposta) {
            sairAPerguntar = false;
            if (!resposta) return;

            // Repete o clique, agora autorizado
            sairConfirmado = true;
            try { alvo.click(); }
            finally { sairConfirmado = false; }
        });
    }, true);
})();