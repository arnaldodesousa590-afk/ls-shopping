// =========================================================
// LS SHOPPING - Botão "voltar" do navegador (historico.js)
//
// 1. Com uma janela aberta (galeria, mensagens, publicar, entrar,
//    menu, confirmação...), o botão voltar do navegador (ou o gesto
//    de voltar do telemóvel) FECHA essa janela, em vez de sair do site.
// 2. Depois de escolher uma categoria ou pesquisar, o botão voltar
//    regressa à lista anterior.
//
// Este ficheiro só observa o site: não é preciso mexer nos outros.
// =========================================================
(function () {
    'use strict';

    if (!window.history || !history.pushState) return;

    // ---------- utilitários ----------
    function q(seletor) { return document.querySelector(seletor); }
    function clicar(seletor) { var el = q(seletor); if (el) el.click(); }

    function visivel(el) {
        if (!el) return false;
        var cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden';
    }

    // O menu lateral: aberto quando está dentro do ecrã (o menu.js decide como o esconde)
    var menuIgnorado = false;
    function menuAberto() {
        if (menuIgnorado) return false;
        var m = document.getElementById('menu-lateral');
        if (!m) return false;
        var cs = getComputedStyle(m);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false;
        var r = m.getBoundingClientRect();
        return r.width > 0 && r.right > 8 && r.left < window.innerWidth - 8;
    }

    // ---------- as janelas que o botão voltar pode fechar ----------
    // Ordem: de fora para dentro (a última da lista fica "por cima" se abrirem juntas)
    var janelas = [
        { id: 'menu',      aberta: menuAberto,                                                  fechar: function () { clicar('#fechar-menu'); } },
        { id: 'mensagens', aberta: function () { return !!q('.msg-painel.aberta'); },             fechar: function () { clicar('.msg-painel .msg-voltar'); } },
        { id: 'conversa',  aberta: function () { return !!q('.msg-painel.aberta.ver-conversa'); }, fechar: function () { clicar('.msg-conv-voltar'); } },
        { id: 'meus',      aberta: function () { return !!q('.painel-meus.aberto'); },            fechar: function () { clicar('.painel-meus-voltar'); } },
        { id: 'editar',    aberta: function () { return !!q('.editar-fundo.aberto'); },           fechar: function () { clicar('.editar-cancelar'); } },
        { id: 'publicar',  aberta: function () { return visivel(document.getElementById('modal-produto')); },  fechar: function () { clicar('#fechar-produto'); } },
        { id: 'entrar',    aberta: function () { return visivel(document.getElementById('modal-auth')); },     fechar: function () { clicar('#fechar-auth'); } },
        { id: 'cadastro',  aberta: function () { return visivel(document.getElementById('modal-cadastro')); }, fechar: function () { clicar('#fechar-cadastro'); } },
        { id: 'info',      aberta: function () { return visivel(document.getElementById('modal-info')); },     fechar: function () { clicar('#fechar-info'); } },
        { id: 'contacto',  aberta: function () { return !!q('#modal-contacto-rapido'); },          fechar: function () { clicar('#fechar-modal-contacto'); } },
        { id: 'galeria',   aberta: function () { return !!q('.galeria.aberta'); },                 fechar: function () { clicar('.galeria-fechar'); } },
        { id: 'confirmar', aberta: function () { return !!q('.ls-confirmar-fundo'); },             fechar: function () { clicar('.ls-btn-nao'); } }
    ];

    function janelaPorId(id) {
        for (var i = 0; i < janelas.length; i++) if (janelas[i].id === id) return janelas[i];
        return null;
    }

    // ---------- estado ----------
    var pilha = [];            // ids das janelas abertas, pela ordem em que abriram
    var guarda = false;        // existe uma entrada "guarda" no histórico (há janelas abertas)
    var esperando = false;     // à espera que um history.back() nosso termine
    var tEspera = null;
    var fila = [];             // ações adiadas até o history.back() terminar
    var restaurando = false;   // estamos a repor um filtro (não registar de novo)
    var filtroAtual = { cat: '', q: '' };

    function iguais(a, b) { return a.cat === b.cat && a.q === b.q; }

    // ---------- janelas: abrir => entrada no histórico; fechar => remover ----------
    function reconciliar() {
        if (esperando || restaurando) return;

        var abertas = [];
        for (var i = 0; i < janelas.length; i++) {
            if (janelas[i].aberta()) abertas.push(janelas[i].id);
        }
        pilha = pilha.filter(function (id) { return abertas.indexOf(id) !== -1; });
        abertas.forEach(function (id) { if (pilha.indexOf(id) === -1) pilha.push(id); });

        if (pilha.length > 0 && !guarda) {
            history.pushState({ lsGuarda: true, lsFiltro: filtroAtual }, '');
            guarda = true;
        } else if (pilha.length === 0 && guarda) {
            guarda = false;
            voltarSozinho();
        }
    }

    // history.back() feito por nós (a janela foi fechada com o botão X, por exemplo)
    function voltarSozinho() {
        esperando = true;
        clearTimeout(tEspera);
        tEspera = setTimeout(acabouEspera, 800);   // segurança: nunca ficar preso à espera
        history.back();
    }

    function acabouEspera() {
        clearTimeout(tEspera);
        esperando = false;
        while (fila.length && !esperando) fila.shift()();
        reconciliar();
    }

    // ---------- filtros: categoria / pesquisa ----------
    function registarFiltro(novo) {
        if (restaurando || iguais(novo, filtroAtual)) return;
        filtroAtual = novo;

        function guardar() {
            if (guarda) {
                // havia uma janela aberta: troca a "guarda" pela entrada do filtro e volta a criar a guarda
                history.replaceState({ lsFiltro: novo }, '');
                guarda = false;
                reconciliar();
            } else {
                history.pushState({ lsFiltro: novo }, '');
            }
        }

        if (esperando) fila.push(guardar);
        else guardar();
    }

    function acharCategoria(cat) {
        var links = document.querySelectorAll('.categorias a, #menu-lateral [data-categoria]');
        for (var i = 0; i < links.length; i++) {
            var nome = (links[i].dataset.categoria || links[i].textContent).trim().toLowerCase();
            if (nome === cat.toLowerCase()) return links[i];
        }
        return null;
    }

    function aplicarFiltro(f) {
        if (!f || iguais(f, filtroAtual)) return;
        restaurando = true;
        try {
            if (f.q) {
                var campo = q('#input-pequisar');
                if (campo) campo.value = f.q;
                clicar('#btn-pesquisar');
            } else if (f.cat) {
                var alvo = acharCategoria(f.cat);
                if (alvo) alvo.click();
            } else {
                clicar('#btn-voltar-inicio');
            }
            filtroAtual = { cat: f.cat, q: f.q };
        } finally {
            setTimeout(function () { restaurando = false; }, 0);
        }
    }

    // ---------- o botão voltar / avançar do navegador ----------
    window.addEventListener('popstate', function (e) {
        var estado = e.state;

        // foi o nosso próprio history.back()
        if (esperando) {
            acabouEspera();
            return;
        }

        // o utilizador voltou atrás com uma janela aberta: fecha a que está por cima
        if (guarda) {
            guarda = false;
            var topo = pilha[pilha.length - 1];
            var janela = topo ? janelaPorId(topo) : null;
            if (janela) janela.fechar();
            setTimeout(reconciliar, 30);   // se ainda sobrarem janelas, cria nova guarda
            if (estado && estado.lsFiltro) aplicarFiltro(estado.lsFiltro);
            return;
        }

        // avançou para uma "guarda" sem janela nenhuma aberta: anda para trás outra vez
        if (estado && estado.lsGuarda && pilha.length === 0) {
            voltarSozinho();
            return;
        }

        // andou entre listas (categoria / pesquisa)
        if (estado && estado.lsFiltro) aplicarFiltro(estado.lsFiltro);
    });

    // ---------- ligar ao site ----------
    document.addEventListener('click', function (e) {
        if (restaurando || !e.target || !e.target.closest) return;

        var link = e.target.closest('.categorias a, #menu-lateral [data-categoria]');
        if (link) {
            var cat = (link.dataset.categoria || link.textContent).trim();
            if (/^(in[ií]cio|todos)$/i.test(cat)) cat = '';
            registarFiltro({ cat: cat, q: '' });
            return;
        }
        if (e.target.closest('#btn-pesquisar')) {
            var campo = q('#input-pequisar');
            registarFiltro({ cat: '', q: campo ? campo.value.trim() : '' });
            return;
        }
        if (e.target.closest('#btn-voltar-inicio')) {
            registarFiltro({ cat: '', q: '' });
        }
    });

    document.addEventListener('keydown', function (e) {
        if (restaurando) return;
        if (e.key === 'Enter' && e.target && e.target.id === 'input-pequisar') {
            registarFiltro({ cat: '', q: e.target.value.trim() });
        }
    });

    function iniciar() {
        // se o menu já estiver "aberto" ao carregar, não é um menu que se abre e fecha: ignora-o
        menuIgnorado = menuAberto();

        // a entrada atual passa a ser a "lista inicial" (também depois de recarregar a página)
        history.replaceState({ lsFiltro: filtroAtual }, '');

        new MutationObserver(reconciliar).observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });
        setInterval(reconciliar, 300);   // rede de segurança (ex.: o menu a deslizar para fora)
        reconciliar();
    }

    if (document.body) iniciar();
    else document.addEventListener('DOMContentLoaded', iniciar);
})();