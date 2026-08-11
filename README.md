# 🟫 Clauddy

Um bichinho de estimação pixel-art fofo pra macOS que acompanha seu uso do Claude Code — espelhando o painel oficial **Settings → Usage** (sessão atual + limites semanais, em tokens e %), com animações.

<p align="center">
  <img src="https://raw.githubusercontent.com/renatoaug/claude-usage-monitor/main/docs/media/overview.gif" width="300" alt="Clauddy — o widget completo mostrando sessão, semanal, por modelo e uso dos últimos 30 dias" /><br />
  <em>Uma criaturinha cor de terracota que vive no canto da sua tela, come seus tokens, e tira uma soneca quando você está ocioso.</em>
</p>

## O que ele mostra

- **Sessão atual** — % real usada + **"reinicia em Xh Ym"** + tokens da sessão
- **Semanal · todos os modelos** — % real usada + tokens dos últimos 7 dias
- **Linha de status** embaixo do bichinho: `● trabalhando · 1.6M tok/min` (ou tokens de hoje quando ocioso)
- **Por modelo · 7 dias** — Opus / Sonnet / Haiku / Fable, em tokens
- **Mapa de 30 dias** — quadradinhos coloridos por tokens diários (verde = leve → vermelho = pesado), com o total mensal

As **porcentagens são reais**, vindas direto da sua conta (você faz login uma vez — veja abaixo). A contagem de tokens, o detalhamento por modelo, o status de atividade e o mapa de 30 dias vêm dos seus logs locais (`~/.claude/projects/**/*.jsonl`). Tudo é baseado em tokens — sem valores em dinheiro.

## Conta e uso ao vivo

A **%** de sessão/semanal vem direto da sua conta Anthropic, então bate exatamente com o painel oficial. Você conecta uma vez via login no navegador:

1. Abra **⚙ Configurações → "Entrar pelo navegador"** — seu navegador abre uma página de autenticação da Anthropic.
2. Faça login, copie o **código de autenticação** exibido, e cole de volta no app → **Conectar**.

