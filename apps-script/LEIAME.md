# Serviço de reservas do LabSEL

Este é o "backend" do formulário de reserva do site do GSEL. Ele roda de graça no **Google Apps Script**, na conta Google do grupo, e faz o que o site sozinho (GitHub Pages) não consegue: enviar e-mails e guardar as solicitações.

## Como funciona

1. O visitante preenche o formulário no site e informa o e-mail.
2. O serviço registra a solicitação numa planilha e envia ao visitante um **link para confirmar o e-mail** (válido por 24 horas).
3. Só depois da confirmação o pedido chega ao **gsel@garanhuns.ifpe.edu.br**, com os botões **Autorizar** e **Recusar**.
4. Quem atende o e-mail do GSEL clica em um dos botões, pode escrever uma mensagem (por exemplo, horário e instruções) e confirma.
5. O solicitante recebe **automaticamente** um e-mail dizendo se a reserva foi autorizada, com a mensagem do GSEL.

Todas as solicitações ficam na planilha **"Reservas do LabSEL (site do GSEL)"**, criada no Google Drive da conta que instalar o serviço, com a situação de cada uma: aguardando verificação, aguardando autorização, autorizada, não autorizada ou verificação expirada.

## Instalação (uma vez, cerca de 10 minutos)

Use, de preferência, a conta **gsel@garanhuns.ifpe.edu.br**. Assim os e-mails saem desse endereço e a planilha fica com o grupo.

1. Entre em <https://script.google.com> com a conta do GSEL e clique em **Novo projeto**.
2. Clique em "Projeto sem título" e renomeie para **Reservas LabSEL**.
3. Apague todo o conteúdo do arquivo `Código.gs` e cole o conteúdo de [`Codigo.gs`](Codigo.gs), desta pasta. Salve com **Ctrl + S**.
4. Confira o bloco `CONFIG`, no início do código: e-mail do GSEL, endereço do site, prazo do link e equipamentos.
5. Na barra de cima, escolha a função **`configurar`** e clique em **Executar**. O Google vai pedir autorização:
   **Revisar permissões** → escolha a conta → se aparecer "O Google não verificou este app", clique em **Avançado** → **Acessar Reservas LabSEL** → **Permitir**.
   O serviço pede para enviar e-mails e para criar e editar planilhas. Ao terminar, o "Registro de execução" mostra o link da planilha criada.
6. Clique em **Implantar** → **Nova implantação** → no ícone de engrenagem, escolha **App da Web**:
   - Descrição: `Reservas do site`
   - Executar como: **Eu** (a conta do GSEL)
   - Quem pode acessar: **Qualquer pessoa**

   Clique em **Implantar** e copie a **URL do app da Web**, que termina em `/exec`.
7. No `index.html` do site, cole essa URL no atributo `data-endpoint=""` do formulário `form-reserva`:

   ```html
   <form class="booking-form" id="form-reserva" data-endpoint="https://script.google.com/macros/s/.../exec" ...>
   ```

   Depois faça commit e push. Em um ou dois minutos o site passa a usar o serviço.

Enquanto `data-endpoint` estiver vazio, o site continua funcionando no modo simples: monta a mensagem e abre o aplicativo de e-mail do visitante, sem verificação nem resposta automática.

## Testar

Faça uma solicitação pelo site usando um e-mail pessoal e confira:

1. chegou o e-mail "Confirme seu e-mail" (olhe também o spam);
2. depois de confirmar, chegou ao gsel@ o e-mail "Nova solicitação de reserva";
3. depois de autorizar ou recusar, chegou a resposta no e-mail pessoal;
4. a planilha mostra cada etapa.

## Atualizar o código

Salvar o código **não** atualiza o serviço que está no ar. Depois de colar uma nova versão e salvar:
**Implantar** → **Gerenciar implantações** → lápis (editar) → Versão: **Nova versão** → **Implantar**. A URL continua a mesma.

## Limites e segurança

- Uma conta Google Workspace envia até 1.500 e-mails por dia; uma conta Gmail comum, 100. Cada solicitação completa usa 3 e-mails.
- Cada e-mail só pode fazer 3 solicitações a cada 30 minutos, e o total é limitado a 40 por hora. Um campo invisível descarta envios de robôs.
- Os links dos e-mails são únicos e secretos. Os botões Autorizar e Recusar só existem no e-mail do GSEL.
- Abrir um link só mostra uma página: a ação acontece ao clicar no botão de confirmação. Assim, os antivírus de e-mail que "visitam" links não confirmam nem autorizam nada sozinhos.

## Problemas comuns

- **A opção "Qualquer pessoa" não aparece na implantação.** A administração do Google Workspace do IFPE pode bloquear apps abertos ao público. Nesse caso, instale o serviço com uma conta Gmail do grupo e mantenha `EMAIL_GSEL: 'gsel@garanhuns.ifpe.edu.br'`. Os e-mails sairão da conta Gmail, com resposta direcionada ao gsel@, e os pedidos continuarão chegando ao gsel@.
- **O site mostra "Não foi possível conectar ao sistema de reservas".** Confira se a URL em `data-endpoint` está completa (termina em `/exec`) e se a implantação está ativa com acesso "Qualquer pessoa".
- **Os e-mails caem no spam.** Peça para marcar a mensagem como "não é spam" e adicionar o remetente aos contatos.
