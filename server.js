const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());
app.use(express.json({ limit: '50mb' }));

async function chamarClaude(prompt, maxTokens) {
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
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  let text = data.content?.map(i => i.text || '').join('') || '';
  return text.replace(/```json|```/g, '').trim();
}

app.post('/gerar', async (req, res) => {
  try {
    let { transcricao } = req.body;
    if (!transcricao) return res.status(400).json({ erro: 'Transcrição obrigatória' });

    // Limitar tamanho para evitar erros — pegar os primeiros 8000 caracteres
    if (transcricao.length > 8000) {
      transcricao = transcricao.substring(0, 8000);
    }

    // ETAPA 1 — Resumir transcrição
    const resumo = await chamarClaude(
      `Você é especialista em psicoterapia e constelação sistêmica. Leia esta transcrição de sessão terapêutica e extraia um resumo clínico detalhado incluindo: estado emocional, temas abordados, falas marcantes, insights, avanços, dificuldades, intervenções, combinados, e padrões sistêmicos familiares.\n\nTRANSCRIÇÃO:\n${transcricao}`,
      1200
    );

    // ETAPA 2 — Gerar JSON
    const jsonPrompt = `Com base neste resumo de sessão terapêutica, gere um JSON. Retorne APENAS JSON válido, sem markdown, sem texto extra.\n\nRESUMO:\n${resumo}\n\nEstrutura:\n{"clinico":{"estado_emocional":"texto","humor_geral":"positivo","temas_principais":["t1","t2"],"conteudo_sessao":"texto","insights_avancos":["i1"],"dificuldades_resistencias":["d1"],"intervencoes_utilizadas":["i1"],"tarefas_casa":["t1"],"proximos_passos":["p1"],"observacoes_terapeuta":"texto"},"sistemico":{"padroes_identificados":["p1"],"lealdades_invisiveis":["l1"],"campos_familiares":"texto","movimentos_necessarios":["m1"],"hipotese_sistemica":"texto"},"mensagem_cliente":{"saudacao":"texto","resumo_sessao":"texto","reconhecimento":"texto","pratica_semana":{"titulo":"texto","descricao":"texto"},"acoes":["a1","a2"],"mensagem_encorajamento":"texto","assinatura":"Até a nossa próxima sessão! 💛"}}`;

    const resultado = await chamarClaude(jsonPrompt, 1800);
    const dados = JSON.parse(resultado);
    res.json({ ok: true, dados });

  } catch (err) {
    console.error('Erro:', err.message);
    res.status(500).json({ erro: err.message || 'Erro ao gerar relatório' });
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', servico: 'Gerador de Relatórios Terapêuticos' });
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
