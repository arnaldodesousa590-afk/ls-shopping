// =========================================================
// LS SHOPPING - Loja / Vitrine principal (loja.js)
// Versão Profissional: Cor exata #002780 e integração Supabase
// =========================================================

const supabaseLoja = window.supabaseLS;

document.addEventListener('DOMContentLoaded', () => {

    // 1. SELETORES DO HTML REAL
    const gridProdutos = document.getElementById('grid-produtos');
    const inputPesquisa = document.getElementById('input-pequisar');
    const btnPesquisar = document.getElementById('btn-pesquisar');
    const btnVoltarInicio = document.getElementById('btn-voltar-inicio');
    const infoResultados = document.getElementById('info-resultados');
    const tituloVitrine = document.getElementById('titulo-vitrine');

    const modalProduto = document.getElementById('modal-produto');
    const btnAbrirPublicar = document.getElementById('btn-abrir-publicar');
    const btnFecharProduto = document.getElementById('fechar-produto');
    const formCadastrar = document.getElementById('form-cadastrar-produtos');
    
    const inputNome = document.getElementById('prod-nome');
    const inputCategoria = document.getElementById('prod-categoria');
    const inputPreco = document.getElementById('prod-preco');
    const inputUnidades = document.getElementById('prod-unidades');
    const inputContacto = document.getElementById('prod-contacto');
    const inputDescricao = document.getElementById('prod-descricao');
    const inputImagem = document.getElementById('prod-imagem');
    const previaFotos = document.getElementById('previa-fotos');

    let categoriaAtual = '';
    let termoPesquisa = '';
    let imagensTemp = [];

    // COR PROFISSIONAL DEFINIDA PELO KING (#002780)
    const COR_AZUL_PADRAO = '#002780';

    // 2. LER PRODUTOS DO SUPABASE
    async function lerProdutos() {
        if (!supabaseLoja) return [];
        const { data, error } = await supabaseLoja
            .from('produtos')
            .select('*')
            .order('criado_em', { ascending: false });

        if (error || !data) return [];

        const agora = Date.now();
        const listaMapeada = data.map(p => ({
            id: p.id,
            dono: p.user_id,
            donoNome: p.dono_nome || '',
            nome: p.titulo || p.nome,
            categoria: p.categoria,
            preco: Number(p.preco),
            unidades: Number(p.unidades ?? 1),
            contacto: p.contacto || '',
            descricao: p.descricao,
            imagens: p.imagens || [p.imagem_url || p.imagem || 'ls.png'],
            imagem: p.imagem_url || p.imagem || 'ls.png',
            vendido: p.vendido || false,
            criadoEm: p.criado_em ? new Date(p.criado_em).getTime() : agora,
            expiraEm: p.criado_em ? new Date(p.criado_em).getTime() + (30 * 24 * 60 * 60 * 1000) : agora + (30 * 24 * 60 * 60 * 1000)
        }));

        return listaMapeada.filter(p => !p.vendido && (!p.expiraEm || p.expiraEm > agora));
    }

    // 3. RENDERIZAR A VITRINE
    async function renderizarVitrine() {
        if (!gridProdutos) return;

        gridProdutos.innerHTML = `
            <div style="grid-column: 1 / -1; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 50px 20px; color: #64748b; font-size: 14px;">
                <span class="ls-spinner ls-spinner-escuro"></span> A carregar produtos...
            </div>
        `;

        let produtos = await lerProdutos();
        let temFiltroAtivo = false;

        // Filtro por Categoria
        if (categoriaAtual) {
            const catAlvo = categoriaAtual.trim().toLowerCase();
            produtos = produtos.filter(p => p.categoria && p.categoria.trim().toLowerCase() === catAlvo);
            if (tituloVitrine) tituloVitrine.textContent = 'Categoria: ' + categoriaAtual;
            temFiltroAtivo = true;
        } else {
            if (tituloVitrine) tituloVitrine.textContent = 'Produtos Disponíveis';
        }

        // Filtro por Pesquisa (Acionado por Botão ou Enter)
        if (termoPesquisa) {
            const termo = termoPesquisa.trim().toLowerCase();
            produtos = produtos.filter(p => 
                (p.nome && p.nome.toLowerCase().includes(termo)) ||
                (p.descricao && p.descricao.toLowerCase().includes(termo)) ||
                (p.categoria && p.categoria.toLowerCase().includes(termo))
            );
            if (infoResultados) infoResultados.textContent = `Resultados para "${termoPesquisa}" (${produtos.length})`;
            temFiltroAtivo = true;
        } else {
            if (infoResultados) infoResultados.textContent = '';
        }

        if (btnVoltarInicio) {
            btnVoltarInicio.style.display = temFiltroAtivo ? 'inline-flex' : 'none';
        }

        gridProdutos.innerHTML = '';

        if (produtos.length === 0) {
            gridProdutos.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; color: #666;">
                    <p style="font-size: 16px; font-weight: 500;">Nenhum produto encontrado.</p>
                    <p style="font-size: 13px; margin-top: 5px; color: #888;">Tente pesquisar por outro termo ou limpar os filtros.</p>
                </div>
            `;
            return;
        }

        produtos.forEach(p => {
            const capa = (p.imagens && p.imagens.length > 0) ? p.imagens[0] : (p.imagem || 'ls.png');
            const cartao = document.createElement('div');
            cartao.className = 'produto-card';
            cartao.style.cssText = 'background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.06); display: flex; flex-direction: column; border: 1px solid #e2e8f0;';
            
            const descTexto = p.descricao || 'Sem descrição informada.';
            const precisaVerMais = descTexto.length > 45;
            const unidadesTexto = p.unidades > 0
                ? 'Quantidade disponível: ' + p.unidades
                : 'Esgotado';
            const unidadesCor = p.unidades > 0 ? '#64748b' : '#c62828';

            cartao.innerHTML = `
                <div style="position: relative; width: 100%; height: 195px; background: #f8fafc; overflow: hidden;">
                    <img src="${capa}" alt="${p.nome}" data-galeria="${p.id}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;">
                    <span style="position: absolute; top: 10px; right: 10px; background: rgba(15, 23, 42, 0.75); color: #fff; font-size: 10px; padding: 4px 8px; border-radius: 4px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">${p.categoria}</span>
                </div>
                <div style="padding: 16px; display: flex; flex-direction: column; flex-grow: 1;">
                    <h3 style="font-size: 16px; font-weight: 600; color: #0f172a; margin: 0 0 6px 0; line-height: 1.3;">${p.nome}</h3>
                    <strong style="font-size: 18px; color: #000000; margin-bottom: 4px; display: block; font-weight: 700;">${Number(p.preco).toLocaleString('pt-AO')} Kz</strong>
                    <span style="font-size: 12px; color: ${unidadesCor}; margin-bottom: 10px; display: block; font-weight: 600;">${unidadesTexto}</span>
                    
                    <div style="margin-bottom: 12px; flex-grow: 1;">
                        <p class="desc-curta" style="font-size: 13px; color: #475569; margin: 0; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${descTexto}</p>
                        <p class="desc-completa" style="font-size: 13px; color: #475569; margin: 0; line-height: 1.4; display: none;">${descTexto}</p>
                        ${precisaVerMais ? `<button type="button" class="btn-toggle-desc" style="background: none; border: none; color: ${COR_AZUL_PADRAO}; font-size: 12px; padding: 0; margin-top: 4px; cursor: pointer; font-weight: 600;">Ver mais</button>` : ''}
                    </div>

                    <div style="font-size: 12px; color: #64748b; margin-bottom: 14px; border-top: 1px solid #f1f5f9; padding-top: 8px;">
                        <strong>Contacto:</strong> ${p.contacto || 'Não informado'}
                    </div>

                    <button type="button" class="btn-contacto-prod" style="width: 100%; padding: 11px; background: ${COR_AZUL_PADRAO}; color: #fff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px; transition: opacity 0.2s;">Contactar Vendedor</button>
                </div>
            `;

            if (precisaVerMais) {
                const btnToggle = cartao.querySelector('.btn-toggle-desc');
                const descCurta = cartao.querySelector('.desc-curta');
                const descCompleta = cartao.querySelector('.desc-completa');

                btnToggle.addEventListener('click', () => {
                    const expandido = descCompleta.style.display === 'block';
                    if (expandido) {
                        descCompleta.style.display = 'none';
                        descCurta.style.display = 'block';
                        btnToggle.textContent = 'Ver mais';
                    } else {
                        descCurta.style.display = 'none';
                        descCompleta.style.display = 'block';
                        btnToggle.textContent = 'Ver menos';
                    }
                });
            }

            cartao.querySelector('.btn-contacto-prod').addEventListener('click', () => {
                abrirOpcoesContacto(p);
            });

            gridProdutos.appendChild(cartao);
        });
    }

    window.recarregarVitrine = function() {
        renderizarVitrine();
    };

    // 4. MODAL DE CONTACTO
    function abrirOpcoesContacto(produto) {
        const modalAntigo = document.getElementById('modal-contacto-rapido');
        if (modalAntigo) modalAntigo.remove();

        const logado = !!localStorage.getItem('ls_sessao');

        const modalDiv = document.createElement('div');
        modalDiv.id = 'modal-contacto-rapido';
        modalDiv.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 9999;';
        
        modalDiv.innerHTML = `
            <div style="background: #fff; border-radius: 12px; width: 90%; max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); overflow: hidden; position: relative;">
                <div style="background: #f8fafc; padding: 18px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                    <strong style="font-size: 16px; color: #0f172a;">LS SHOPPING</strong>
                    <button type="button" id="fechar-modal-contacto" style="background: none; border: none; font-size: 22px; cursor: pointer; color: #64748b; line-height: 1;">&times;</button>
                </div>

                <div style="padding: 22px 20px; text-align: center;">
                    <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 17px; font-weight: 600;">Contactar Vendedor</h3>
                    <p style="font-size: 14px; color: #475569; margin: 0 0 20px 0; line-height: 1.4;">Escolha o canal para conversar sobre<br><strong style="color: #0f172a;">${produto.nome}</strong></p>
                    
                    <button id="btn-whats-direto" class="btn-modal-acao" style="width: 100%; padding: 12px; background: #fff; color: ${COR_AZUL_PADRAO}; border: 2px solid ${COR_AZUL_PADRAO}; border-radius: 6px; font-weight: 600; cursor: pointer; margin-bottom: 12px; font-size: 14px; transition: all 0.2s;">Falar pelo WhatsApp</button>
                    
                    <button id="btn-chat-site" class="btn-modal-acao" style="width: 100%; padding: 12px; background: #fff; color: ${logado ? COR_AZUL_PADRAO : '#cbd5e1'}; border: 2px solid ${logado ? COR_AZUL_PADRAO : '#cbd5e1'}; border-radius: 6px; font-weight: 600; cursor: ${logado ? 'pointer' : 'not-allowed'}; font-size: 14px; transition: all 0.2s;" ${!logado ? 'title="Inicie sessão para usar o chat no site"' : ''}>${logado ? 'Falar no Site (Chat)' : 'Falar no Site (Login necessário)'}</button>
                </div>
            </div>
        `;

        document.body.appendChild(modalDiv);

        modalDiv.querySelectorAll('.btn-modal-acao').forEach(btn => {
            if (btn.style.cursor !== 'not-allowed') {
                btn.addEventListener('mouseenter', () => {
                    btn.style.background = COR_AZUL_PADRAO;
                    btn.style.color = '#fff';
                });
                btn.addEventListener('mouseleave', () => {
                    btn.style.background = '#fff';
                    btn.style.color = COR_AZUL_PADRAO;
                });
            }
        });

        modalDiv.querySelector('#fechar-modal-contacto').addEventListener('click', () => modalDiv.remove());
        modalDiv.addEventListener('click', (e) => { if (e.target === modalDiv) modalDiv.remove(); });

        modalDiv.querySelector('#btn-whats-direto').addEventListener('click', () => {
            if (!produto.contacto) {
                alert('Este vendedor não disponibilizou um número de contacto.');
                return;
            }
            const numLimpo = produto.contacto.replace(/\D/g, '');
            const msg = encodeURIComponent(`Olá! Vi o seu anúncio "${produto.nome}" na LS SHOPPING e tenho interesse.`);
            window.open(`https://wa.me/${numLimpo}?text=${msg}`, '_blank');
            modalDiv.remove();
        });

        modalDiv.querySelector('#btn-chat-site').addEventListener('click', () => {
            if (!logado) {
                alert('Precisa de iniciar sessão para conversar pelo chat do site.');
                const btnLogin = document.getElementById('btn-abrir-login');
                if (btnLogin) {
                    modalDiv.remove();
                    btnLogin.click();
                }
                return;
            }
            modalDiv.remove();
            
            const abrirChat = window.abrirChatComVendedor || window.abrirContacto;
            if (abrirChat) {
                abrirChat(produto);
            } else {
                const btnChat = document.getElementById('btn-abrir-chat');
                if (btnChat) btnChat.click();
            }
        });
    }

    // 5. PESQUISA
    if (btnPesquisar) {
        btnPesquisar.addEventListener('click', () => {
            if (inputPesquisa) {
                termoPesquisa = inputPesquisa.value;
                categoriaAtual = '';
                renderizarVitrine();
            }
        });
    }

    if (inputPesquisa) {
        inputPesquisa.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                termoPesquisa = inputPesquisa.value;
                categoriaAtual = '';
                renderizarVitrine();
            }
        });
    }

    // 6. FILTRO DE CATEGORIAS
    document.querySelectorAll('.categorias a, #menu-lateral [data-categoria]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const cat = link.dataset.categoria || link.textContent.trim();
            categoriaAtual = (cat.toLowerCase() === 'início' || cat.toLowerCase() === 'todos') ? '' : cat;
            termoPesquisa = '';
            if (inputPesquisa) inputPesquisa.value = '';
            
            document.querySelectorAll('.categorias a, #menu-lateral [data-categoria]').forEach(l => l.classList.remove('ativa'));
            link.classList.add('ativa');

            renderizarVitrine();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    if (btnVoltarInicio) {
        btnVoltarInicio.addEventListener('click', () => {
            categoriaAtual = '';
            termoPesquisa = '';
            if (inputPesquisa) inputPesquisa.value = '';
            document.querySelectorAll('.categorias a, #menu-lateral [data-categoria]').forEach(l => l.classList.remove('ativa'));
            renderizarVitrine();
        });
    }

    // 7. MODAL DE PUBLICAR PRODUTO
    function abrirModalPublicar() {
        const usuario = localStorage.getItem('ls_sessao');
        if (!usuario) {
            const btnLogin = document.getElementById('btn-abrir-login');
            if (btnLogin) {
                btnLogin.click();
            } else {
                alert('Precisa de iniciar sessão para publicar um anúncio.');
            }
            return;
        }
        if (modalProduto) {
            modalProduto.style.display = 'flex';
        }
    }

    function fecharModalPublicar() {
        if (modalProduto) modalProduto.style.display = 'none';
        if (formCadastrar) formCadastrar.reset();
        imagensTemp = [];
        if (previaFotos) previaFotos.innerHTML = '';
    }

    if (btnAbrirPublicar) {
        btnAbrirPublicar.addEventListener('click', (e) => {
            e.preventDefault();
            abrirModalPublicar();
        });
    }

    const menuAnunciar = document.querySelector('#menu-lateral [data-acao="anunciar"]');
    if (menuAnunciar) {
        menuAnunciar.addEventListener('click', (e) => {
            e.preventDefault();
            abrirModalPublicar();
        });
    }

    if (btnFecharProduto) {
        btnFecharProduto.addEventListener('click', fecharModalPublicar);
    }

    if (modalProduto) {
        modalProduto.addEventListener('click', (e) => {
            if (e.target === modalProduto) fecharModalPublicar();
        });
    }

    if (inputImagem) {
        inputImagem.addEventListener('change', (e) => {
            const ficheiros = Array.from(e.target.files).slice(0, 6);
            imagensTemp = [];
            if (previaFotos) previaFotos.innerHTML = '';

            ficheiros.forEach(fich => {
                const leitor = new FileReader();
                leitor.onload = (evento) => {
                    imagensTemp.push(evento.target.result);
                    const imgPreview = document.createElement('img');
                    imgPreview.src = evento.target.result;
                    imgPreview.style.cssText = 'width: 60px; height: 60px; object-fit: cover; border-radius: 4px; margin-right: 5px; border: 1px solid #ddd;';
                    if (previaFotos) previaFotos.appendChild(imgPreview);
                };
                leitor.readAsDataURL(fich);
            });
        });
    }

    if (formCadastrar) {
        formCadastrar.addEventListener('submit', async (e) => {
            e.preventDefault();

            const usuario = localStorage.getItem('ls_sessao');
            if (!usuario) {
                alert('Sessão expirada. Inicie sessão novamente.');
                return;
            }

            const fotosFinais = (window.fotosProduto && window.fotosProduto.length > 0) ? window.fotosProduto : imagensTemp;

            if (fotosFinais.length === 0) {
                alert('Por favor, adicione pelo menos uma foto do produto.');
                return;
            }

            const nome = inputNome ? inputNome.value.trim() : '';
            const categoria = inputCategoria ? inputCategoria.value : '';
            const preco = inputPreco ? Number(inputPreco.value) : 0;
            const unidades = inputUnidades ? Number(inputUnidades.value) : 1;
            const contacto = inputContacto ? inputContacto.value.trim() : '';
            const descricao = inputDescricao ? inputDescricao.value.trim() : '';

            if (!nome || !categoria || isNaN(preco) || !contacto || !descricao) {
                alert('Preencha todos os campos obrigatórios.');
                return;
            }

            let userId = null;
            let userNome = '';
            if (supabaseLoja) {
                const { data: { session } } = await supabaseLoja.auth.getSession();
                if (session && session.user) {
                    userId = session.user.id;
                    userNome = (session.user.user_metadata && session.user.user_metadata.nome)
                        || String(session.user.email || '').split('@')[0];
                }
                if (!userId) {
                    alert('A sua sessão terminou. Saia e entre outra vez para publicar.');
                    return;
                }
            }

            const novoRegistoSupabase = {
                user_id: userId,
                dono_nome: userNome,
                titulo: nome,
                categoria: categoria,
                preco: preco,
                unidades: unidades,
                contacto: contacto,
                descricao: descricao,
                imagem_url: fotosFinais[0],
                imagens: fotosFinais,
                vendido: false
            };

            if (supabaseLoja) {
                const { error } = await supabaseLoja
                    .from('produtos')
                    .insert([novoRegistoSupabase]);

                if (error) {
                    alert('Erro ao publicar no Supabase: ' + error.message);
                    return;
                }
            }

            fecharModalPublicar();
            if (window.limparFotosProduto) window.limparFotosProduto();
            await renderizarVitrine();
            alert('Produto publicado com sucesso!');
        });
    }

    renderizarVitrine();
});