# Privacidade, segurança e acessibilidade

Este documento explica como o ChokoCRM trata os dados pessoais, à luz da Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018), que medidas de segurança estão no código e o que foi feito para o sistema poder ser usado por mais pessoas, seguindo as diretrizes de acessibilidade WCAG 2.1.

## Sumário

1. [Dados pessoais guardados](#1-dados-pessoais-guardados)
2. [Como a LGPD foi considerada](#2-como-a-lgpd-foi-considerada)
3. [Segurança](#3-segurança)
4. [Acessibilidade](#4-acessibilidade)
5. [Licenças](#5-licenças)
6. [O que falta para o uso com dados reais](#6-o-que-falta-para-o-uso-com-dados-reais)

## 1. Dados pessoais guardados

Dado pessoal é qualquer informação que identifica uma pessoa. O sistema guarda poucos, todos ligados ao trabalho de atendimento.

| De quem | Quais dados | Para quê | Onde |
|---------|-------------|----------|------|
| Usuários do sistema (representantes e gestores) | Nome, nome de usuário, telefone e a senha embaralhada | Entrar no sistema e identificar quem fez cada visita | Tabela `users` |
| Contatos dos clientes | Nome, cargo, telefone e e-mail | Saber com quem falar em cada cliente e abrir a conversa no WhatsApp | Tabela `contacts` |
| Pessoas que apareçam nas fotos | Imagem | Comprovar que a visita aconteceu | Disco do servidor, por 90 dias |

Os clientes são empresas. A razão social, o CNPJ, o endereço e as notas fiscais são dados de pessoa jurídica, que a LGPD não trata como dado pessoal. Mesmo assim, eles recebem a mesma proteção de acesso, porque são informações comerciais da Chokolaten.

O sistema não guarda CPF nem dados sensíveis, como os de saúde, religião ou biometria. A descrição completa de cada tabela está em [Modelo de dados](modelo-de-dados.md).

Hoje, os clientes e contatos que aparecem no ambiente publicado são fictícios, criados para demonstração. Os telefones de todos eles são o da autora do projeto, para que as mensagens de teste cheguem a um número conhecido.

## 2. Como a LGPD foi considerada

Na operação real, quem decide sobre os dados é a Chokolaten, que a lei chama de controladora. O ChokoCRM é a ferramenta que ela usa. Os contatos guardados são de pessoas que representam os clientes em uma relação comercial que já existe, e os dados servem só para manter essa relação. Na avaliação feita neste projeto, isso se enquadra na execução dessa relação e no legítimo interesse da empresa (art. 7º, incisos V e IX).

A tabela mostra o que foi feito para cada princípio do art. 6º da lei.

| Princípio | O que a lei pede | O que o sistema faz |
|-----------|------------------|---------------------|
| Finalidade e adequação | Usar o dado só para o propósito informado | Os dados de contato servem apenas ao atendimento. Não há envio de propaganda automática nem repasse a terceiros |
| Necessidade | Guardar o mínimo | O contato tem só nome, cargo, telefone e e-mail. O texto da mensagem do WhatsApp não é guardado |
| Qualidade dos dados | Manter o dado correto | O representante e o gestor corrigem os dados do cliente e dos contatos a qualquer momento |
| Livre acesso | Permitir que a pessoa saiba o que há sobre ela | O gestor consegue consultar e informar tudo o que está guardado sobre um contato, que é o que aparece na aba Cadastro da ficha |
| Segurança e prevenção | Proteger contra acesso indevido | Ver a [seção 3](#3-segurança) |
| Tempo de guarda | Não guardar além do necessário | As fotos são apagadas depois de 90 dias por uma rotina diária. Um contato pode ser excluído da ficha |
| Transparência | Explicar o tratamento | Este documento e o [Modelo de dados](modelo-de-dados.md) descrevem tudo o que é guardado |

Três serviços externos aparecem no caminho dos dados:

| Serviço | O que recebe |
|---------|--------------|
| WhatsApp | O número do contato e o texto sugerido, quando a pessoa clica no botão. A conversa abre no aparelho de quem está usando, e é ela quem decide enviar |
| Google Maps | Os endereços dos clientes das visitas do dia, quando a pessoa abre o roteiro |
| Microsoft Azure | Hospeda o servidor, o banco de dados e os registros técnicos de funcionamento (Application Insights) |

## 3. Segurança

As medidas abaixo estão no código e seguem as recomendações mais conhecidas de desenvolvimento seguro, reunidas no OWASP Top 10.

| Risco | Medida | Onde está |
|-------|--------|-----------|
| Senha vazada | A senha nunca é guardada. O banco guarda o resultado do bcrypt, um embaralhamento que não pode ser desfeito | `backend/src/services/auth.service.ts` |
| Descobrir quais usuários existem | O login faz a mesma conferência e devolve a mesma mensagem quando o usuário não existe e quando a senha está errada | `backend/src/services/auth.service.ts` |
| Acesso sem login | Os endereços da API exigem um token válido, que vence em oito horas. As exceções são o login, a verificação de saúde, a consulta do relógio do sistema e a ativação do modo demonstração, que confere a senha da conta Gestão no próprio pedido | `backend/src/middlewares/authJwt.ts` |
| Um representante ver a carteira de outro | A regra de carteira é conferida no servidor, em um módulo só, em todo pedido. Esconder na tela não é a proteção | `backend/src/services/carteira.ts` |
| Ação de gestor feita por representante | Cada endereço declara o perfil exigido | `backend/src/middlewares/requireRole.ts` |
| Dados inválidos ou maliciosos | Tudo o que chega é validado com Zod antes de qualquer regra | `backend/src/schemas` |
| Injeção de SQL | O acesso ao banco passa pelo Prisma, que separa o comando dos dados | `backend/src/repositories` |
| Arquivo perigoso no lugar da foto | O servidor confere os primeiros bytes do arquivo e aceita só JPEG, PNG e WebP de até 5 MB. O PDF de nota fiscal tem limite de 10 MB | `backend/src/lib/imageType.ts` |
| Foto vista por quem não devia | A foto só é entregue a quem tem acesso ao cliente da visita | `backend/src/services/visit.service.ts` |
| Token exposto nos registros | O cabeçalho com o token é apagado antes de o pedido ser registrado | `backend/src/middlewares/requestLogger.ts` |
| Outro site usando a API pelo navegador | O servidor só autoriza a origem da própria interface | `backend/src/app.ts` |
| Segredos no repositório | Senhas de banco, segredo do token e chaves ficam em variáveis de ambiente e nos segredos do GitHub, fora do código | `backend/.env.example` |
| Tráfego interceptado | O ambiente publicado é acessado por HTTPS | Azure App Service |

Além disso, o SonarCloud analisa a segurança do código a cada envio, e o projeto mantém a nota A, sem vulnerabilidades apontadas. Os detalhes estão em [Testes](testes.md#7-análise-de-código).

## 4. Acessibilidade

A interface foi construída seguindo as diretrizes WCAG 2.1. O que foi aplicado:

| Diretriz | O que foi feito |
|----------|-----------------|
| Não depender só da cor | A cor do cliente vem sempre acompanhada de uma frase, como "Atrasado · 42 dias sem visita", e de uma etiqueta com o nome da situação |
| Contraste | Os textos têm contraste de pelo menos 4,5 para 1 com o fundo. Os tons usados em textos coloridos foram escurecidos para chegar a esse valor |
| Teclado | Botões, abas, campos e menus são alcançados e acionados pelo teclado, com o foco sempre visível |
| Janelas e painéis | Cada diálogo prende o foco enquanto está aberto, fecha com a tecla Esc e devolve o foco a quem o abriu |
| Leitores de tela | Os botões só com ícone têm rótulo escrito, os erros de formulário são ligados ao campo, e a página declara o idioma português do Brasil |
| Gráficos | Os quatro gráficos do painel (resultado das visitas, ritmo de visitas, distribuição por cor e vendas por mês) têm uma tabela equivalente, lida pelos leitores de tela. O ranking é uma lista numerada e, no mapa, cada cidade é um botão com nome descritivo |
| Tamanho da tela | O layout se adapta do celular ao computador |
| Movimento | As animações são reduzidas para quem pede menos movimento nas configurações do aparelho |

Os testes da interface ajudam a manter isso. Eles procuram cada elemento pelo papel (botão, campo, aba) e pelo rótulo, da mesma forma que um leitor de tela.

O sistema não passou por uma auditoria externa de acessibilidade nem por testes com pessoas com deficiência.

## 5. Licenças

O código do ChokoCRM é distribuído sob a licença MIT, cujo texto está no arquivo [LICENSE](../LICENSE). As bibliotecas usadas são de código aberto, com licenças que permitem o uso neste projeto, e estão listadas nos arquivos `backend/package.json` e `frontend/package.json`. O contorno de Santa Catarina e dos municípios vem da API de malhas do IBGE, que é de dados públicos. As coordenadas dos municípios vêm do projeto de código aberto municipios-brasileiros, de Kelvin S. do Prado, distribuído sob a licença MIT. O aviso de licença desse projeto está mantido no arquivo `frontend/src/lib/municipiosSC.ts`.

## 6. O que falta para o uso com dados reais

O projeto foi entregue com dados de demonstração. Antes de a empresa usar o sistema com os dados reais de clientes e contatos, estes pontos precisam ser resolvidos:

- ligar o ChokoCRM ao sistema de gestão da empresa (ERP) por uma API, para que ao menos os clientes cadastrados lá cheguem automaticamente, sem depender da importação das notas fiscais. É a melhoria futura descrita em [Arquitetura](arquitetura.md#melhoria-futura-integração-com-o-sistema-de-gestão);
- publicar uma política de privacidade e indicar na empresa quem responde pelos pedidos das pessoas sobre os próprios dados;
- trocar as senhas de demonstração, que são públicas, por senhas individuais;
- mover o ambiente do Azure para uma região no Brasil. Hoje ele fica no Canadá, por causa do crédito estudantil;
- criar a exclusão definitiva de um cliente e dos dados dele. Hoje o cliente é apenas inativado, e o histórico é mantido;
- definir com a empresa por quanto tempo o histórico de visitas deve ser guardado.
