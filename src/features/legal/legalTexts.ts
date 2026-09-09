/**
 * Textos legais exibidos no app (LGPD — issue #36).
 *
 * `LEGAL_VERSION` é gravada em profiles.terms_version e
 * participants.guardian_consent_version: mudar o texto de forma material
 * exige subir a versão, o que faz a ConsentScreen pedir novo aceite.
 *
 * Os campos entre colchetes são do controlador e devem ser preenchidos antes
 * de aceitar usuários externos. `LEGAL_IS_DRAFT` mostra um aviso de rascunho
 * até a revisão jurídica — vire para false depois dela.
 */
export const LEGAL_VERSION = '2026-09';
export const LEGAL_IS_DRAFT = true;

export const CONTROLLER = {
  name: '[NOME DO CONTROLADOR / EMPRESA]',
  contactEmail: '[E-MAIL DO ENCARREGADO (DPO)]',
  productName: 'Nogária Travel',
};

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

export interface LegalDocument {
  id: 'privacy' | 'terms';
  title: string;
  updatedAt: string;
  sections: LegalSection[];
}

export const PRIVACY_POLICY: LegalDocument = {
  id: 'privacy',
  title: 'Política de Privacidade',
  updatedAt: '09/09/2026',
  sections: [
    {
      title: '1. Quem somos e como falar conosco',
      paragraphs: [
        `${CONTROLLER.productName} é uma plataforma de organização de viagens em família operada por ${CONTROLLER.name}, que atua como controladora dos dados pessoais tratados no serviço, nos termos da Lei nº 13.709/2018 (LGPD).`,
        `Encarregado pelo tratamento de dados (DPO): ${CONTROLLER.contactEmail}. Use este canal para exercer qualquer direito descrito na seção 7.`,
      ],
    },
    {
      title: '2. Quais dados coletamos',
      paragraphs: [
        'Dados de conta: e-mail, nome e, quando você entra com o Google, o identificador e a foto fornecidos por ele.',
        'Dados dos participantes da viagem, informados por você: nome, apelido, data de nascimento, altura, relação familiar, número e validade do passaporte, restrições alimentares, telefone do WhatsApp, limite de orçamento e avatar.',
        'Dados da viagem: voos, hospedagens, transportes, roteiro, compras, despesas, tarefas, decisões, documentos (apenas links) e ideias.',
        'Dados do assistente no WhatsApp: as mensagens trocadas com o bot, o número de telefone remetente e, quando você compartilha, a sua localização para calcular rotas.',
        'Dados de uso da IA: tokens consumidos, modelo, latência e custo estimado de cada chamada, para controle de franquia e de custo.',
      ],
    },
    {
      title: '3. Dados de crianças e adolescentes',
      paragraphs: [
        'O serviço trata, por natureza, dados de menores (data de nascimento, altura e telefone), usados exclusivamente para alertas de restrição de atrações, cobertura do roteiro e entrega de avisos.',
        'Conforme o art. 14 da LGPD, esses dados só são tratados com o consentimento específico e em destaque de um dos pais ou responsável legal, colhido no momento do cadastro do participante menor e registrado com data, hora e identificação de quem consentiu.',
        'Ao assistente de IA enviamos o mínimo necessário: apenas se o participante é menor e a sua altura — nunca a data de nascimento exata, o passaporte ou outros identificadores.',
      ],
    },
    {
      title: '4. Para que usamos os dados e com que base legal',
      paragraphs: [
        'Prestar o serviço contratado (execução de contrato): organizar a viagem, gerar auditorias, enviar o roteiro e avisos pelo WhatsApp e responder perguntas pelo assistente.',
        'Consentimento: dados de menores (seção 3) e localização compartilhada no WhatsApp.',
        'Legítimo interesse: segurança da plataforma, prevenção de abuso e medição de custo de uso da IA.',
        'Não vendemos dados pessoais nem os usamos para publicidade.',
      ],
    },
    {
      title: '5. Com quem compartilhamos',
      paragraphs: [
        'Supabase (banco de dados, autenticação e funções), hospedado na região us-west-2 (Estados Unidos).',
        'Vercel (hospedagem da aplicação web).',
        'Google (Gemini) para o assistente de IA, recebendo apenas o contexto mínimo da viagem descrito na seção 3; Google Maps para rotas quando você pede.',
        'Meta (WhatsApp Cloud API) para enviar e receber mensagens do assistente.',
        'Banco Central do Brasil (cotação PTAX) e AwesomeAPI (cotação de mercado) — consultas sem dados pessoais.',
      ],
    },
    {
      title: '6. Transferência internacional',
      paragraphs: [
        'Os dados são armazenados e processados nos Estados Unidos pelos operadores listados na seção 5, com base no art. 33 da LGPD e nas cláusulas contratuais padrão desses provedores. Ao usar o serviço você está ciente dessa transferência.',
      ],
    },
    {
      title: '7. Seus direitos',
      paragraphs: [
        'Você pode, a qualquer momento: confirmar a existência de tratamento, acessar, corrigir, anonimizar ou eliminar seus dados, revogar o consentimento e solicitar portabilidade.',
        'Dentro do app: edite ou exclua participantes, viagens e registros nas próprias telas. Um administrador pode excluir a organização inteira em Conta → Privacidade e dados, o que apaga todos os dados dela, inclusive as mensagens do WhatsApp e os registros de uso da IA.',
        `Para pedidos que não caibam nas telas (por exemplo, exclusão da conta de login), escreva para ${CONTROLLER.contactEmail}. Respondemos em até 15 dias.`,
      ],
    },
    {
      title: '8. Por quanto tempo guardamos',
      paragraphs: [
        'Dados da viagem: enquanto a organização existir ou até você apagá-los.',
        'Mensagens do assistente no WhatsApp: apagadas automaticamente 90 dias após o fim da última viagem da organização (prazo configurável pelo administrador entre 7 e 730 dias). Os registros de custo da IA são mantidos, mas o número de telefone neles é anonimizado no mesmo prazo.',
        'Dados de conta: até a exclusão da conta.',
      ],
    },
    {
      title: '9. Segurança',
      paragraphs: [
        'Todo acesso ao banco passa por políticas de isolamento por organização (row level security): um usuário só enxerga os dados das organizações de que é membro. As credenciais são gerenciadas pelo provedor de autenticação; não armazenamos senhas.',
      ],
    },
    {
      title: '10. Alterações',
      paragraphs: [
        'Mudanças materiais nesta política vêm com nova versão e pedem novo aceite ao entrar no app.',
      ],
    },
  ],
};

