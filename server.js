const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.options('*', cors());
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
  try {
    let { transcricao } = req.body;
    if (!transcricao) return res.status(400).json({ erro: 'Transcrição obrigatória' });

    // Limitar a 6000 caracteres
    if (transcricao.length > 6000) {
      transcricao = transcricao.substring(0, 6000);
    }

    // ETAPA 1 — Resumir
    const resumoMensagens = [
      {
        role: 'user',
        content: 'Você é especialista em psicoterapia e constelação sistêmica. Leia esta transcrição e extraia um resumo clínico detalhado: estado emocional, temas, insights, avanços, dificuldades, intervenções, combinados e padrões sistêmicos familiares.'
      },
      {
        role: 'assistant',
        content: 'Entendido. Pode enviar a transcrição.'
      },
      {
        role: 'user',
        content: transcricao
      }
    ];

    const resumo = await chamarClaude(resumoMensagens, 1200);

    // ETAPA 2 — Gerar JSON estruturado
    const jsonMensagens = [
      {
        role: 'user',
        content: `Com base neste resumo de sessão terapêutica, gere um JSON. Retorne APENAS o JSON, sem texto antes ou depois, sem markdown.\n\nRESUMO: ${resumo}\n\nEstrutura exata:\n{"clinico":{"estado_emocional":"","humor_geral":"positivo","temas_principais":[],"conteudo_sessao":"","insights_avancos":[],"dificuldades_resistencias":[],"intervencoes_utilizadas":[],"tarefas_casa":[],"proximos_passos":[],"observacoes_terapeuta":""},"sistemico":{"padroes_identificados":[],"lealdades_invisiveis":[],"campos_familiares":"","movimentos_necessarios":[],"hipotese_sistemica":""},"mensagem_cliente":{"saudacao":"","resumo_sessao":"","reconhecimento":"","pratica_semana":{"titulo":"","descricao":""},"acoes":[],"mensagem_encorajamento":"","assinatura":"Até a nossa próxima sessão! 💛"}}`
      }
    ];

    const resultado = await chamarClaude(jsonMensagens, 1800);

    let dados;
    try {
      dados = JSON.parse(resultado);
    } catch(parseErr) {
      // Tentar extrair JSON do texto
      const match = resultado.match(/\{[\s\S]*\}/);
      if (match) {
        dados = JSON.parse(match[0]);
      } else {
        throw new Error('Resposta inválida da IA');
      }
    }

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
