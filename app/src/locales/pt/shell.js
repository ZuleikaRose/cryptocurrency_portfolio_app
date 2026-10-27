// App shell, navigation, page titles (routes.js), menu groups, shortcuts and lib/format.js.
export const shell = {
  // Shell
  "CPA, Cryptocurrency Portfolio App — home": "CPA, Cryptocurrency Portfolio App: início",
  Search: "Buscar",
  "Accessibility menu": "Menu de acessibilidade",
  "Alerts, {count} unread": "Alertas, {count} não lidos",
  Alerts: "Alertas",
  "Sign in to see your alerts": "Entre para ver seus alertas",
  "Open menu": "Abrir menu",
  Primary: "Principal",
  "Not financial advice. Data provided for informational purposes.": "Não é recomendação financeira. Dados fornecidos apenas para fins informativos.",
  Footer: "Rodapé",
  "Skip to content": "Pular para o conteúdo",
  Menu: "Menu",
  "Keyboard shortcuts": "Atalhos de teclado",
  "End demo": "Sair da demonstração",

  // Tabs and page titles (routes.js)
  Home: "Início",
  Market: "Mercado",
  Explore: "Explorar",
  Funding: "Financiamento",
  Fundraising: "Rodadas de investimento",
  Unlocks: "Desbloqueios",
  Watchlist: "Lista de acompanhamento",
  Portfolio: "Carteira",
  "Coin detail": "Detalhes da moeda",
  "Fund profile": "Perfil do fundo",
  "Token unlocks": "Desbloqueios de tokens",
  "Token sales": "Vendas de tokens",
  Holding: "Posição",
  "Log in or sign up": "Entre ou cadastre-se",
  "Forgot password": "Esqueci a senha",
  "Reset password": "Redefinir senha",
  "Log out": "Sair",
  "Account settings": "Configurações da conta",
  "Customer support": "Atendimento ao cliente",
  FAQs: "Perguntas frequentes",
  "Report an issue": "Informar um problema",
  "Send feedback": "Enviar comentários",
  Promotions: "Promoções",
  "Affiliate program": "Programa de afiliados",
  "Technical requirements": "Requisitos técnicos",
  "AI features": "Recursos de IA",
  "Terms of service": "Termos de serviço",
  "Privacy policy": "Política de privacidade",
  "Accessibility policy": "Política de acessibilidade",
  "Not found": "Página não encontrada",

  // Bottom nav labels (tc("tab", …)): the tab's aria-label keeps the full title.
  "tab|Funding": "Rodadas",
  "tab|Unlocks": "Desbloq.",
  "tab|Watchlist": "Lista",
  "sidebar|Watchlist": "Acompanhamento", // desktop sidebar (tc("sidebar", …))
  "action|View": "Ver", // toast button; plain "View" is the noun
  // Feminine forms where the noun is "venda" or "promoção".
  "sales|Upcoming": "Próximas",
  "sales|Active": "Ativas",
  "sales|Past": "Encerradas",
  "promotion|Active": "Ativa",

  // Menu groups
  Research: "Pesquisa",
  Account: "Conta",
  Help: "Ajuda",
  "About CPA": "Sobre o CPA",
  Legal: "Jurídico",

  // Shortcuts (data/shortcuts.js)
  "Open search": "Abrir a busca",
  "Close dialog or menu": "Fechar a caixa de diálogo ou o menu",
  "Chart range 1D…ALL (on a coin)": "Período do gráfico 1D…ALL (em uma moeda)",
  "Move chart crosshair; switch tabs": "Mover a mira do gráfico; trocar de aba",
  "Shortcuts help": "Ajuda dos atalhos",

  // lib/format.js
  unchanged: "sem alteração",
  "up {value} percent": "alta de {value} por cento",
  "down {value} percent": "queda de {value} por cento",
  dollars: "dólares",
  euros: "euros",
  pounds: "libras",
  bitcoin: "bitcoin",
  ether: "ether",
  "just now": "agora mesmo",
  "{n}s ago": "há {n} s",
  "{n}m ago": "há {n} min",
  "{n}h ago": "há {n} h",
  "{n}d ago": "há {n} d",
  now: "agora",
  "in {time}": "em {time}",

  // Language setting
  Language: "Idioma",
  "We couldn't load that language. Check your connection and try again.": "Não conseguimos carregar esse idioma. Verifique sua conexão e tente de novo.",

  // Page loading (lazy pages)
  "Loading page": "Carregando a página",
};
