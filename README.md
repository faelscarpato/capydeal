# CapyDeal - Comparador de Preços Inteligente

## Visao Geral
CapyDeal e uma PWA (Progressive Web App) de busca de precos e produtos que utiliza a API do Google Gemini 2.5 Flash com ferramentas de Google Search e Google Maps para encontrar as melhores ofertas.

## Arquitetura
- **100% Client-Side**: Arquivos estaticos (HTML, CSS, JS) sem backend proprio
- **IA Engine**: Google Gemini 2.5 Flash via REST API direto no navegador
- **Tools**: Google Search e Google Maps integrados via Gemini Tools
- **Armazenamento**: `localStorage` para Watchlist, API Key e Status Pro
- **Monetizacao**: Sistema "Freemium" simulado (3 buscas gratuitas, Pro ilimitado)

## Stack Tecnologico
- HTML5 semantico
- CSS3 com variaveis customizadas (design inspirado no Buscape)
- JavaScript ES6+ puro (Vanilla JS)
- Service Worker para funcionamento offline

## Funcionalidades Principais

### Busca de Precos
- Busca por produto/modelo/marca
- Definicao de orcamento
- Lojas preferenciais
- Geolocalizacao para lojas proximas (Pro)
- Modelos semelhantes dentro do orcamento

### Watchlist (Modo Sentinela)
- Lista de lojas monitoradas
- Exportacao para CSV
- Re-busca priorizando lojas selecionadas (Pro)
- Limpeza da lista

### Temas
- Tema claro (padrao) - inspirado no Buscape
- Tema escuro

### Sistema Pro
- 3 buscas gratuitas
- Pro: buscas ilimitadas, geolocalizacao, re-busca com lojas favoritas

## Estrutura de Arquivos
```
/
├── index.html        # Pagina principal
├── style.css         # Estilos (tema Buscape)
├── app.js           # Logica da aplicacao
├── manifest.json    # Manifesto PWA
├── service-worker.js # Service Worker para cache
└── replit.md        # Esta documentacao
```

## Variaveis CSS Principais
- `--color-primary`: #FFD700 (amarelo Buscape)
- `--color-bg-base`: #F5F5F5 (fundo claro)
- `--color-text-primary`: #1A1A1A (texto escuro)
- `--color-success`: #28A745 (verde para precos/cashback)
- `--color-danger`: #DC3545 (vermelho para alertas)

## LocalStorage Keys
- `capydeal_gemini_api_key`: Chave da API Gemini
- `capydeal_is_pro_v1`: Status Pro (1/0)
- `capydeal_search_count_v1`: Contador de buscas
- `capydeal_watchlist_v1`: JSON da watchlist
- `capydeal_theme_v1`: Tema atual (light/dark)

## Contato do Desenvolvedor
- **GitHub**: [@faelscarpato](https://github.com/faelscarpato)
- **LinkedIn**: [rafaelscarpato](https://linkedin.com/in/rafaelscarpato)
- **WhatsApp**: [+55 19 99546-6902](https://wa.me/5519995466902)

## Atualizacoes Recentes
- **Novembro 2025**: Redesign completo com estilo inspirado no Buscape
- **Novembro 2025**: Adicionada funcionalidade de exportar Watchlist como CSV
- **Novembro 2025**: Adicionado botao para limpar Watchlist
- **Novembro 2025**: Melhorias no tema escuro
- **Novembro 2025**: Rodape estilizado com links de contato (GitHub, LinkedIn, WhatsApp)
