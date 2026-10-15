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
    let bloqueouScroll = false;

    // No telemóvel: a foto não arrasta a página para os lados e a tira de miniaturas desliza sozinha
    galeria.style.touchAction = 'pan-y pinch-zoom';
    miniaturas.style.touchAction = 'pan-x';

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
        // Enquanto a galeria está aberta, a página por baixo fica parada
        if (!document.body.classList.contains('sem-scroll')) {
            document.body.classList.add('sem-scroll');
            bloqueouScroll = true;
        }
        galeria.classList.add('aberta');
        mostrar(0);
    }

    function fechar() {
        galeria.classList.remove('aberta');
        if (bloqueouScroll) {
            document.body.classList.remove('sem-scroll');
            bloqueouScroll = false;
        }
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

    // 5. Deslizar o dedo: para a esquerda = foto seguinte, para a direita = foto anterior
    let toqueX = 0;
    let toqueY = 0;
    let tocando = false;

    galeria.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1 || e.target.closest('.galeria-miniaturas')) {
            tocando = false;
            return;
        }
        toqueX = e.touches[0].clientX;
        toqueY = e.touches[0].clientY;
        tocando = true;
    }, { passive: true });

    galeria.addEventListener('touchend', (e) => {
        if (!tocando) return;
        tocando = false;
        if (fotos.length < 2 || !e.changedTouches.length) return;

        const dx = e.changedTouches[0].clientX - toqueX;
        const dy = e.changedTouches[0].clientY - toqueY;

        // Só conta se foi um deslize claro e mais para os lados do que para cima/baixo
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            mostrar(dx < 0 ? atual + 1 : atual - 1);
        }
    }, { passive: true });
});