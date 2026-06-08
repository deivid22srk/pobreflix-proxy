# Pobreflix Proxy

Um proxy completo e otimizado em Node.js (npm) para o site `https://www.pobreflix.you/`. Acompanha uma interface web premium, responsiva e com design moderno para navegação e reprodução de filmes, séries, temporadas e episódios sem anúncios invasivos ou bloqueios de CORS/Referer.

## Recursos
- **Home Scraper**: Categorização inteligente na página inicial (Destaques, Filmes Recentes, Séries Recentes, Novas Temporadas).
- **Busca Integrada**: Busca em tempo real de conteúdos diretamente na barra de pesquisa.
- **Visualizador de Detalhes**: Páginas de detalhes completas com sinopse, gêneros, ano, nota IMDb, canais e opções de players.
- **Navegador de Temporadas/Episódios**: Sistema interativo de seleção de temporadas e listagem de episódios com thumbnails e datas de lançamento.
- **Multi-Player Bypass**: Resolução dinâmica de múltiplos canais de players (Canal 1, Canal 2, etc.) com bypass avançado de cabeçalhos de segurança.
- **Master Proxy Engineering**:
  - Remoção de regras restritivas do CSP (`Content-Security-Policy: frame-ancestors`) e `X-Frame-Options` para permitir a incorporação de iframes em localhost.
  - Proxyamento de cookies de sessão (`Set-Cookie` / `Cookie`) para manter sessões ativas com servidores de streaming.
  - Sobrescrita de parâmetros de referenciamento (como referers e parâmetros `r` nos AJAXs de vídeo) fingindo requisições originadas do domínio oficial.
  - Reescrita automática de URLs absolutas e relativas das páginas dos players para carregar todos os scripts (`scripts.php`, jwplayer) e requests de vídeo locais através do proxy.

## Instalação

Navegue até a pasta do projeto e instale as dependências:

```bash
cd pobreflix-proxy
npm install
```

## Como Iniciar

Inicie o servidor localmente:

```bash
npm start
```

O servidor estará rodando em: [http://localhost:3000](http://localhost:3000)

## Como Executar os Testes

Para rodar os testes automatizados de integração:

```bash
npm test
```

O script de teste irá inicializar um servidor de testes temporário, verificar todos os endpoints da API de scraping, testar a pesquisa, detalhes de filmes, detalhes de séries, e as reescritas do proxy de players, reportando o resultado.

## Estrutura do Projeto
- `server.js` - Servidor backend Express com lógica de scraping e controle de proxies.
- `test.js` - Script de testes automatizados de integração (35 assertions validadas com sucesso).
- `public/`
  - `index.html` - Interface web com design de alto padrão (tema escuro, ícones premium, layout fluído).
  - `style.css` - Design responsivo estilizado com gradientes, efeitos blur de vidro (glassmorphism), efeitos de brilho traseiro (backglow) no player de vídeo e animações micro-interativas.
  - `app.js` - Controlador frontend da aplicação para navegação dinâmica e controle dos players e abas de canais.
