/// =========================================================
// LS SHOPPING - Aviso de erros (erros.js)
// Mostra num aviso vermelho, no fundo do site, qualquer erro de JavaScript,
// com o nome do ficheiro e a linha. Tem de ser o PRIMEIRO script.
// =========================================================
(function () {
    var mensagens = [];

    function desenhar() {
        var caixa = document.getElementById('aviso-erros-js');
        if (!caixa) {
            caixa = document.createElement('div');
            caixa.id = 'aviso-erros-js';
            caixa.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;' +
                'background:#b71c1c;color:#fff;font:13px/1.4 Arial,sans-serif;' +
                'padding:10px 44px 10px 14px;max-height:40vh;overflow:auto;';
            document.body.appendChild(caixa);
        }
        caixa.innerHTML = '';

        var titulo = document.createElement('strong');
        titulo.textContent = 'Erro no JavaScript. Copie este texto e envie-o:';
        caixa.appendChild(titulo);

        mensagens.forEach(function (texto) {
            var linha = document.createElement('div');
            linha.textContent = texto;
            caixa.appendChild(linha);
        });

        var fechar = document.createElement('button');
        fechar.textContent = '\u00d7';
        fechar.style.cssText = 'position:absolute;top:6px;right:12px;background:none;border:none;color:#fff;font-size:22px;cursor:pointer;';
        fechar.onclick = function () { caixa.remove(); mensagens = []; };
        caixa.appendChild(fechar);
    }

    // O "true" no fim apanha também ficheiros que não foram encontrados
    window.addEventListener('error', function (e) {
        var texto;
        if (e.target && e.target !== window && e.target.tagName) {
            var etiqueta = e.target.tagName;
            if (etiqueta !== 'SCRIPT' && etiqueta !== 'LINK') return;
            texto = 'Não foi possível carregar o ficheiro: ' +
                (e.target.getAttribute('src') || e.target.getAttribute('href'));
        } else {
            var ficheiro = (e.filename || '').split('/').pop() || 'desconhecido';
            texto = ficheiro + ' (linha ' + e.lineno + '): ' + e.message;
            if (e.message === 'Script error.') texto += ' (abra o Console com F12 para ver os detalhes)';
        }
        mensagens.push(texto);
        desenhar();
    }, true);

    window.addEventListener('unhandledrejection', function (e) {
        var motivo = e.reason && e.reason.message ? e.reason.message : String(e.reason);
        mensagens.push('Promessa falhou: ' + motivo);
        desenhar();
    });
})();