# Site do GSEL

Site oficial do **GSEL — Grupo de Pesquisa em Sistemas Elétricos** do IFPE *campus* Garanhuns.

Publicado pelo GitHub Pages em: **https://gsel-ifpe.github.io/site/**

O site é estático (HTML, CSS e JavaScript puros), sem etapa de build: o que está na branch `main` é o que vai ao ar.

## Estrutura

```
index.html              página única com todas as seções
404.html                página de "não encontrado"
favicon.svg             símbolo colorido da marca
assets/
  css/style.css         estilos (cores e fontes da marca no topo, em :root)
  js/main.js            menu mobile, animações, carrossel e foto ampliada
  img/marca/            logos oficiais do GSEL e do IFPE (SVG)
  img/fotos/            fotos em tamanho grande (usadas ao ampliar)
  img/fotos/thumb/      miniaturas das fotos (usadas nos cards da galeria)
  img/vinculos/         logos do DGP/CNPq e da PNIPE
  img/og-gsel.jpg       imagem de prévia ao compartilhar o link
apps-script/
  Codigo.gs             serviço de reservas (Google Apps Script)
  LEIAME.md             instalação do serviço de reservas
```

## Seções da página

| Seção | Âncora |
| --- | --- |
| Início (topo com foto) | `#inicio` |
| Sobre o GSEL | `#sobre` |
| Linhas de Pesquisa | `#linhas` |
| Atuação (Pesquisa e Desenvolvimento) | `#atuacao` |
| Membros Atuais | `#equipe` |
| InfoGSEL (painel do Looker Studio) | `#infogsel` |
| Reserva de Equipamentos (LabSEL) | `#reservas` |
| Galeria | `#galeria` |
| Localização | `#localizacao` |
| Vínculos institucionais | `#vinculos` |
| Contato (rodapé) | `#contato` |

## Como editar

Todo o conteúdo está em `index.html`, com um comentário marcando o início de cada seção (`<!-- Equipe -->`, `<!-- Galeria -->` etc.).

**Adicionar ou remover um membro:** copie um bloco `<li class="reveal">…</li>` dentro de `#equipe` e troque as iniciais do avatar, o nome e o link do Lattes.

**Adicionar uma foto à galeria:**

1. Salve duas versões da foto: uma com ~1600 px de largura em `assets/img/fotos/` e uma com ~760 px em `assets/img/fotos/thumb/`, com o mesmo nome de arquivo.
2. Copie um bloco `<li class="photo-card">…</li>` em `#galeria` e ajuste os caminhos, a etiqueta (`data-tag` e `photo-tag`), a legenda e o texto alternativo (`alt`).

**Formulário de reserva (`#reservas`):** funciona com o serviço de reservas em Google Apps Script, na pasta [`apps-script/`](apps-script/LEIAME.md). O solicitante confirma o e-mail por um link, o GSEL autoriza ou recusa pelo próprio e-mail e o solicitante recebe a resposta automaticamente. Para ligar o serviço, siga o [passo a passo](apps-script/LEIAME.md) e cole a URL do app da Web no atributo `data-endpoint` do `<form id="form-reserva">`.

Sem `data-endpoint`, ou se o serviço estiver fora do ar, o site usa um plano B: monta a mensagem e abre o aplicativo de e-mail do visitante, endereçado ao `data-email` do `<form>`.

- Para trocar o e-mail do GSEL, altere `EMAIL_GSEL` em `apps-script/Codigo.gs`, o `data-email` do formulário e o texto do painel "Solicitação pronta para envio".
- Para incluir um equipamento, copie um bloco `<label class="equip">…</label>` e ajuste o `value`, o nome e os atributos:
  - `data-descricao`: pergunta exibida no campo de descrição;
  - `data-quantidade`: mostra o campo de quantidade com essa pergunta;
  - `data-nota`: observação exibida abaixo da pergunta de quantidade (opcional);
  - `data-agenda="sim"`: mostra os campos de data desejada e período.

  Inclua também o mesmo nome em `EQUIPAMENTOS`, no `apps-script/Codigo.gs` (com `quantidade: true` ou `agenda: true`), e publique uma nova versão do serviço: ele recusa equipamentos que não estão na lista.

**Cores e fontes:** ficam nas variáveis do início de `assets/css/style.css`, conforme o Guia da Marca GSEL v2.1 (Azul Profundo `#142B47`, Ciano GSEL `#37C0D5`, Azul Elétrico `#153A72`, Cinza Névoa `#EEF2F5`, Grafite `#5C6B7A`; famílias Saira, Saira Semi Condensed e Saira Condensed).

## Ver o site no computador

Na pasta do projeto:

```bash
python -m http.server 8000
```

Depois abra http://localhost:8000 no navegador.

## Publicar alterações

Faça commit e `git push` na branch `main`. O GitHub Pages atualiza o site em um ou dois minutos.

Se o site passar a usar um domínio próprio, troque `<base href="/site/">` por `<base href="/">` em `404.html` e atualize os endereços `https://gsel-ifpe.github.io/site/` nas tags `<meta>` de `index.html`.
