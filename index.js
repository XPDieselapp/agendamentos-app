require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function registrarLog(mensagem) {
  const dataHora = new Date().toISOString();
  const logFormatado = `[${dataHora}] ${mensagem}\n`;
  fs.appendFile('logs-agendamentos.log', logFormatado, (err) => {
    if (err) console.error('Erro ao gravar log:', err);
  });
}

// 🔧 Função auxiliar para obter IP de forma limpa
function obterIP(req) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  return ip.replace(/^.*:/, '') || 'desconhecido';
}

// 🔍 Rota de teste de conexão com o Supabase
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'Conexão com banco bem-sucedida!', hora: result.rows[0].now });
  } catch (error) {
    console.error('Erro ao conectar no banco:', error);
    res.status(500).send('Erro ao conectar no banco de dados');
  }
});

// Listar agendamentos
app.get('/agendamentos', async (req, res) => {
  const result = await pool.query('SELECT * FROM agendamentos ORDER BY horario');
  res.json(result.rows);
});

// Criar agendamento
app.post('/agendamentos', async (req, res) => {
  const { setor, horario, nome, tecnico, modelo } = req.body;
  const ip = obterIP(req);

  await pool.query(
    'INSERT INTO agendamentos (setor, horario, nome, tecnico, modelo) VALUES ($1, $2, $3, $4, $5)',
    [setor, horario, nome, tecnico, modelo]
  );

  registrarLog(`IP ${ip} criou um novo agendamento para ${nome} (${setor})`);
  res.status(201).send({ status: 'Agendado com sucesso' });
});

// Excluir agendamento
app.delete('/agendamentos/:id', async (req, res) => {
  const { id } = req.params;
  const ip = obterIP(req);

  await pool.query('DELETE FROM agendamentos WHERE id = $1', [id]);

  registrarLog(`IP ${ip} excluiu o agendamento ID ${id}`);
  res.send({ status: 'Agendamento excluído' });
});

// Editar agendamento
app.put('/agendamentos/:id', async (req, res) => {
  const { id } = req.params;
  const { setor, nome, tecnico, horario, atendido, modelo } = req.body;
  const ip = obterIP(req);

  const query = [];
  const values = [];
  let i = 1;

  if (setor !== undefined) {
    query.push(`setor = $${i++}`);
    values.push(setor);
  }
  if (nome !== undefined) {
    query.push(`nome = $${i++}`);
    values.push(nome);
  }
  if (tecnico !== undefined) {
    query.push(`tecnico = $${i++}`);
    values.push(tecnico);
  }
  if (horario !== undefined) {
    query.push(`horario = $${i++}`);
    values.push(horario);
  }
  if (atendido !== undefined) {
    query.push(`atendido = $${i++}`);
    values.push(atendido);
  }
  if (modelo !== undefined) {
    query.push(`modelo = $${i++}`);
    values.push(modelo);
  }

  if (query.length === 0) return res.status(400).send({ erro: "Nenhum campo enviado" });

  values.push(id);

  await pool.query(
    `UPDATE agendamentos SET ${query.join(', ')} WHERE id = $${i}`,
    values
  );

  registrarLog(`IP ${ip} editou o agendamento ID ${id} com os dados: ${JSON.stringify(req.body)}`);
  res.send({ status: 'Atualizado com sucesso' });
});

// Atualizar status de atendimento
app.put('/agendamentos/:id/atendido', async (req, res) => {
  const { id } = req.params;
  const { atendido } = req.body;
  const ip = obterIP(req);

  try {
    await pool.query('UPDATE agendamentos SET atendido = $1 WHERE id = $2', [atendido, id]);

    registrarLog(`IP ${ip} atualizou 'atendido' para ${atendido} no agendamento ID ${id}`);
    res.send({ status: 'Atualizado com sucesso' });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao atualizar status');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});




