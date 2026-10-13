
// =========================================================
// LS SHOPPING - Contas (contas.js)
// Janela ENTRAR, janela INSCREVER-SE, olho, força da palavra-passe e sessão.
// =========================================================

const supabaseClient = window.supabaseLS;

document.addEventListener('DOMContentLoaded', () => {

    // Liga um evento só se o elemento existir
    function ligar(elemento, evento, funcao) {
        if (elemento) elemento.addEventListener(evento, funcao);
    }

    // Procura um elemento obrigatório; se faltar, diz exatamente qual
    function exigir(id) {
        const el = document.getElementById(id);
        if (!el) throw new Error('contas.js: não encontrei o elemento com id="' + id + '" no index.html');
        return el;
    }

    // =====================================================
    // 1. ELEMENTOS DO HTML
    // =====================================================
    const modalEntrar = exigir('modal-auth');
    const modalCadastro = exigir('modal-cadastro');
    const formEntrar = exigir('form-entrar');
    const formCadastro = exigir('form-cadastro');
    const erroEntrar = exigir('erro-entrar');
    const erroCadastro = exigir('erro-cadastro');

    // Opcionais (o site funciona mesmo que algum falte)
    const usuarioLogadoDiv = document.getElementById('usuario-logado');
    const nomeUsuarioEl = document.getElementById('nome-usuario');
    const linksAuth = document.querySelectorAll('.inscerever-entrar > a');
    const btnSair = document.getElementById('btn-sair');
    const btnAbrirLogin = document.getElementById('btn-abrir-login');
    const btnAbrirCadastro = document.getElementById('btn-abrir-cadastro');
    const btnFecharAuth = document.getElementById('fechar-auth');
    const btnFecharCadastro = document.getElementById('fechar-cadastro');
    const irInscrever = document.getElementById('ir-inscrever');
    const irEntrar = document.getElementById('ir-entrar');
    const barraForca = document.getElementById('forca-barra');
    const textoForca = document.getElementById('forca-texto');
    const campoSenhaCadastro = document.getElementById('cad-senha');

    // =====================================================
    // 2. O OLHO PARA VER A PALAVRA-PASSE
    // =====================================================
    const ICONE_VER = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    const ICONE_ESCONDER = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

    // Volta a esconder todas as palavras-passe (e põe o ícone do olho aberto)
    function esconderSenhas() {
        document.querySelectorAll('.campo-senha').forEach((campo) => {
            const input = campo.querySelector('input');
            const botao = campo.querySelector('.btn-olho');
            if (input) input.type = 'password';
            if (botao) {
                botao.innerHTML = ICONE_VER;
                botao.setAttribute('aria-label', 'Mostrar palavra-passe');
            }
        });
    }

    document.querySelectorAll('.campo-senha').forEach((campo) => {
        const input = campo.querySelector('input');
        const botao = campo.querySelector('.btn-olho');
        if (!input || !botao) return;

        botao.addEventListener('click', (e) => {
            e.preventDefault(); // Impede que o botão submeta o formulário
            const mostrar = (input.type === 'password');
            input.type = mostrar ? 'text' : 'password';
            botao.innerHTML = mostrar ? ICONE_ESCONDER : ICONE_VER;
            botao.setAttribute('aria-label', mostrar ? 'Esconder palavra-passe' : 'Mostrar palavra-passe');
        });
    });

    esconderSenhas();

    // =====================================================
    // 3. BARRA DE FORÇA DA PALAVRA-PASSE (janela Inscrever-se)
    // =====================================================
    function atualizarForca() {
        if (!barraForca || !textoForca || !campoSenhaCadastro) return;
        const senha = campoSenhaCadastro.value;

        let pontos = 0;
        if (senha.length >= 6) pontos++;
        if (senha.length >= 10) pontos++;
        if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos++;
        if (/\d/.test(senha)) pontos++;
        if (/[^a-zA-Z0-9]/.test(senha)) pontos++;

        let largura = 0;
        let cor = '#c62828';
        let texto = 'Use letras e números.';

        if (senha.length === 0) {
            largura = 0;
        } else if (pontos <= 2) {
            largura = 33; cor = '#c62828'; texto = 'Palavra-passe fraca';
        } else if (pontos === 3) {
            largura = 66; cor = '#ef8f00'; texto = 'Palavra-passe média';
        } else {
            largura = 100; cor = '#2e7d32'; texto = 'Palavra-passe forte';
        }

        barraForca.style.width = largura + '%';
        barraForca.style.background = cor;
        textoForca.textContent = texto;
    }

    ligar(campoSenhaCadastro, 'input', atualizarForca);

    // =====================================================
    // 4. ABRIR E FECHAR AS DUAS JANELAS
    // =====================================================
    function abrir(modal) { modal.style.display = 'flex'; }
    function fechar(modal) { modal.style.display = 'none'; }

    function abrirEntrar() {
        fechar(modalCadastro);
        erroEntrar.textContent = '';
        esconderSenhas();
        abrir(modalEntrar);
        setTimeout(() => {
            const campo = document.getElementById('entrar-identificador');
            if (campo) campo.focus();
        }, 50);
    }

    function abrirCadastro() {
        fechar(modalEntrar);
        erroCadastro.textContent = '';
        esconderSenhas();
        abrir(modalCadastro);
        setTimeout(() => {
            const campo = document.getElementById('cad-email');
            if (campo) campo.focus();
        }, 50);
    }

    // "Entrar" e "Inscrever-se" do topo do site
    ligar(btnAbrirLogin, 'click', (e) => { e.preventDefault(); abrirEntrar(); });
    ligar(btnAbrirCadastro, 'click', (e) => { e.preventDefault(); abrirCadastro(); });

    // Botões/links para trocar de janela
    ligar(irInscrever, 'click', (e) => { e.preventDefault(); abrirCadastro(); });
    ligar(irEntrar, 'click', (e) => { e.preventDefault(); abrirEntrar(); });

    // Fechar a janela de entrar (botão X e clique fora)
    ligar(btnFecharAuth, 'click', () => fechar(modalEntrar));
    ligar(modalEntrar, 'click', (e) => {
        if (e.target === modalEntrar) fechar(modalEntrar);
    });

    // Fechar a janela de inscrever-se (botão X e clique fora)
    ligar(btnFecharCadastro, 'click', () => fechar(modalCadastro));
    ligar(modalCadastro, 'click', (e) => {
        if (e.target === modalCadastro) fechar(modalCadastro);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            fechar(modalEntrar);
            fechar(modalCadastro);
        }
    });

    // =====================================================
    // 5. CONTAS GUARDADAS NO NAVEGADOR
    // =====================================================
    function lerContas() {
        try { return JSON.parse(localStorage.getItem('ls_contas')) || []; }
        catch (e) { return []; }
    }

    function guardarContas(contas) {
        localStorage.setItem('ls_contas', JSON.stringify(contas));
    }

    // Transforma a palavra-passe num "resumo" (hash), para não a guardar às claras.
    async function gerarHash(senha, sal) {
        const texto = sal + ':' + senha;
        if (window.crypto && crypto.subtle) {
            const bytes = new TextEncoder().encode(texto);
            const resumo = await crypto.subtle.digest('SHA-256', bytes);
            return 'sha256:' + Array.from(new Uint8Array(resumo))
                .map(b => b.toString(16).padStart(2, '0')).join('');
        }
        let h = 5381;
        for (let i = 0; i < texto.length; i++) {
            h = ((h << 5) + h + texto.charCodeAt(i)) | 0;
        }
        return 'simples:' + (h >>> 0).toString(16);
    }

    function emailValido(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    }

    function usuarioValido(usuario) {
        return /^[a-zA-Z0-9_.]{3,20}$/.test(usuario);
    }

    // =====================================================
    // 6. ESTADO NO TOPO DO SITE E SESSÃO
    // =====================================================
    function mostrarLogado(usuario) {
        if (usuarioLogadoDiv) usuarioLogadoDiv.style.display = 'flex';
        if (nomeUsuarioEl) nomeUsuarioEl.textContent = usuario;
        linksAuth.forEach(l => l.style.display = 'none');
    }

    function mostrarDeslogado() {
        if (usuarioLogadoDiv) usuarioLogadoDiv.style.display = 'none';
        linksAuth.forEach(l => l.style.display = 'inline-block');
    }

    // Avisa os outros ficheiros (ex.: chat.js) de que a sessão mudou
    function avisarSessao() {
        window.dispatchEvent(new Event('ls:sessao'));
    }

    function iniciarSessao(conta) {
        localStorage.setItem('ls_sessao', conta.email);
        localStorage.setItem('ls_usuario', conta.email);   // usado pelo script.js e meus-produtos.js
        mostrarLogado(conta.usuario);
        fechar(modalEntrar);
        fechar(modalCadastro);
        avisarSessao();
    }

    // =====================================================
    // 7. INSCREVER-SE (criar conta)
    // =====================================================
    formCadastro.addEventListener('submit', async (e) => {
        e.preventDefault();
        erroCadastro.textContent = '';

        const email = document.getElementById('cad-email').value.trim().toLowerCase();
        const usuario = document.getElementById('cad-usuario').value.trim();
        const senha = document.getElementById('cad-senha').value;

        if (!emailValido(email)) {
            erroCadastro.textContent = 'Escreva um e-mail válido.';
            return;
        }
        if (!usuarioValido(usuario)) {
            erroCadastro.textContent = 'O nome de utilizador deve ter 3 a 20 caracteres (letras, números, _ ou .).';
            return;
        }
        if (senha.length < 6) {
            erroCadastro.textContent = 'A palavra-passe deve ter pelo menos 6 caracteres.';
            return;
        }

        const contas = lerContas();
        if (contas.some(c => c.email === email)) {
            erroCadastro.textContent = 'Este e-mail já tem uma conta. Clique em "Entrar".';
            return;
        }
        if (contas.some(c => c.usuario.toLowerCase() === usuario.toLowerCase())) {
            erroCadastro.textContent = 'Este nome de utilizador já está em uso. Escolha outro.';
            return;
        }

        const sal = Math.random().toString(36).slice(2) + Date.now().toString(36);
        const senhaHash = await gerarHash(senha, sal);
        const novaConta = { email, usuario, sal, senhaHash, criadoEm: Date.now() };

        contas.push(novaConta);
        guardarContas(contas);

        formCadastro.reset();
        atualizarForca();
        iniciarSessao(novaConta);
    });

    // =====================================================
    // 8. ENTRAR
    // =====================================================
    formEntrar.addEventListener('submit', async (e) => {
        e.preventDefault();
        erroEntrar.textContent = '';

        const id = document.getElementById('entrar-identificador').value.trim().toLowerCase();
        const senha = document.getElementById('entrar-senha').value;
        const contas = lerContas();

        if (contas.length === 0) {
            erroEntrar.textContent = 'Ainda não existe nenhuma conta. Clique em "Criar conta".';
            return;
        }

        const conta = contas.find(c => c.email === id || c.usuario.toLowerCase() === id);
        const hash = conta ? await gerarHash(senha, conta.sal) : '';

        if (!conta || hash !== conta.senhaHash) {
            erroEntrar.textContent = 'E-mail/utilizador ou palavra-passe incorretos.';
            return;
        }

        formEntrar.reset();
        iniciarSessao(conta);
    });

    // =====================================================
    // 9. SAIR (terminar sessão corretamente)
    // =====================================================
    ligar(btnSair, 'click', () => {
        localStorage.removeItem('ls_sessao');
        localStorage.removeItem('ls_usuario');
        mostrarDeslogado();
        avisarSessao();
    });

    // =====================================================
    // 10. AO ABRIR O SITE: voltar a entrar na conta guardada
    // =====================================================
    const emailSessao = localStorage.getItem('ls_sessao');
    const contaSessao = emailSessao ? lerContas().find(c => c.email === emailSessao) : null;

    if (contaSessao) {
        localStorage.setItem('ls_usuario', contaSessao.email);
        mostrarLogado(contaSessao.usuario);
    } else {
        localStorage.removeItem('ls_sessao');
        localStorage.removeItem('ls_usuario');
        mostrarDeslogado();
    }
});