// =========================================================
// LS SHOPPING - Meus Produtos (meus-produtos.js)
// Zona à parte onde o vendedor gere os seus anúncios.
// =========================================================

document.addEventListener('DOMContentLoaded', () => {

    // 1. O item "Meus Produtos" do menu
    const itemMenu = document.querySelector('#menu-lateral [data-acao="meus-produtos"]');
    if (!itemMenu) return;

    // 2. Criar o painel (começa escondido)
    const painel = document.createElement('div');
    painel.className = 'painel-meus';
    painel.innerHTML = `
        <div class="painel-meus-topo">
            <button type="button" class="painel-meus-voltar">← Voltar</button>
            <h2>Meus Produtos</h2>
        </div>
        <div class="painel-meus-corpo">
            <p class="painel-meus-aviso">Os anúncios ficam 30 dias no site. Quando vender, marque como vendido e ele deixa de aparecer.</p>
            <div class="painel-meus-lista"></div>
        </div>
    `;
    document.body.appendChild(painel);

    // 3. Criar a janela de editar (começa escondida)
    const dialogo = document.createElement('div');
    dialogo.className = 'editar-fundo';
    dialogo.innerHTML = `
        <div class="editar-caixa">
            <h3>Editar produto</h3>
            <form class="editar-form">
                <input type="text" name="nome" placeholder="Nome do Produto" required>
                <select name="categoria" required>
                    <option value="Roupas">Roupas</option>
                    <option value="Telefones">Telefones</option>
                    <option value="Eletronicos">Eletronicos</option>
                    <option value="Eletrodomesticos">Eletrodomesticos</option>
                    <option value="outros">Outros</option>
                </select>
                <input type="number" name="preco" placeholder="Preço" min="0" required>
                <input type="number" name="unidades" placeholder="Unidades" min="0" required>
                <input type="tel" name="contacto" placeholder="Número de Telefone/ WhatsApp" required>
                <textarea name="descricao" placeholder="Descrição do produto" rows="4" required></textarea>
                <div class="editar-botoes">
                    <button type="button" class="editar-cancelar">Cancelar</button>
                    <button type="submit" class="editar-guardar">Guardar alterações</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(dialogo);

    const lista = painel.querySelector('.painel-meus-lista');
    const form = dialogo.querySelector('.editar-form');
    let idEmEdicao = null;

    // 4. Funções auxiliares
    function usuarioAtual() {
        return localStorage.getItem('ls_usuario') || '';
    }

    function lerProdutos() {
        try { return JSON.parse(localStorage.getItem('ls_produtos')) || []; }
        catch (e) { return []; }
    }

    // Guarda e pede ao script.js para atualizar a vitrine
    function guardarProdutos(todos) {
        try {
            localStorage.setItem('ls_produtos', JSON.stringify(todos));
        } catch (e) {
            alert('Não foi possível guardar as alterações (armazenamento cheio).');
            return false;
        }
        if (window.recarregarVitrine) window.recarregarVitrine();
        return true;
    }

    function diasRestantes(p) {
        if (!p.expiraEm) return null;
        return Math.max(0, Math.ceil((p.expiraEm - Date.now()) / 86400000));
    }

    // 5. Desenhar a lista dos meus produtos
    function desenhar() {
        const email = usuarioAtual();
        const meus = lerProdutos().filter(p => email && p.dono === email);
        lista.innerHTML = '';

        if (meus.length === 0) {
            const vazio = document.createElement('p');
            vazio.className = 'painel-meus-vazio';
            vazio.textContent = 'Ainda não publicou nenhum produto.';
            lista.appendChild(vazio);
            return;
        }

        meus.forEach(p => {
            const cartao = document.createElement('div');
            cartao.className = 'meu-produto' + (p.vendido ? ' vendido' : '');
            cartao.innerHTML = `
                <img class="meu-produto-foto" data-galeria="${p.id}" alt="">
                <div class="meu-produto-info">
                    <h3></h3>
                    <p class="meu-produto-detalhes"></p>
                    <p class="meu-produto-estado"></p>
                </div>
                <div class="meu-produto-acoes">
                    <button type="button" class="acao-editar">Editar</button>
                    <button type="button" class="acao-vendido"></button>
                    <button type="button" class="acao-eliminar">Eliminar</button>
                </div>
            `;

            // Os textos entram com textContent (seguro, não interpreta HTML)
            cartao.querySelector('img').src = p.imagem;
            cartao.querySelector('h3').textContent = p.nome;
            cartao.querySelector('.meu-produto-detalhes').textContent =
                Number(p.preco).toLocaleString('pt-AO') + ' Kz · ' + p.unidades + ' un. · ' + p.categoria;

            const estado = cartao.querySelector('.meu-produto-estado');
            const dias = diasRestantes(p);
            if (p.vendido) {
                estado.textContent = 'Vendido: já não aparece no site';
            } else if (dias === null) {
                estado.textContent = 'Visível no site';
            } else if (dias === 0) {
                estado.textContent = 'Visível no site · expira hoje';
            } else {
                estado.textContent = 'Visível no site · expira em ' + dias + (dias === 1 ? ' dia' : ' dias');
            }

            const btnVendido = cartao.querySelector('.acao-vendido');
            btnVendido.textContent = p.vendido ? 'Voltar a publicar' : 'Marcar como vendido';

            cartao.querySelector('.acao-editar').addEventListener('click', () => abrirEdicao(p.id));
            btnVendido.addEventListener('click', () => alternarVendido(p.id));
            cartao.querySelector('.acao-eliminar').addEventListener('click', () => eliminar(p.id));

            lista.appendChild(cartao);
        });
    }

    // 6. Ações
    function alternarVendido(id) {
        const todos = lerProdutos();
        const p = todos.find(x => x.id === id);
        if (!p) return;
        p.vendido = !p.vendido;
        if (guardarProdutos(todos)) desenhar();
    }

    function eliminar(id) {
        if (!confirm('Eliminar este anúncio? Esta ação não pode ser desfeita.')) return;
        const restantes = lerProdutos().filter(x => x.id !== id);
        if (guardarProdutos(restantes)) desenhar();
    }

    function abrirEdicao(id) {
        const p = lerProdutos().find(x => x.id === id);
        if (!p) return;
        idEmEdicao = id;
        form.nome.value = p.nome;
        form.categoria.value = p.categoria;
        form.preco.value = p.preco;
        form.unidades.value = p.unidades;
        form.contacto.value = p.contacto;
        form.descricao.value = p.descricao;
        dialogo.classList.add('aberto');
    }

    function fecharEdicao() {
        dialogo.classList.remove('aberto');
        idEmEdicao = null;
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const todos = lerProdutos();
        const p = todos.find(x => x.id === idEmEdicao);
        if (!p) return;
        p.nome = form.nome.value.trim();
        p.categoria = form.categoria.value;
        p.preco = form.preco.value;
        p.unidades = form.unidades.value;
        p.contacto = form.contacto.value.trim();
        p.descricao = form.descricao.value.trim();
        if (guardarProdutos(todos)) {
            fecharEdicao();
            desenhar();
        }
    });

    // 7. Abrir e fechar o painel
    function abrirPainel() {
        if (!usuarioAtual()) {
            // Sem login: abre a janela de entrar
            const entrar = document.getElementById('btn-abrir-login');
            if (entrar) entrar.click();
            return;
        }
        desenhar();
        painel.classList.add('aberto');
        document.body.classList.add('sem-scroll');
    }

    function fecharPainel() {
        painel.classList.remove('aberto');
        document.body.classList.remove('sem-scroll');
    }

    itemMenu.addEventListener('click', abrirPainel);
    painel.querySelector('.painel-meus-voltar').addEventListener('click', fecharPainel);
    dialogo.querySelector('.editar-cancelar').addEventListener('click', fecharEdicao);
    dialogo.addEventListener('click', (e) => {
        if (e.target === dialogo) fecharEdicao();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (dialogo.classList.contains('aberto')) fecharEdicao();
        else if (painel.classList.contains('aberto')) fecharPainel();
    });
});