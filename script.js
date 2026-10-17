// =========================================================
// LS SHOPPING - Contas (script.js)
//
// - Criar conta com CÓDIGO enviado por e-mail (confirma que o e-mail existe)
// - Entrar SÓ COM E-MAIL (o login por nome de utilizador está desativado)
//   (e pedir novo código se a conta ainda não foi confirmada)
// - "Esqueci a senha" com código por e-mail
// - Sair (com pergunta "Tem a certeza?")
//
// As janelas do código e da recuperação são criadas aqui dentro:
// não é preciso mexer no index.html nem no style.css.
//
// No Supabase: Authentication > Sign In / Providers > Email > "Confirm email" LIGADO,
// e os modelos "Confirm signup" e "Reset password" têm de mostrar {{ .Token }}.
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
        if (!el) throw new Error('script.js: não encontrei o elemento com id="' + id + '" no index.html');
        return el;
    }

    // Mostra um aviso bonito (aviso.js) ou, se não existir, o alert normal
    function notificar(mensagem, tipo) {
        if (window.avisar) window.avisar(mensagem, tipo);
        else alert(mensagem);
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

    // Login só com e-mail: ajusta o texto e o campo da janela "Entrar"
    // (assim não é preciso mexer no index.html)
    const rotuloEntrar = document.querySelector('label[for="entrar-identificador"]');
    if (rotuloEntrar) rotuloEntrar.textContent = 'E-mail';
    const campoEntrarEmail = document.getElementById('entrar-identificador');
    if (campoEntrarEmail) {
        campoEntrarEmail.type = 'email';
        campoEntrarEmail.placeholder = 'ex.: ana@gmail.com';
        campoEntrarEmail.setAttribute('autocomplete', 'email');
    }

    // =====================================================
    // 1B. JANELAS NOVAS (criadas aqui): código por e-mail e recuperar senha
    // =====================================================
    const estiloExtra = document.createElement('style');
    estiloExtra.textContent = `
        .auth-link-esqueci { display: block; text-align: right; margin: 6px 0 10px; font-size: 13px; }
        .auth-link-esqueci a, .auth-link-acao {
            color: #002780; font-weight: 600; cursor: pointer; text-decoration: none;
        }
        .auth-link-esqueci a:hover, .auth-link-acao:hover { text-decoration: underline; }
        .auth-link-acao.desativado { color: #94a3b8; pointer-events: none; }
        .input-codigo {
            text-align: center; font-size: 24px; letter-spacing: 6px; font-weight: 700;
        }
        .auth-info {
            font-size: 14px; color: #475569; line-height: 1.5;
            margin: 0 0 14px; word-break: break-word;
        }
    `;
    document.head.appendChild(estiloExtra);

    function criarModal(id, html) {
        const m = document.createElement('div');
        m.id = id;
        m.className = 'modal';
        m.style.display = 'none';
        m.innerHTML = html;
        document.body.appendChild(m);
        return m;
    }

    const modalCodigo = criarModal('modal-codigo', `
        <div class="conteudo-modal auth-caixa">
            <span class="fechar-modal" id="fechar-codigo">&times;</span>
            <div class="auth-topo">
                <div class="auth-marca">LS</div>
                <h2>Confirme o seu e-mail</h2>
                <p>Escreva o código que lhe enviámos.</p>
            </div>
            <div class="auth-corpo">
                <p class="auth-info" id="codigo-info"></p>
                <form id="form-codigo">
                    <label class="auth-label" for="cod-codigo">Código</label>
                    <input type="text" id="cod-codigo" class="input-codigo" inputmode="numeric"
                           autocomplete="one-time-code" maxlength="10" placeholder="000000" required>
                    <p class="auth-erro" id="erro-codigo"></p>
                    <button type="submit" class="btn-principal">Confirmar</button>
                </form>
                <p class="auth-troca">Não recebeu? <a href="#" class="auth-link-acao" id="reenviar-codigo">Reenviar código</a></p>
                <p class="auth-troca"><a href="#" class="auth-link-acao" id="codigo-voltar">Usar outro e-mail</a></p>
            </div>
        </div>
    `);

    const modalRecuperar = criarModal('modal-recuperar', `
        <div class="conteudo-modal auth-caixa">
            <span class="fechar-modal" id="fechar-recuperar">&times;</span>
            <div class="auth-topo">
                <div class="auth-marca">LS</div>
                <h2>Recuperar palavra-passe</h2>
                <p id="rec-sub">Enviamos um código para o seu e-mail.</p>
            </div>
            <div class="auth-corpo">
                <form id="form-rec-email">
                    <label class="auth-label" for="rec-email">E-mail da conta</label>
                    <input type="email" id="rec-email" placeholder="ex.: ana@gmail.com" autocomplete="email" required>
                    <p class="auth-erro" id="erro-rec-email"></p>
                    <button type="submit" class="btn-principal">Enviar código</button>
                </form>

                <form id="form-rec-nova" style="display: none;">
                    <p class="auth-info" id="rec-info"></p>

                    <label class="auth-label" for="rec-codigo">Código</label>
                    <input type="text" id="rec-codigo" class="input-codigo" inputmode="numeric"
                           autocomplete="one-time-code" maxlength="10" placeholder="000000" required>

                    <label class="auth-label" for="rec-senha">Nova palavra-passe</label>
                    <div class="campo-senha">
                        <input type="password" id="rec-senha" placeholder="Mínimo 6 caracteres" autocomplete="new-password" required>
                        <button type="button" class="btn-olho" aria-label="Mostrar palavra-passe"></button>
                    </div>

                    <label class="auth-label" for="rec-senha2">Repita a palavra-passe</label>
                    <div class="campo-senha">
                        <input type="password" id="rec-senha2" placeholder="Repita a nova palavra-passe" autocomplete="new-password" required>
                        <button type="button" class="btn-olho" aria-label="Mostrar palavra-passe"></button>
                    </div>

                    <p class="auth-erro" id="erro-rec-nova"></p>
                    <button type="submit" class="btn-principal">Guardar nova palavra-passe</button>
                    <p class="auth-troca">Não recebeu? <a href="#" class="auth-link-acao" id="rec-reenviar">Reenviar código</a></p>
                </form>

                <p class="auth-troca"><a href="#" class="auth-link-acao" id="rec-voltar">Voltar a Entrar</a></p>
            </div>
        </div>
    `);

    const formCodigo = document.getElementById('form-codigo');
    const inputCodigo = document.getElementById('cod-codigo');
    const erroCodigo = document.getElementById('erro-codigo');
    const infoCodigo = document.getElementById('codigo-info');
    const linkReenviarCodigo = document.getElementById('reenviar-codigo');
    const linkCodigoVoltar = document.getElementById('codigo-voltar');

    const formRecEmail = document.getElementById('form-rec-email');
    const formRecNova = document.getElementById('form-rec-nova');
    const inputRecEmail = document.getElementById('rec-email');
    const inputRecCodigo = document.getElementById('rec-codigo');
    const inputRecSenha = document.getElementById('rec-senha');
    const inputRecSenha2 = document.getElementById('rec-senha2');
    const erroRecEmail = document.getElementById('erro-rec-email');
    const erroRecNova = document.getElementById('erro-rec-nova');
    const infoRec = document.getElementById('rec-info');
    const subRec = document.getElementById('rec-sub');
    const linkRecReenviar = document.getElementById('rec-reenviar');
    const linkRecVoltar = document.getElementById('rec-voltar');

    // Link "Esqueci a senha" por baixo do campo da palavra-passe (janela Entrar)
    const campoSenhaEntrar = document.getElementById('entrar-senha');
    const blocoEsqueci = document.createElement('p');
    blocoEsqueci.className = 'auth-link-esqueci';
    blocoEsqueci.innerHTML = '<a href="#" id="ir-esqueci">Esqueci a senha</a>';
    const caixaSenhaEntrar = campoSenhaEntrar ? campoSenhaEntrar.closest('.campo-senha') : null;
    if (caixaSenhaEntrar) caixaSenhaEntrar.insertAdjacentElement('afterend', blocoEsqueci);
    else formEntrar.insertBefore(blocoEsqueci, erroEntrar);
    const irEsqueci = document.getElementById('ir-esqueci');

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
    // 4. ABRIR E FECHAR AS JANELAS
    // =====================================================
    const todasAsJanelas = [modalEntrar, modalCadastro, modalCodigo, modalRecuperar];

    function abrir(modal) { modal.style.display = 'flex'; }
    function fechar(modal) { modal.style.display = 'none'; }
    function fecharTodas() { todasAsJanelas.forEach(fechar); }

    function abrirEntrar() {
        fecharTodas();
        erroEntrar.textContent = '';
        esconderSenhas();
        abrir(modalEntrar);
        setTimeout(() => {
            const campo = document.getElementById('entrar-identificador');
            if (campo) campo.focus();
        }, 50);
    }

    function abrirCadastro() {
        fecharTodas();
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

    // Fechar cada janela (botão X e clique fora)
    ligar(btnFecharAuth, 'click', () => fechar(modalEntrar));
    ligar(btnFecharCadastro, 'click', () => fechar(modalCadastro));
    ligar(document.getElementById('fechar-codigo'), 'click', () => fechar(modalCodigo));
    ligar(document.getElementById('fechar-recuperar'), 'click', () => fechar(modalRecuperar));

    todasAsJanelas.forEach((modal) => {
        ligar(modal, 'click', (e) => {
            if (e.target === modal) fechar(modal);
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') fecharTodas();
    });

    function emailValido(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    }

    function usuarioValido(usuario) {
        return /^[a-zA-Z0-9_.]{3,20}$/.test(usuario);
    }

    // Só números no campo do código
    [inputCodigo, inputRecCodigo].forEach((campo) => {
        ligar(campo, 'input', () => { campo.value = campo.value.replace(/\D/g, ''); });
    });

    // Traduz as mensagens de erro do Supabase
    function traduzirErro(msg) {
        const m = String(msg || '').toLowerCase();
        if (/rate limit|too many|only request this after|for security purposes/.test(m)) {
            return 'Pediu demasiadas vezes. Espere um minuto e tente outra vez.';
        }
        if (/(token|otp|code)/.test(m) && /(expired|invalid)/.test(m)) {
            return 'Código incorreto ou expirado. Peça um novo código.';
        }
        if (/same|different from the old/.test(m)) {
            return 'A nova palavra-passe tem de ser diferente da antiga.';
        }
        if (/at least|too short|weak/.test(m)) {
            return 'A palavra-passe é demasiado fraca. Use pelo menos 6 caracteres.';
        }
        if (/already registered|already been registered/.test(m)) {
            return 'Este e-mail já tem conta. Clique em "Entrar".';
        }
        if (/network|failed to fetch/.test(m)) {
            return 'Sem ligação à internet. Tente outra vez.';
        }
        console.error('script.js: erro do Supabase:', msg);
        return 'Não foi possível concluir. Tente outra vez.';
    }

    // "Reenviar código (45s)": bloqueia o link durante alguns segundos
    function iniciarEspera(link, segundos) {
        if (!link) return;
        if (!link.dataset.texto) link.dataset.texto = link.textContent;
        clearInterval(link._timer);
        let resta = segundos;
        link.classList.add('desativado');
        link.textContent = link.dataset.texto + ' (' + resta + 's)';
        link._timer = setInterval(() => {
            resta--;
            if (resta <= 0) {
                clearInterval(link._timer);
                link.classList.remove('desativado');
                link.textContent = link.dataset.texto;
            } else {
                link.textContent = link.dataset.texto + ' (' + resta + 's)';
            }
        }, 1000);
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

    function iniciarSessao(email, usuario) {
        localStorage.setItem('ls_sessao', email);
        localStorage.setItem('ls_usuario', email); // usado pelo script.js e meus-produtos.js
        mostrarLogado(usuario);
        fecharTodas();
        avisarSessao();
    }

    // =====================================================
    // 7. INSCREVER-SE (criar conta + código por e-mail)
    // =====================================================
    let emailPendente = '';   // e-mail que está a confirmar o código

    function abrirCodigo(email) {
        emailPendente = email;
        fecharTodas();
        erroCodigo.textContent = '';
        inputCodigo.value = '';
        infoCodigo.textContent = 'Enviámos um código para ' + email + '. Veja a caixa de entrada (e o spam).';
        abrir(modalCodigo);
        iniciarEspera(linkReenviarCodigo, 60);
        setTimeout(() => inputCodigo.focus(), 50);
    }

    formCadastro.addEventListener('submit', async (e) => {
        e.preventDefault();
        erroCadastro.textContent = '';
        if (!supabaseClient) return;

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

        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: senha,
            options: {
                data: { nome: usuario }
            }
        });

        if (error) {
            erroCadastro.textContent = traduzirErro(error.message);
            return;
        }

        // E-mail que já tem conta confirmada: o Supabase devolve um utilizador sem "identities"
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
            erroCadastro.textContent = 'Este e-mail já tem conta. Clique em "Entrar".';
            return;
        }

        // Sem sessão = falta confirmar o e-mail com o código
        if (!data.session) {
            formCadastro.reset();
            atualizarForca();
            abrirCodigo(email);
            return;
        }

        // (Se a confirmação por e-mail estiver desligada no Supabase, entra logo)
        if (data.user) {
            await supabaseClient.from('profiles').upsert({
                id: data.user.id,
                nome: usuario
            });
        }

        formCadastro.reset();
        atualizarForca();
        iniciarSessao(email, usuario);
        notificar('Conta criada com sucesso!', 'ok');
    });

    // Confirmar o código recebido por e-mail
    ligar(formCodigo, 'submit', async (e) => {
        e.preventDefault();
        erroCodigo.textContent = '';
        if (!supabaseClient || !emailPendente) return;

        const token = inputCodigo.value.replace(/\D/g, '');
        if (token.length < 6) {
            erroCodigo.textContent = 'Escreva o código que recebeu por e-mail (só números).';
            return;
        }

        const { data, error } = await supabaseClient.auth.verifyOtp({
            email: emailPendente,
            token: token,
            type: 'signup'
        });

        if (error) {
            erroCodigo.textContent = traduzirErro(error.message);
            return;
        }

        if (data.session && data.user) {
            const nome = (data.user.user_metadata && data.user.user_metadata.nome) || emailPendente.split('@')[0];
            await supabaseClient.from('profiles').upsert({
                id: data.user.id,
                nome: nome
            });
            const email = emailPendente;
            emailPendente = '';
            iniciarSessao(email, nome);
            notificar('Conta criada com sucesso! Bem-vindo, ' + nome + '!', 'ok');
        }
    });

    // Reenviar o código de confirmação
    ligar(linkReenviarCodigo, 'click', async (e) => {
        e.preventDefault();
        if (linkReenviarCodigo.classList.contains('desativado')) return;
        if (!supabaseClient || !emailPendente) return;
        erroCodigo.textContent = '';

        const { error } = await supabaseClient.auth.resend({ type: 'signup', email: emailPendente });
        if (error) {
            erroCodigo.textContent = traduzirErro(error.message);
            return;
        }
        iniciarEspera(linkReenviarCodigo, 60);
        notificar('Enviámos um novo código para ' + emailPendente + '.', 'ok');
    });

    ligar(linkCodigoVoltar, 'click', (e) => { e.preventDefault(); abrirCadastro(); });

    // =====================================================
    // 8. ENTRAR (Autenticação no Supabase) - SÓ COM E-MAIL
    // =====================================================
    formEntrar.addEventListener('submit', async (e) => {
        e.preventDefault();
        erroEntrar.textContent = '';
        if (!supabaseClient) return;

        const emailParaLogin = document.getElementById('entrar-identificador').value.trim().toLowerCase();
        const senha = document.getElementById('entrar-senha').value;

        // O login por nome de utilizador está desativado: só se entra com o e-mail
        if (!emailValido(emailParaLogin)) {
            erroEntrar.textContent = 'Escreva o e-mail da sua conta.';
            return;
        }

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: emailParaLogin,
            password: senha
        });

        if (error) {
            // Conta criada mas o e-mail ainda não foi confirmado: manda um código novo
            if (/not confirmed/i.test(error.message)) {
                await supabaseClient.auth.resend({ type: 'signup', email: emailParaLogin });
                formEntrar.reset();
                abrirCodigo(emailParaLogin);
                notificar('Ainda não confirmou o e-mail. Enviámos-lhe um código.', 'aviso');
                return;
            }
            erroEntrar.textContent = 'E-mail ou palavra-passe incorretos.';
            return;
        }

        if (data.session) {
            const emailUser = data.session.user.email;
            const nomeUser = data.session.user.user_metadata?.nome || emailUser.split('@')[0];

            formEntrar.reset();
            iniciarSessao(emailUser, nomeUser);
            notificar('Bem-vindo, ' + nomeUser + '!', 'ok');
        }
    });

    // =====================================================
    // 8B. ESQUECI A SENHA (código por e-mail + nova palavra-passe)
    // =====================================================
    let emailRecuperar = '';

    function abrirRecuperar(emailInicial) {
        fecharTodas();
        emailRecuperar = '';
        erroRecEmail.textContent = '';
        erroRecNova.textContent = '';
        formRecEmail.reset();
        formRecNova.reset();
        formRecNova.style.display = 'none';
        formRecEmail.style.display = 'block';
        subRec.textContent = 'Enviamos um código para o seu e-mail.';
        esconderSenhas();
        if (emailInicial && emailValido(emailInicial)) inputRecEmail.value = emailInicial;
        abrir(modalRecuperar);
        setTimeout(() => inputRecEmail.focus(), 50);
    }

    ligar(irEsqueci, 'click', (e) => {
        e.preventDefault();
        const escrito = document.getElementById('entrar-identificador').value.trim().toLowerCase();
        abrirRecuperar(escrito);
    });

    ligar(linkRecVoltar, 'click', (e) => { e.preventDefault(); abrirEntrar(); });

    // Passo 1: pedir o código
    ligar(formRecEmail, 'submit', async (e) => {
        e.preventDefault();
        erroRecEmail.textContent = '';
        if (!supabaseClient) return;

        const email = inputRecEmail.value.trim().toLowerCase();
        if (!emailValido(email)) {
            erroRecEmail.textContent = 'Escreva um e-mail válido.';
            return;
        }

        const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
        if (error) {
            erroRecEmail.textContent = traduzirErro(error.message);
            return;
        }

        // Resposta igual exista a conta ou não (não revela quem tem conta)
        emailRecuperar = email;
        infoRec.textContent = 'Se existir uma conta com ' + email + ', enviámos um código. Escreva-o abaixo e escolha a nova palavra-passe.';
        subRec.textContent = 'Escreva o código e a nova palavra-passe.';
        formRecEmail.style.display = 'none';
        formRecNova.style.display = 'block';
        iniciarEspera(linkRecReenviar, 60);
        setTimeout(() => inputRecCodigo.focus(), 50);
    });

    // Passo 2: confirmar o código e guardar a nova palavra-passe
    ligar(formRecNova, 'submit', async (e) => {
        e.preventDefault();
        erroRecNova.textContent = '';
        if (!supabaseClient || !emailRecuperar) return;

        const token = inputRecCodigo.value.replace(/\D/g, '');
        const senha = inputRecSenha.value;
        const senha2 = inputRecSenha2.value;

        if (token.length < 6) {
            erroRecNova.textContent = 'Escreva o código que recebeu por e-mail (só números).';
            return;
        }
        if (senha.length < 6) {
            erroRecNova.textContent = 'A palavra-passe deve ter pelo menos 6 caracteres.';
            return;
        }
        if (senha !== senha2) {
            erroRecNova.textContent = 'As duas palavras-passe não são iguais.';
            return;
        }

        const { data: dadosCodigo, error: erroCod } = await supabaseClient.auth.verifyOtp({
            email: emailRecuperar,
            token: token,
            type: 'recovery'
        });

        if (erroCod) {
            erroRecNova.textContent = traduzirErro(erroCod.message);
            return;
        }

        const { error: erroSenha } = await supabaseClient.auth.updateUser({ password: senha });

        if (erroSenha) {
            // O código já foi gasto: termina a sessão de recuperação e pede um código novo
            await supabaseClient.auth.signOut();
            erroRecNova.textContent = traduzirErro(erroSenha.message) + ' Peça um novo código.';
            return;
        }

        const utilizador = dadosCodigo && dadosCodigo.user;
        const email = emailRecuperar;
        const nome = (utilizador && utilizador.user_metadata && utilizador.user_metadata.nome) || email.split('@')[0];

        emailRecuperar = '';
        formRecNova.reset();
        iniciarSessao(email, nome);
        notificar('Palavra-passe alterada com sucesso!', 'ok');
    });

    // Reenviar o código de recuperação
    ligar(linkRecReenviar, 'click', async (e) => {
        e.preventDefault();
        if (linkRecReenviar.classList.contains('desativado')) return;
        if (!supabaseClient || !emailRecuperar) return;
        erroRecNova.textContent = '';

        const { error } = await supabaseClient.auth.resetPasswordForEmail(emailRecuperar);
        if (error) {
            erroRecNova.textContent = traduzirErro(error.message);
            return;
        }
        iniciarEspera(linkRecReenviar, 60);
        notificar('Enviámos um novo código.', 'ok');
    });

    // =====================================================
    // 9. SAIR (terminar sessão corretamente)
    // =====================================================
    async function terminarSessao() {
        if (supabaseClient) {
            await supabaseClient.auth.signOut();
        }
        localStorage.removeItem('ls_sessao');
        localStorage.removeItem('ls_usuario');
        mostrarDeslogado();
        avisarSessao();
        notificar('Sessão terminada.', 'info');
    }

    // Antes de sair, pergunta se a pessoa tem a certeza
    async function perguntarESair() {
        const pergunta = 'Tem a certeza de que quer sair da sua conta?';
        const confirmado = window.confirmar
            ? await window.confirmar(pergunta, { titulo: 'Sair da conta', sim: 'Sim', nao: 'Não', destaque: 'nao' })
            : confirm(pergunta);

        if (confirmado) await terminarSessao();
    }

    ligar(btnSair, 'click', perguntarESair);

    // A opção "Sair" do menu lateral também pergunta primeiro
    document.addEventListener('click', (e) => {
        const itemSair = e.target && e.target.closest ? e.target.closest('#menu-lateral [data-acao="sair"]') : null;
        if (!itemSair || !localStorage.getItem('ls_sessao')) return;

        e.preventDefault();
        e.stopImmediatePropagation();

        const fecharMenu = document.getElementById('fechar-menu');
        if (fecharMenu) fecharMenu.click();

        perguntarESair();
    }, true);

    // =====================================================
    // 10. AO ABRIR O SITE: verificar sessão ativa no Supabase
    // =====================================================
    async function verificarSessaoInicial() {
        if (!supabaseClient) return;

        const { data: { session } } = await supabaseClient.auth.getSession();

        if (session && session.user) {
            const emailUser = session.user.email;
            const nomeUser = session.user.user_metadata?.nome || emailUser.split('@')[0];

            localStorage.setItem('ls_sessao', emailUser);
            localStorage.setItem('ls_usuario', emailUser);
            mostrarLogado(nomeUser);
        } else {
            localStorage.removeItem('ls_sessao');
            localStorage.removeItem('ls_usuario');
            mostrarDeslogado();
        }
    }

    verificarSessaoInicial();
});