// =========================================================
// LS SHOPPING - Fotos do produto (fotos.js)
// Escolher até 6 fotos; a primeira é a capa.
// =========================================================

document.addEventListener('DOMContentLoaded', () => {

    const MAX_FOTOS = 6;
    const input = document.getElementById('prod-imagem');
    const previa = document.getElementById('previa-fotos');
    const dica = document.getElementById('contador-fotos');
    if (!input || !previa) return;

    // Lista das fotos escolhidas (posição 0 = capa). O script.js lê esta lista.
    window.fotosProduto = [];

    // Reduz a foto (máx. 800px) para ocupar pouco espaço
    function comprimir(ficheiro) {
        return new Promise((resolve, reject) => {
            const leitor = new FileReader();
            leitor.onerror = reject;
            leitor.onload = () => {
                const img = new Image();
                img.onerror = reject;
                img.onload = () => {
                    const maximo = 800;
                    const escala = Math.min(1, maximo / Math.max(img.width, img.height));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(img.width * escala);
                    canvas.height = Math.round(img.height * escala);
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.65));
                };
                img.src = leitor.result;
            };
            leitor.readAsDataURL(ficheiro);
        });
    }

    // Desenha as miniaturas
    function desenharPrevia() {
        previa.innerHTML = '';

        window.fotosProduto.forEach((src, i) => {
            const item = document.createElement('div');
            item.className = 'foto-previa' + (i === 0 ? ' capa' : '');

            const img = document.createElement('img');
            img.src = src;
            item.appendChild(img);

            if (i === 0) {
                const etiqueta = document.createElement('span');
                etiqueta.className = 'etiqueta-capa';
                etiqueta.textContent = 'Capa';
                item.appendChild(etiqueta);
            } else {
                const btnCapa = document.createElement('button');
                btnCapa.type = 'button';
                btnCapa.className = 'foto-btn-capa';
                btnCapa.textContent = 'Tornar capa';
                btnCapa.addEventListener('click', () => {
                    const [foto] = window.fotosProduto.splice(i, 1);   // tira da posição i
                    window.fotosProduto.unshift(foto);                 // põe no início
                    desenharPrevia();
                });
                item.appendChild(btnCapa);
            }

            const btnRemover = document.createElement('button');
            btnRemover.type = 'button';
            btnRemover.className = 'foto-btn-remover';
            btnRemover.textContent = '×';
            btnRemover.addEventListener('click', () => {
                window.fotosProduto.splice(i, 1);
                desenharPrevia();
            });
            item.appendChild(btnRemover);

            previa.appendChild(item);
        });

        if (dica) {
            const n = window.fotosProduto.length;
            dica.textContent = n === 0
                ? 'Pode escolher até 6 fotos. A primeira é a capa.'
                : n + ' de 6 fotos. A primeira é a capa (use "Tornar capa" para trocar).';
        }
    }

    // Quando o utilizador escolhe fotos
    input.addEventListener('change', async () => {
        const escolhidos = Array.from(input.files);

        for (const ficheiro of escolhidos) {
            if (window.fotosProduto.length >= MAX_FOTOS) {
                alert('O máximo é 6 fotos por produto.');
                break;
            }
            try {
                const foto = await comprimir(ficheiro);
                window.fotosProduto.push(foto);
            } catch (erro) {
                console.error('Não foi possível ler a foto', ficheiro.name);
            }
        }

        input.value = '';      // permite escolher outra vez a mesma foto
        desenharPrevia();
    });

    // O script.js chama isto depois de publicar
    window.limparFotosProduto = function () {
        window.fotosProduto = [];
        desenharPrevia();
    };

    desenharPrevia();
});