export const TERMS_OF_USE: LegalDocument = {
  id: 'terms',
  title: 'Termos de Uso',
  updatedAt: '09/09/2026',
  sections: [
    {
      title: '1. O serviço',
      paragraphs: [
        `${CONTROLLER.productName} ajuda famílias e pequenos grupos a planejar e acompanhar viagens: roteiro, logística, finanças, auditoria de restrições e um assistente por WhatsApp.`,
        'O serviço é fornecido "como está". Informações geradas pelo assistente de IA (horários, valores, sugestões) podem conter erros e não substituem a confirmação junto às companhias, hotéis e parques.',
      ],
    },
    {
      title: '2. Conta e responsabilidades',
      paragraphs: [
        'Você precisa ter 18 anos ou mais para criar uma conta e ser administrador de uma organização.',
        'Ao cadastrar outras pessoas (adultos ou menores) você declara ter autorização para isso. No caso de menores, declara ser um dos pais ou responsável legal, ou agir com a autorização deles.',
        'Você é responsável pela exatidão dos dados informados e por manter seu acesso seguro.',
      ],
    },
    {
      title: '3. Assistente no WhatsApp',
      paragraphs: [
        'O assistente responde apenas a números cadastrados como participantes. Cada plano tem uma franquia mensal de mensagens; ao atingi-la, o assistente avisa e pausa até a renovação.',
        'Confirmações de alterações no roteiro pelo WhatsApp são feitas em duas etapas; a plataforma não se responsabiliza por alterações confirmadas pelo próprio usuário.',
      ],
    },
    {
      title: '4. Uso aceitável',
      paragraphs: [
        'É proibido usar o serviço para fins ilícitos, tentar acessar dados de outras organizações, sobrecarregar a plataforma ou revender o acesso sem autorização.',
      ],
    },
    {
      title: '5. Privacidade',
      paragraphs: [
        'O tratamento de dados pessoais é descrito na Política de Privacidade, que integra estes termos.',
      ],
    },
    {
      title: '6. Encerramento',
      paragraphs: [
        'Você pode excluir sua organização a qualquer momento. Podemos suspender contas que violem estes termos, com aviso prévio sempre que possível.',
      ],
    },
    {
      title: '7. Lei aplicável',
      paragraphs: [
        'Estes termos são regidos pela legislação brasileira. Fica eleito o foro do domicílio do usuário para dirimir controvérsias.',
      ],
    },
  ],
};
