// =========================================================
// LS SHOPPING - Galeria de fotos (galeria.js)
// As fotos vêm do Supabase (tabela produtos).
// =========================================================

document.addEventListener('DOMContentLoaded', () => {

    // 1. Criar a janela da galeria (começa escondida)
    const galeria = document.createElement('div');
    galeria.className = 'galeria';
    galeria.innerHTML = `
        <button type="button" class="galeria-fechar" aria-label="Fechar">&times;</button>
        <button type="button" class="galeria-seta galeria-anterior" aria-label="Anterior">&#8249;</button>
        <div class="galeria-centro">
            <img class="galeria-foto" alt="">
            <div class="galeria-contador"></div>
        </div>
        <button type="button" class="galeria-seta galeria-proxima" aria-label="Seguinte">&#8250;</button>
        <div class="galeria-miniaturas"></div>
    `;
    document.body.appendChild(galeria);

    const foto = galeria.querySelector('.galeria-foto');
    const contador = galeria.querySelector('.galeria-contador');
    const miniaturas = galeria.querySelector('.galeria-miniaturas');
    let fotos = [];
    let atual = 0;

    // 2. Mostrar a foto número i
    function mostrar(i) {
        atual = (i + fotos.length) % fotos.length;       // volta ao início/fim
        foto.src = fotos[atual];
        contador.textContent = (atual + 1) + ' / ' + fotos.length;
        miniaturas.querySelectorAll('img').forEach((m, k) => {
            m.classList.toggle('ativa', k === atual);
        });
    }

    // 3. Abrir a galeria de um produto (busca as fotos ao Supabase)
    async function abrir(idProduto) {
        const cliente = window.supabaseLS;
        if (!cliente) return;

        const { data: prod, error } = await cliente
            .from('produtos')
            .select('imagens, imagem_url')
            .eq('id', idProduto)
            .single();

        if (error || !prod) return;

        let lista = prod.imagens;
        if (typeof lista === 'string') {
            try { lista = JSON.parse(lista); } catch (e) { lista = []; }
        }

        fotos = (Array.isArray(lista) && lista.length) ? lista : [prod.imagem_url || 'ls.png'];

        miniaturas.innerHTML = '';
        fotos.forEach((src, k) => {
            const m = document.createElement('img');
            m.src = src;
            m.alt = 'Foto ' + (k + 1);
            m.addEventListener('click', () => mostrar(k));
            miniaturas.appendChild(m);
        });

        galeria.classList.toggle('uma-foto', fotos.length < 2);
        galeria.classList.add('aberta');
        mostrar(0);
    }

    function fechar() {
        galeria.classList.remove('aberta');
    }

    // 4. Eventos
    document.addEventListener('click', (e) => {
        const alvo = e.target.closest('[data-galeria]');
        if (alvo) abrir(alvo.dataset.galeria);
    });

    galeria.querySelector('.galeria-fechar').addEventListener('click', fechar);
    galeria.querySelector('.galeria-anterior').addEventListener('click', () => mostrar(atual - 1));
    galeria.querySelector('.galeria-proxima').addEventListener('click', () => mostrar(atual + 1));
    galeria.addEventListener('click', (e) => {
        if (e.target === galeria) fechar();              // clique no fundo escuro
    });

    document.addEventListener('keydown', (e) => {
        if (!galeria.classList.contains('aberta')) return;
        if (e.key === 'Escape') fechar();
        if (e.key === 'ArrowLeft') mostrar(atual - 1);
        if (e.key === 'ArrowRight') mostrar(atual + 1);
    });
});