// =========================================================
// LS SHOPPING - Menu lateral (menu.js)
// =========================================================

document.addEventListener('DOMContentLoaded', () => {

    // 1. BUSCAR OS ELEMENTOS DO HTML (cada um pelo seu id)
    const btnMenu = document.getElementById('btn-menu');
    const menuLateral = document.getElementById('menu-lateral');
    const menuFundo = document.getElementById('menu-fundo');
    const btnFecharMenu = document.getElementById('fechar-menu');
    const modalInfo = document.getElementById('modal-info');
    const btnFecharInfo = document.getElementById('fechar-info');

    // Se o menu não existir no HTML, pára aqui
    if (!btnMenu || !menuLateral || !menuFundo) return;

    // 2. TEXTOS DAS JANELAS "SOBRE", "AJUDA" E "TERMOS" (Profissionais e Atualizados)
    const textosInfo = {
        sobre: { 
            titulo: 'Sobre a LS SHOPPING', 
            texto: `
                <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 10px;">
                    A <strong>LS SHOPPING</strong> é a principal plataforma digital de comércio em Lunda Sul (Saurimo), projetada para facilitar a compra e venda de produtos entre a comunidade local de forma rápida, transparente e segura.
                </p>
                <div id="texto-sobre-estendido" style="display: none; font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 10px;">
                    A nossa missão é impulsionar pequenos e grandes negócios na região, permitindo que qualquer utilizador possa publicar os seus anúncios e alcançar potenciais clientes rapidamente. Acreditamos no fortalecimento do comércio local através de canais de negociação direta e simples.
                </div>
                <button type="button" id="btn-ver-mais-sobre" style="background: none; border: none; color: #002780; font-weight: 600; cursor: pointer; padding: 0; font-size: 13px;">Ver mais</button>
            ` 
        },
        ajuda: { 
            titulo: 'Ajuda e Contactos', 
            texto: `
                <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 16px;">
                    Precisa de assistência ou tem dúvidas sobre a publicação de anúncios na <strong>LS SHOPPING</strong>? O nosso apoio ao utilizador é feito exclusivamente através do nosso WhatsApp oficial.
                </p>
                <a href="https://wa.me/244962003474?text=Olá!%20Preciso%20de%20ajuda%20na%20LS%20SHOPPING." target="_blank" style="display: block; text-align: center; padding: 12px; background: #fff; color: #002780; border: 2px solid #002780; border-radius: 6px; font-weight: 600; text-decoration: none; font-size: 14px; transition: all 0.2s;">
                    Contactar Suporte pelo WhatsApp
                </a>
            ` 
        },
        termos: { 
            titulo: 'Termos e Privacidade', 
            texto: `
                <div style="font-size: 13px; color: #475569; line-height: 1.6;">
                    <p style="margin-bottom: 12px;">
                        <strong>1. Validade do Anúncio:</strong> Todos os anúncios permanecem ativos na plataforma por um período máximo de <strong>30 dias</strong>, sendo removidos automaticamente após esse prazo.
                    </p>
                    <p style="margin-bottom: 12px;">
                        <strong>2. Negociação Direta:</strong> A LS SHOPPING funciona como uma vitrine de aproximação. As transações financeiras, pagamentos e entregas são combinadas e efetuadas sob inteira responsabilidade do comprador e vendedor.
                    </p>
                    <p style="margin-bottom: 0;">
                        <strong>3. Proteção de Dados:</strong> O teu e-mail e dados de conta são protegidos e mantidos em segurança, utilizados unicamente para gerir o teu acesso e anúncios.
                    </p>
                </div>
            ` 
        }
    };

    // 3. FUNÇÕES AUXILIARES
    function estaVisivel(id) {
        const el = document.getElementById(id);
        return !!el && getComputedStyle(el).display !== 'none';
    }

    function clicar(id) {
        const el = document.getElementById(id);
        if (el) el.click();
    }

    function estaLogado() {
        return estaVisivel('usuario-logado');
    }

    // 4. ABRIR E FECHAR O MENU
    function abrirMenu() {
        const logado = estaLogado();
        const itemEntrar = menuLateral.querySelector('[data-acao="entrar"]');
        const itemSair = menuLateral.querySelector('[data-acao="sair"]');
        if (itemEntrar) itemEntrar.style.display = logado ? 'none' : 'block';
        if (itemSair) itemSair.style.display = logado ? 'block' : 'none';

        menuLateral.classList.add('aberto');
        menuFundo.classList.add('aberto');
    }

    function fecharMenu() {
        menuLateral.classList.remove('aberto');
        menuFundo.classList.remove('aberto');
    }

    // 5. JANELA DE INFORMAÇÕES (Atualizado para suporte a HTML e Ver Mais)
    function abrirInfo(chave) {
        const info = textosInfo[chave];
        if (!info || !modalInfo) return;
        document.getElementById('info-titulo').textContent = info.titulo;
        document.getElementById('info-texto').innerHTML = info.texto;
        modalInfo.style.display = 'flex';

        // Ativa o clique do Ver mais / Ver menos se for a aba 'sobre'
        if (chave === 'sobre') {
            setTimeout(() => {
                const btnVerMais = document.getElementById('btn-ver-mais-sobre');
                const textoEstendido = document.getElementById('texto-sobre-estendido');
                if (btnVerMais && textoEstendido) {
                    btnVerMais.addEventListener('click', () => {
                        const aberto = textoEstendido.style.display === 'block';
                        textoEstendido.style.display = aberto ? 'none' : 'block';
                        btnVerMais.textContent = aberto ? 'Ver mais' : 'Ver menos';
                    });
                }
            }, 50);
        }
    }

    function fecharInfo() {
        if (modalInfo) modalInfo.style.display = 'none';
    }

    // 6. AÇÕES DO MENU
    function irParaInicio() {
        const ativa = document.querySelector('.categorias a.ativa');
        if (ativa) ativa.click();
        const input = document.getElementById('input-pequisar');
        if (input) input.value = '';
        location.hash = '';
        window.scrollTo({ top: 0 });
    }

    function irParaCategoria(nome) {
        const alvo = nome.trim().toLowerCase();
        document.querySelectorAll('.categorias a').forEach(link => {
            const igual = link.textContent.trim().toLowerCase() === alvo;
            if (igual && !link.classList.contains('ativa')) link.click();
        });
    }

    // 7. LIGAR OS EVENTOS (o que acontece quando se clica)
    btnMenu.addEventListener('click', abrirMenu);
    menuFundo.addEventListener('click', fecharMenu);
    if (btnFecharMenu) btnFecharMenu.addEventListener('click', fecharMenu);

    if (btnFecharInfo) btnFecharInfo.addEventListener('click', fecharInfo);
    if (modalInfo) {
        modalInfo.addEventListener('click', (e) => {
            if (e.target === modalInfo) fecharInfo();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            fecharMenu();
            fecharInfo();
        }
    });

    menuLateral.querySelectorAll('a').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            fecharMenu();

            const acao = item.dataset.acao;
            const categoria = item.dataset.categoria;

            if (categoria) {
                irParaCategoria(categoria);
            } else if (acao === 'inicio') {
                irParaInicio();
            } else if (acao === 'anunciar') {
                clicar(estaLogado() ? 'btn-abrir-publicar' : 'btn-abrir-login');
            } else if (acao === 'mensagens') {
                if (estaLogado()) {
                    if (!estaVisivel('caixa-chat')) clicar('btn-abrir-chat');
                } else {
                    clicar('btn-abrir-login');
                }
            } else if (acao === 'entrar') {
                clicar('btn-abrir-login');
            } else if (acao === 'sair') {
                clicar('btn-sair');
            } else if (acao === 'sobre' || acao === 'ajuda' || acao === 'termos') {
                abrirInfo(acao);
            }
        });
    });

});