O token fica salvo localmente (veja [Dados e privacidade](#dados-e-privacidade)) e é atualizado automaticamente. **Até você conectar**, a área de limites mostra um aviso _"Conecte sua conta"_ em vez das porcentagens.

## Os estados do bichinho

<table>
  <tr>
    <td align="center"><img src="https://raw.githubusercontent.com/renatoaug/claude-usage-monitor/main/docs/media/idle.gif" width="280" alt="ocioso" /><br /><b>ocioso</b><br /><sub>respira e pisca</sub></td>
    <td align="center"><img src="https://raw.githubusercontent.com/renatoaug/claude-usage-monitor/main/docs/media/working.gif" width="280" alt="trabalhando" /><br /><b>trabalhando</b><br /><sub>pula e come moedas de token</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="https://raw.githubusercontent.com/renatoaug/claude-usage-monitor/main/docs/media/on-fire.gif" width="280" alt="pegando fogo" /><br /><b>pegando fogo</b><br /><sub>sessão ≥ 90% → vermelho, treme, chamas</sub></td>
    <td align="center"><img src="https://raw.githubusercontent.com/renatoaug/claude-usage-monitor/main/docs/media/tired.gif" width="280" alt="no limite" /><br /><b>no limite</b><br /><sub>sessão em 100% → exausto, caído, suando</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="https://raw.githubusercontent.com/renatoaug/claude-usage-monitor/main/docs/media/sleeping.gif" width="280" alt="dormindo" /><br /><b>dormindo</b><br /><sub>ocioso 5+ min → zzz azul e luar</sub></td>
    <td align="center"><img src="https://raw.githubusercontent.com/renatoaug/claude-usage-monitor/main/docs/media/poke.gif" width="280" alt="cutucar" /><br /><b>cutucar</b><br /><sub>clique no bichinho → se espreme e solta corações</sub></td>
  </tr>
  <tr>
    <td colspan="2" align="center"><img src="https://raw.githubusercontent.com/renatoaug/claude-usage-monitor/main/docs/media/celebrate.gif" width="280" alt="comemorar" /><br /><b>comemorar</b><br /><sub>sessão reinicia → pula e solta confete</sub></td>
  </tr>
</table>

Além de um **acenar** de boas-vindas ao abrir. Você também pode [cutucar o bichinho pelo terminal](#brinque-com-o-bichinho).

### O que o Claude está fazendo

Enquanto o Claude Code está trabalhando ativamente, o bichinho monta uma
cenazinha de mesa que espelha **o que ele está fazendo agora** — inferido dos
seus logs locais (a última ferramenta usada). A linha de status nomeia a
atividade, e três delas ganham sua própria cena animada:

<table>
  <tr>
    <td align="center"><img src="https://raw.githubusercontent.com/renatoaug/claude-usage-monitor/main/docs/media/reading.gif" width="280" alt="lendo" /><br /><b>lendo</b><br /><sub>coloca óculos e folheia documentos</sub></td>
    <td align="center"><img src="https://raw.githubusercontent.com/renatoaug/claude-usage-monitor/main/docs/media/editing.gif" width="280" alt="editando" /><br /><b>editando</b><br /><sub>digita no laptop, café ao alcance</sub></td>
  </tr>
  <tr>
    <td colspan="2" align="center"><img src="https://raw.githubusercontent.com/renatoaug/claude-usage-monitor/main/docs/media/running.gif" width="280" alt="executando" /><br /><b>executando</b><br /><sub>observa um log de tarefas passando pelas checagens</sub></td>
  </tr>
</table>

Outras atividades — **planejando**, **pesquisando**, **delegando**,
**aguardando** — aparecem na linha de status conforme acontecem. Quando o
Claude fica quieto, o bichinho volta pro simples **trabalhando** / **ocioso**.

## Instalação

**macOS (Apple Silicon)** é o build principal. **Windows (x64)** e **Linux (x64)** também funcionam. O caminho `bunx`/`npx` abaixo roda em todos eles hoje.

### macOS

Dois jeitos, dependendo do que você quer:

#### 1. Instalar como app — abre no login (recomendado)

Um comando só — ele baixa a última versão e coloca em `/Applications`:

```bash
curl -fsSL https://raw.githubusercontent.com/renatoaug/claude-usage-monitor/main/install.sh | bash
```

**Clauddy é gratuito e open source** — o comando acima só baixa a última versão deste repositório e coloca em `/Applications`, nada mais (você pode ler o [`install.sh`](install.sh) antes, se quiser).

Depois de instalado, dá pra atualizar direto pelo app: **⚙ Configurações → Verificar atualizações → Atualizar agora** roda o mesmo instalador e reabre a nova versão.

Por que não um download normal? O macOS bloqueia apps **não assinados** baixados pelo navegador com um aviso assustador de *"danificado, mover para o lixo"* — mesmo quando são perfeitamente seguros. É um falso alarme: a única forma de silenciar isso é pagar à Apple **US$ 99/ano** pra assinar + notarizar, o que um app hobby gratuito não faz. Arquivos baixados com `curl` não são sinalizados, então esse método simplesmente **deixa seu Mac abrir o app** sem o bloqueio. Depois ele se registra nos **Itens de Login** e inicia junto com o Mac — configura uma vez e esquece.

#### 2. Rodar via `bunx` (sem instalar)

Precisa do [Bun](https://bun.sh) (ou use `npx` com Node 24):

```bash
bunx clauddy
```

A primeira execução baixa o Electron, então dê um tempinho. Prático pra uma execução rápida, mas ele só fica de pé **enquanto esse comando estiver aberto** e não inicia sozinho. Feche com o botão **×**.

### Windows (x64)

#### 1. Instalador — cria atalhos e abre no login (recomendado)

Pegue o **instalador** (`Clauddy-<versão>-setup.exe`) na [última release](https://github.com/renatoaug/claude-usage-monitor/releases) e rode. Ele instala só pro seu usuário (sem precisar de admin), pergunta a pasta, cria atalho na área de trabalho e no menu Iniciar, e abre o Clauddy ao terminar. Como o app não é assinado, o **SmartScreen** do Windows mostra um aviso de "O Windows protegeu seu PC" na primeira vez — clique em **Mais informações → Executar assim mesmo**. Tem um desinstalador de verdade (Painel de Controle → Programas, ou o atalho no menu Iniciar).

#### 2. Zip portátil (sem instalar)

Pegue o **zip portátil** (`Clauddy-<versão>-win.zip`) na [última release](https://github.com/renatoaug/claude-usage-monitor/releases), descompacte em qualquer lugar, e rode `Clauddy.exe`. Não cria atalhos nem se registra pra abrir no login sozinho — bom pra testar rápido ou rodar de um pendrive.

#### 3. Via `bunx` (sem instalar nada)

Funciona igual ao macOS — com [Bun](https://bun.sh) ou Node 24 instalado:

```powershell
bunx clauddy   # ou: npx clauddy
```

> Os builds do Windows são gerados pelo workflow **Build** (Actions ▸ Build) — anexá-los automaticamente a cada release está no roteiro.

### Linux (x64)

O caminho mais rápido funciona igual ao macOS — com [Bun](https://bun.sh) ou Node 24 instalado:

```bash
bunx clauddy   # ou: npx clauddy
```

Prefere um app independente? Pegue o **AppImage** ou **tar.gz** (`Clauddy-<versão>.AppImage` / `clauddy-<versão>.tar.gz`) na [última release](https://github.com/renatoaug/claude-usage-monitor/releases), depois:

```bash
chmod +x Clauddy-*.AppImage
./Clauddy-*.AppImage
```

> Os builds do Linux são gerados pelo workflow **Build** (Actions ▸ Build) — anexá-los automaticamente a cada release está no roteiro.

> O ícone da bandeja do sistema precisa de uma extensão de indicador no GNOME padrão (ex.: "AppIndicator and KStatusNotifier Item Support") — funciona nativamente no Cinnamon, KDE e XFCE. O início automático no login é feito via uma entrada `.desktop` do XDG em `~/.config/autostart/`.

> O app guarda seus dados em `~/.claude-usage-monitor`, independente da plataforma ou de como você o executa.

## Controles

- **Arraste** o widget pra qualquer lugar da tela
- **–** minimiza só pro rosto do bichinho (mostrando a % de sessão ao vivo); o botão **⤢** ou um clique duplo no bichinho expande de volta
- **⚙** abre as configurações (login, ativar alertas, definir limites, escolher o modo de exibição)
- **↗** abre a página oficial de Uso
- **×** fecha

### Flutuante ou barra de menu

Em **⚙ Configurações → Exibição** você pode escolher onde o Clauddy vive:

- **Bichinho flutuante** — o widget sempre visível no canto (padrão).
- **Barra de menu** — um pequeno ícone do bichinho na barra de menu do macOS mostrando sua % de sessão ao vivo (fica 🔥 perto do limite). Clique nele pra abrir o painel completo do bichinho + uso; clique fora pra fechar. Clique com o botão direito pra um menu rápido.

A troca é instantânea — sem reiniciar. (No Windows/Linux o ícone fica na bandeja do sistema; a % ao vivo aparece na dica de ferramenta.)

## Alertas

**Notificações do macOS** opcionais quando sua sessão ou uso semanal ultrapassa os limites que você definir (padrão **80%** e **95%**) — ex.: _"Sua sessão passou de 80% — agora em 82%"_. Elas se rearmam automaticamente quando o uso volta abaixo de um limite (depois de um reinício). Ative/desative e edite os limites em **⚙ Configurações**.

## Configurar (`config.json`)

As configurações salvas pela interface ficam em `~/.claude-usage-monitor/config.json`, então dá pra ajustá-las sem recompilar:

```jsonc
{
  "mode": "floating", // bichinho "floating" no canto, ou popover "menubar"
  "language": "pt", // "pt" ou "en" — idioma da interface
  "alerts": true, // notificações do macOS ligadas/desligadas
  "alertThresholds": [80, 95], // avisa quando sessão/semana passam desses % (dois níveis)
  "fireThreshold": 90, // % de sessão em que o bichinho pega fogo (no limite fica travado em 100)
  "pollIntervalMs": 4000, // com que frequência os logs locais são relidos
  "activeThresholdMs": 20000, // "ativo" se o Claude escreveu nos logs dentro dessa janela
  "sleepThresholdMs": 300000, // "dormindo" depois desse tempo ocioso (5 min)
}
```

## Brinque com o bichinho

Com o widget rodando, cutuque ele pelo terminal — só por diversão:

```bash
bunx clauddy poke        # 💕 se espreme + corações
bunx clauddy celebrate   # 🎉 pula + confete
bunx clauddy fire        # 🔥 pega fogo
bunx clauddy sleeping    # 😴 zzz azul
bunx clauddy working     # 🍴 come moedas de token
bunx clauddy tired       # 🥵 no limite
bunx clauddy idle        # 🙂 calmo
bunx clauddy auto        # ↩️ volta pro seu uso real
```

Cada estado é escrito na pasta de dados que o widget em execução observa, então
ele reage ao vivo. (Instalado globalmente? Tire o `bunx`: `clauddy poke`.
Trabalhando no repositório? `./pet <estado>` faz o mesmo.)

## Como funciona

- **`main.js`** — processo principal do Electron: janela sem moldura, transparente, sempre no topo; consulta o uso; dispara notificações do macOS; observa `config.json` e `debug.json`.
- **`usage.js`** — lê `~/.claude/projects/**/*.jsonl`, soma tokens por modelo/dia, detecta a janela móvel de 5 horas da sessão, o status de trabalhando/dormindo, e qual atividade (lendo/editando/executando/…) o Claude está fazendo a partir do último uso de ferramenta.
- **`auth.js`** — login OAuth (PKCE, mesmo cliente público do Claude Code) que busca a % real de uso. Token guardado localmente, nunca commitado.
- **`i18n-strings.js`** — dicionário único de textos (EN/PT) usado tanto pelo processo principal (bandeja, notificações) quanto pela interface.
- **`renderer/`** — o bichinho em si: um sprite pixel-art em SVG, animações CSS, e a Web Animations API pras partículas.
- **`make-icon.js`** — gera o ícone do app a partir do sprite pixel-art (`build/icon.icns`).

## Dados e privacidade

Tudo fica na sua máquina, em `~/.claude-usage-monitor/`:

- `auth.json` — seu token OAuth (permissão de arquivo `600`, nunca commitado)
- `config.json` — suas configurações de alerta
- `debug.json` — arquivo de rascunho pro simulador `./pet`

Nada sai da sua máquina, exceto as chamadas OAuth pros próprios endpoints de login e uso da Anthropic.

## Ferramentas de desenvolvimento

- **Bun** pra instalação/scripts, **Node 24** fixado em `.nvmrc`
- **Biome** pra formatação + lint (`bun run check`); um **pre-commit hook** versionado (`.githooks/pre-commit`) formata automaticamente os arquivos staged e bloqueia em caso de erro. É configurado automaticamente no `bun install` (via o script `prepare`).

### Releases

Releases são **totalmente automatizadas**. Todo push pro `main` roda o
[semantic-release](https://semantic-release.gitbook.io) (`.github/workflows/release.yml`):
ele lê os **Conventional Commits** e, quando há algo pra lançar,
calcula a versão, compila o app macOS, publica `clauddy` no npm, e
gera uma Release do GitHub com o zip do `.app`. Nada pra fazer manualmente — só
dar merge nos PRs.

- `feat:` → minor, `fix:` → patch, `feat!:`/`BREAKING CHANGE` → major.
- `docs:`/`chore:`/`ci:` etc. não disparam uma release.
