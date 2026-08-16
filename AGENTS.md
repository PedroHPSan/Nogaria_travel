# Clean Code & Padrão de Desenvolvimento Universal (clean-dev)

Instruções e diretrizes de desenvolvimento para o assistente de código atuar com máxima eficiência, precisão e qualidade técnica.

---

## 1. Economia de Contexto

> **Regra mãe:** Descubra o alvo com busca direcionada, nunca com leitura cega de arquivos inteiros.

- **Busca antes da leitura:** Use `grep`/`rg` ou índices para localizar o ponto de mudança. Abra arquivos apenas sabendo a linha aproximada e leia apenas o trecho necessário.
- **Arquivos grandes:** Nunca leia arquivos > 300 linhas sem alvo definido. Nunca leia lockfiles, pastas de build (`dist/`, `.next/`, `build/`), `node_modules`, snapshots ou migrações antigas em bloco.
- **Sem releitura desnecessária:** Não releia arquivos recém-editados para conferência visual se a ferramenta de edição já confirmou a aplicação do diff.
- **Comandos eficientes:** Prefira comandos compostos e filtre saídas extensas na origem (`| tail -30`, `--reporter=dot`, `-q`).
- **Respostas enxutas:** Ao reportar, cite `caminho:linha` e o que mudou. Não reproduza o arquivo inteiro editado na resposta.

---

## 2. Estilo de Resposta e Comunicação

- **Direto ao ponto:** Sem preâmbulos dispensáveis ("Ótima pergunta", "Vou analisar...") e sem resumos finais repetindo o que acabou de ser feito.
- **Respostas concisas:** Perguntas diretas merecem respostas objetivas de uma a três frases.
- **Ação imediata:** Não narre antecipadamente o que vai fazer; execute a ação e reporte o resultado comprovado.
- **Sem listas desnecessárias:** Evite sugerir listas de "próximos passos" a menos que expressamente solicitado pelo usuário.
- **Resolução de ambiguidades simples:** Se duas interpretações de um pedido demandam o mesmo volume de trabalho, escolha a mais lógica, execute e informe em uma linha.

---

## 3. O Loop de Trabalho (5 Etapas)

Toda tarefa de código deve seguir estas cinco etapas estruturadas:

1. **Enquadrar:** Resuma em uma frase o que muda, onde muda e como se comprova o funcionamento.
2. **Localizar:** Mapeie o ponto de mudança e seus chamadores. Verifique se já existem helpers, hooks, tipos, schemas de validação ou componentes reutilizáveis antes de criar novos.
3. **Implementar:** Aplique a menor alteração suficiente que resolva o problema por completo. Mantenha o idioma, estilo e convenções dos arquivos vizinhos.
4. **Provar:** Nunca declare a tarefa pronta sem evidência objetiva: `typecheck`/`build` → teste unitário/integração do arquivo tocado → `lint`.
5. **Fechar:** Três a cinco linhas com: (a) o que mudou (`caminho:linha`); (b) comando executado e evidência de sucesso; (c) pendências ou itens fora de escopo (se houver).

---

## 4. Invariantes Arquiteturais

- **Multi-Tenant e RLS:** Toda query respeita o escopo do tenant. Nunca dependa apenas de filtros no cliente; garanta RLS ativa e políticas declaradas no banco.
- **Fronteira de Dados:** Qualquer dado externo (respostas de API, formulários, payloads de webhook/funções serverless, variáveis de ambiente) deve ser validado via schema rígido (ex: Zod). Proibido usar `any` ou type cast cego (`as`) na fronteira.
- **Segurança de Segredos:** Credenciais, tokens e service-role keys nunca devem ser hardcoded em arquivos versionados, logs, testes ou bundles clientes. Utilize sempre `.env` e variáveis de ambiente.
- **Migrações de Banco:** Mudanças de schema devem ser sempre versionadas em arquivos de migração.
- **Separação de Camadas:** Dependências fluem do domínio mais genérico/núcleo para os clientes/apps, nunca no sentido inverso.

---

## 5. Diretrizes de Clean Code

### TypeScript
- Proibido `any` em código novo; utilize `unknown` associado a type guards / narrowing.
- Evite casts `as unknown as T`. Casts `as T` devem conter justificativa explícita quando inevitáveis.
- Prefira Uniões Discriminadas em vez de múltiplas flags booleanas independentes:
  `{ status: 'loading' } | { status: 'ok'; data: T } | { status: 'error'; error: E }`
- Prefira objetos `as const` com `typeof` em vez de `enum`.
- Schemas Zod: derive tipos diretamente via `z.infer<typeof schema>` para evitar duplicação manual.

### React
- **Componentes focados:** Um componente por responsabilidade visual (< 150 linhas; decomponha seções maiores).
- **Interface enxuta:** Limite a quantidade de props (~6 no máximo).
- **Separação de lógica e visual:** Mantenha regras de negócio em hooks customizados ou funções puras.
- **Acessibilidade básica:** Elementos clicáveis com ação devem ser `<button>`; nunca use `<div onClick={...}>`.

### Backend, APIs e Banco de Dados
- Centralize o acesso a dados em serviços ou repositórios; evite chamadas diretas a drivers/clientes de banco espalhadas nos componentes visuais.
- Evite `SELECT *` em rotas e endpoints de alto tráfego; projete apenas as colunas necessárias.
- Valide inputs na primeira linha dos handlers de API com schemas estritos e retorne erros padronizados com status HTTP adequados.
