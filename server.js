const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

async function chamarClaude(mensagens, maxTokens) {
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
      messages: mensagens
    })
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  let text = data.content?.map(i => i.text || '').join('') || '';
  return text.replace(/```json|```/g, '').trim();
}

app.post('/gerar', async (req, res) => {
  const { transcricao } = req.body;
  if (!transcricao) return res.status(400).json({ erro: 'Transcrição obrigatória' });

  try {
    // ETAPA 1 — Resumir transcrição
    const resumo = await chamarClaude([{
      role: 'user',
      content: `Você é especialista em psicoterapia e constelação sistêmica. Leia esta transcrição de sessão terapêutica e extraia um resumo clínico detalhado incluindo: estado emocional, temas abordados, falas marcantes, insights, avanços, dificuldades, intervenções, combinados, e especialmente padrões sistêmicos familiares (lealdades, emaranhamentos, repetições de padrões entre gerações).\n\nTRANSCRIÇÃO:\n${transcricao}`
    }], 1500);

    // ETAPA 2 — Gerar JSON completo
    const resultado = await chamarClaude([{
      role: 'user',
      content: `Com base neste resumo de sessão terapêutica, gere um JSON completo. Retorne APENAS JSON válido, sem markdown.\n\nRESUMO:\n${resumo}\n\n{\n  "clinico": {\n    "estado_emocional": "1-2 frases",\n    "humor_geral": "positivo|neutro|desafiador|em crise",\n    "temas_principais": ["tema1","tema2"],\n    "conteudo_sessao": "3-5 frases narrativas",\n    "insights_avancos": ["insight1","insight2"],\n    "dificuldades_resistencias": ["dificuldade1"],\n    "intervencoes_utilizadas": ["intervenção1"],\n    "tarefas_casa": ["tarefa1"],\n    "proximos_passos": ["passo1","passo2"],\n    "observacoes_terapeuta": "2-3 frases clínicas"\n  },\n  "sistemico": {\n    "padroes_identificados": ["padrão sistêmico 1","padrão 2"],\n    "lealdades_invisiveis": ["lealdade ou repetição familiar 1"],\n    "campos_familiares": "descrição de dinâmicas familiares percebidas (2-3 frases)",\n    "movimentos_necessarios": ["movimento sistêmico sugerido 1","movimento 2"],\n    "hipotese_sistemica": "hipótese clínica sistêmica sobre o caso (2-3 frases)"\n  },\n  "mensagem_cliente": {\n    "saudacao": "Saudação acolhedora com o primeiro nome",\n    "resumo_sessao": "2-3 frases calorosas sem jargão clínico",\n    "reconhecimento": "Uma frase reconhecendo avanço ou esforço",\n    "pratica_semana": {\n      "titulo": "nome curto da prática",\n      "descricao": "instrução clara e acolhedora em 3-5 frases"\n    },\n    "acoes": ["ação concreta 1","ação 2","ação 3"],\n    "mensagem_encorajamento": "frase de encorajamento",\n    "assinatura": "Até a nossa próxima sessão! 💛"\n  }\n}`
    }], 2000);

    const dados = JSON.parse(resultado);
    res.json({ ok: true, dados });

  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: err.message || 'Erro ao gerar relatório' });
  }
});

app.get('/', (req, res) => res.json({ status: 'ok', servico: 'Gerador de Relatórios Terapêuticos' }));

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
