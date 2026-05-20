const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.options('*', cors());
app.use(express.json({ limit: '50mb' }));

async function chamarClaude(conteudo, maxTokens) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: conteudo }]
    })
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.map(i => i.text || '').join('') || '';
}

function extrairLista(texto, marcador) {
  const linhas = texto.split('\n');
  const itens = [];
  for (const linha of linhas) {
    const l = linha.trim();
    if (l.startsWith('-') || l.startsWith('•') || l.startsWith('*') || /^\d+\./.test(l)) {
      const item = l.replace(/^[-•*\d.]+\s*/, '').trim();
      if (item.length > 0) itens.push(item);
    }
  }
  return itens.length > 0 ? itens : [texto.trim().substring(0, 200)];
}

app.post('/gerar', async (req, res) => {
  try {
    let { transcricao } = req.body;
    if (!transcricao) return res.status(400).json({ erro: 'Transcrição obrigatória' });

    if (transcricao.length > 5000) {
      transcricao = transcricao.substring(0, 5000);
    }

    // Uma única chamada pedindo tudo em formato de texto simples
    const resposta = await chamarClaude(
      `Analise esta transcrição de sessão terapêutica e responda em seções numeradas exatamente como abaixo. Seja conciso.

TRANSCRIÇÃO:
${transcricao}

RESPONDA ASSIM:
1. ESTADO_EMOCIONAL: [uma frase descrevendo o estado emocional]
2. HUMOR: [positivo/neutro/desafiador/em crise]
3. TEMAS: [tema1] | [tema2] | [tema3]
4. RESUMO_SESSAO: [2-3 frases sobre o que foi trabalhado]
5. INSIGHTS: [insight1] | [insight2] | [insight3]
6. DIFICULDADES: [dificuldade1] | [dificuldade2]
7. INTERVENCOES: [intervenção1] | [intervenção2]
8. TAREFAS: [tarefa1] | [tarefa2]
9. PROXIMOS_PASSOS: [passo1] | [passo2]
10. OBSERVACOES: [observações clínicas em 2 frases]
11. PADROES_SISTEMICOS: [padrão1] | [padrão2]
12. LEALDADES: [lealdade1] | [lealdade2]
13. CAMPOS_FAMILIARES: [descrição em 1-2 frases]
14. MOVIMENTOS: [movimento1] | [movimento2]
15. HIPOTESE: [hipótese sistêmica em 2 frases]
16. SAUDACAO: [saudação acolhedora com o nome da cliente]
17. RESUMO_CLIENTE: [2 frases calorosas sem jargão clínico]
18. RECONHECIMENTO: [uma frase reconhecendo avanço da cliente]
19. PRATICA_TITULO: [nome curto da prática para a semana]
20. PRATICA_DESC: [instrução clara em 2-3 frases]
21. ACOES: [ação1] | [ação2] | [ação3]
22. ENCORAJAMENTO: [frase de encorajamento]`,
      2000
    );

    // Parsear as seções
    function extrairSecao(texto, numero) {
      const regex = new RegExp(`${numero}\\.\\s*[A-Z_]+:\\s*(.+?)(?=\\n\\d+\\.|$)`, 's');
      const match = texto.match(regex);
      return match ? match[1].trim() : '';
    }

    function extrairLista2(texto, numero) {
      const valor = extrairSecao(texto, numero);
      if (!valor) return [];
      return valor.split('|').map(s => s.trim()).filter(s => s.length > 0);
    }

    const dados = {
      clinico: {
        estado_emocional: extrairSecao(resposta, 1),
        humor_geral: extrairSecao(resposta, 2).toLowerCase() || 'neutro',
        temas_principais: extrairLista2(resposta, 3),
        conteudo_sessao: extrairSecao(resposta, 4),
        insights_avancos: extrairLista2(resposta, 5),
        dificuldades_resistencias: extrairLista2(resposta, 6),
        intervencoes_utilizadas: extrairLista2(resposta, 7),
        tarefas_casa: extrairLista2(resposta, 8),
        proximos_passos: extrairLista2(resposta, 9),
        observacoes_terapeuta: extrairSecao(resposta, 10)
      },
      sistemico: {
        padroes_identificados: extrairLista2(resposta, 11),
        lealdades_invisiveis: extrairLista2(resposta, 12),
        campos_familiares: extrairSecao(resposta, 13),
        movimentos_necessarios: extrairLista2(resposta, 14),
        hipotese_sistemica: extrairSecao(resposta, 15)
      },
      mensagem_cliente: {
        saudacao: extrairSecao(resposta, 16),
        resumo_sessao: extrairSecao(resposta, 17),
        reconhecimento: extrairSecao(resposta, 18),
        pratica_semana: {
          titulo: extrairSecao(resposta, 19),
          descricao: extrairSecao(resposta, 20)
        },
        acoes: extrairLista2(resposta, 21),
        mensagem_encorajamento: extrairSecao(resposta, 22),
        assinatura: 'Até a nossa próxima sessão! 💛'
      }
    };

    res.json({ ok: true, dados });

  } catch (err) {
    console.error('Erro:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', servico: 'Gerador de Relatórios Terapêuticos' });
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
