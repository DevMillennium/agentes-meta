json.data do
  json.page_details @page_details
  json.user_access_token @user_access_token
  json.phoenix_admin_hint 'Administrador: escolha a Página Business. Estrelas (★) já têm caixa — selecione para reautorizar. Sinal (＋) cria nova caixa. Alterne entre caixas em Configurações → Caixas de Entrada ou /comecar/paginas-business.'
end
