// =========================================================
// LS SHOPPING - Meus Produtos (meus-produtos.js)
// Zona à parte onde o vendedor gere os seus anúncios.
// =========================================================

const supabaseMeus = window.supabase ? window.supabase.createClient('https://anlzhexippncsdxnwiel.supabase.co', 'sb_publishable_XUgtq7ktyeAhE8_bFya5ug_UBFoY') : null;

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
        return localStorage.getItem('ls_usuario') || localStorage.getItem('ls_sessao') || '';
    }

    async function lerProdutosSupabase() {
        if (!supabaseMeus) return [];
        const { data: { session } } = await supabaseMeus.auth.getSession();
        const userId = session ? session.user.id : null;

        let query = supabaseMeus.from('produtos').select('*');
        if (userId) {
            query = query.eq('user_id', userId);
        } else {
            return [];
        }

        const { data, error } = await query.order('criado_em', { ascending: false });
        if (error || !data) return [];

        return data.map(p => ({
            id: p.id,
            dono: p.user_id,
            nome: p.titulo || p.nome,
            categoria: p.categoria,
            preco: Number(p.preco),
            unidades: p.unidades || 1,
            contacto: p.contacto || '',
            descricao: p.descricao,
            imagens: p.imagens || [p.imagem_url || p.imagem || 'ls.png'],
            imagem: p.imagem_url || p.imagem || 'ls.png',
            vendido: p.vendido || false,
            expiraEm: p.criado_em ? new Date(p.criado_em).getTime() + (30 * 24 * 60 * 60 * 1000) : Date.now() + (30 * 24 * 60 * 60 * 1000)
        }));
    }

    function diasRestantes(p) {
        if (!p.expiraEm) return null;
        return Math.max(0, Math.ceil((p.expiraEm - Date.now()) / 86400000));
    }

    // 5. Desenhar a lista dos meus produtos
    async function desenhar() {
        const email = usuarioAtual();
        if (!email) {
            lista.innerHTML = '<p class="painel-meus-vazio">Inicie sessão para ver os seus produtos.</p>';
            return;
        }

        const meus = await lerProdutosSupabase();
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

            cartao.querySelector('.acao-editar').addEventListener('click', () => abrirEdicao(p.id, meus));
            btnVendido.addEventListener('click', () => alternarVendido(p.id, p.vendido));
            cartao.querySelector('.acao-eliminar').addEventListener('click', () => eliminar(p.id));

            lista.appendChild(cartao);
        });
    }

    // 6. Ações
    async function alternarVendido(id, estadoAtual) {
        if (!supabaseMeus) return;
        const { error } = await supabaseMeus
            .from('produtos')
            .update({ vendido: !estadoAtual })
            .eq('id', id);

        if (error) {
            alert('Não foi possível atualizar o estado.');
            return;
        }
        if (window.recarregarVitrine) window.recarregarVitrine();
        await desenhar();
    }

    async function eliminar(id) {
        if (!confirm('Eliminar este anúncio? Esta ação não pode ser desfeita.')) return;
        if (!supabaseMeus) return;

        const { error } = await supabaseMeus
            .from('produtos')
            .delete()
            .eq('id', id);

        if (error) {
            alert('Não foi possível eliminar o anúncio.');
            return;
        }
        if (window.recarregarVitrine) window.recarregarVitrine();
        await desenhar();
    }

    async function abrirEdicao(id, listaProdutos) {
        const p = listaProdutos.find(x => x.id === id);
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

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!supabaseMeus || !idEmEdicao) return;

        const novosDados = {
            titulo: form.nome.value.trim(),
            categoria: form.categoria.value,
            preco: Number(form.preco.value),
            unidades: Number(form.unidades.value),
            contacto: form.contacto.value.trim(),
            descricao: form.descricao.value.trim()
        };

        const { error } = await supabaseMeus
            .from('produtos')
            .update(novosDados)
            .eq('id', idEmEdicao);

        if (error) {
            alert('Não foi possível guardar as alterações.');
            return;
        }

        fecharEdicao();
        if (window.recarregarVitrine) window.recarregarVitrine();
        await desenhar();
    });

    // 7. Abrir e fechar o painel
    async function abrirPainel() {
        if (!usuarioAtual()) {
            const entrar = document.getElementById('btn-abrir-login');
            if (entrar) entrar.click();
            return;
        }
        await desenhar();
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