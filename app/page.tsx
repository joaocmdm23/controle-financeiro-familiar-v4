'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

const supabaseUrl = 'https://ngufymowogsointtuqvq.supabase.co';
const supabaseKey = 'sb_publishable_co3p8eEt5i7DVySINMi0uw_GzT6H6l9';
const supabase = createClient(supabaseUrl, supabaseKey);

const CORES_GRAFICO_CLARO = [
  '#3B82F6',
  '#EC4899',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
];
const CORES_GRAFICO_ESCURO = [
  '#60A5FA',
  '#F472B6',
  '#34D399',
  '#FBBF24',
  '#A78BFA',
];

export default function Home() {
  const [abaAtiva, setAbaAtiva] = useState<'cadastro' | 'tabela' | 'resumo'>(
    'cadastro'
  );
  const [transacoes, setTransacoes] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [novaCategoria, setNovaCategoria] = useState('');

  // Modo Noturno (Dark Mode)
  const [modoEscuro, setModoEscuro] = useState(false);

  // Filtro de Mês (Formato YYYY-MM)
  const dataAtual = new Date();
  const mesAtualStr = `${dataAtual.getFullYear()}-${String(
    dataAtual.getMonth() + 1
  ).padStart(2, '0')}`;
  const [mesSelecionado, setMesSelecionado] = useState(mesAtualStr);

  // Filtro de Forma de Pagamento na Tabela
  const [filtroPagamento, setFiltroPagamento] = useState<
    'todos' | 'pix' | 'debito' | 'credito_atual' | 'credito_seguinte'
  >('todos');

  // Form Estado
  const [responsavel, setResponsavel] = useState<'João' | 'Lorraine'>('João');
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('saida');
  const [valor, setValor] = useState('');
  const [recebidoDe, setRecebidoDe] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('pix');
  const [referenteA, setReferenteA] = useState('');
  const [finalidade, setFinalidade] = useState('Família');
  const [tipoCredito, setTipoCredito] = useState<'a_vista' | 'parcelado'>(
    'a_vista'
  );
  const [qtdParcelas, setQtdParcelas] = useState<number | string>(2);

  useEffect(() => {
    carregarTransacoes();
    carregarCategorias();
  }, []);

  async function carregarTransacoes() {
    const { data, error } = await supabase
      .from('transacoes')
      .select('*')
      .order('data_hora', { ascending: false });
    if (error) console.error('Erro Supabase:', error);
    if (data) setTransacoes(data);
  }

  async function carregarCategorias() {
    const { data } = await supabase.from('categorias').select('*');
    if (data) setCategorias(data);
  }

  // Função para determinar o ciclo da fatura do cartão baseado no dia 04
  function obterTagFatura(dataIso: string) {
    const data = new Date(dataIso);
    const dia = data.getDate();
    return dia <= 4 ? 'mes_atual' : 'mes_seguinte';
  }

  async function salvarTransacao(e: React.FormEvent) {
    e.preventDefault();
    const valorTotal = parseFloat(valor);

    if (isNaN(valorTotal) || valorTotal <= 0) {
      alert('Digite um valor válido!');
      return;
    }

    const agora = new Date();

    if (tipo === 'entrada') {
      await supabase.from('transacoes').insert([
        {
          data_hora: agora.toISOString(),
          responsavel,
          tipo: 'entrada',
          valor: valorTotal,
          recebido_de: recebidoDe,
          finalidade: 'Família',
        },
      ]);
    } else {
      if (formaPagamento === 'credito' && tipoCredito === 'parcelado') {
        const numParcelas = Number(qtdParcelas);
        const valorParcela = valorTotal / numParcelas;
        const grupoId = crypto.randomUUID();
        const listaParcelas = [];

        for (let i = 0; i < numParcelas; i++) {
          const dataParcela = new Date(
            agora.getFullYear(),
            agora.getMonth() + i,
            agora.getDate(),
            12,
            0,
            0
          );

          listaParcelas.push({
            data_hora: dataParcela.toISOString(),
            responsavel,
            tipo: 'saida',
            valor: valorParcela,
            forma_pagamento: 'credito',
            referente_a: referenteA || 'Geral',
            finalidade,
            tipo_credito: 'parcelado',
            parcela_atual: i + 1,
            total_parcelas: numParcelas,
            grupo_parcela_id: grupoId,
          });
        }
        await supabase.from('transacoes').insert(listaParcelas);
      } else {
        await supabase.from('transacoes').insert([
          {
            data_hora: agora.toISOString(),
            responsavel,
            tipo: 'saida',
            valor: valorTotal,
            forma_pagamento: formaPagamento,
            referente_a: referenteA || 'Geral',
            finalidade,
            tipo_credito: formaPagamento === 'credito' ? 'a_vista' : null,
          },
        ]);
      }
    }

    setValor('');
    setRecebidoDe('');
    setReferenteA('');
    await carregarTransacoes();
    alert('Lançamento salvo com sucesso!');
  }

  async function deletarTransacao(item: any) {
    if (item.grupo_parcela_id) {
      const apagarTudo = confirm(
        `Esta transação é um parcelamento (${item.parcela_atual}/${item.total_parcelas}).\n\n` +
          `Clique em 'OK' para APAGAR TODAS AS PARCELAS deste parcelamento (em todos os meses).\n` +
          `Clique em 'Cancelar' para apagar apenas esta parcela isolada.`
      );

      if (apagarTudo) {
        await supabase
          .from('transacoes')
          .delete()
          .eq('grupo_parcela_id', item.grupo_parcela_id);
      } else {
        if (confirm('Deseja apagar apenas esta parcela deste mês?')) {
          await supabase.from('transacoes').delete().eq('id', item.id);
        } else {
          return;
        }
      }
    } else {
      if (confirm('Deseja realmente apagar este lançamento?')) {
        await supabase.from('transacoes').delete().eq('id', item.id);
      } else {
        return;
      }
    }

    await carregarTransacoes();
  }

  async function adicionarCategoria() {
    if (!novaCategoria) return;
    await supabase.from('categorias').insert([{ nome: novaCategoria }]);
    setNovaCategoria('');
    carregarCategorias();
  }

  // Filtragem por Mês e Forma de Pagamento
  const transacoesFiltradas = transacoes.filter((t) => {
    if (!t.data_hora) return false;
    const mesAno = t.data_hora.substring(0, 7);
    const bateuMes = mesAno === mesSelecionado;

    if (!bateuMes) return false;

    if (filtroPagamento === 'todos') return true;
    if (t.tipo === 'entrada') return false;

    const forma = (t.forma_pagamento || '').toLowerCase();

    if (filtroPagamento === 'pix' || filtroPagamento === 'debito') {
      return forma === filtroPagamento;
    }

    if (forma === 'credito') {
      const cicloFatura = obterTagFatura(t.data_hora);
      if (filtroPagamento === 'credito_atual')
        return cicloFatura === 'mes_atual';
      if (filtroPagamento === 'credito_seguinte')
        return cicloFatura === 'mes_seguinte';
    }

    return false;
  });

  // Cálculos do Mês
  const totalEntradas = transacoesFiltradas
    .filter((t) => t.tipo === 'entrada')
    .reduce((acc, curr) => acc + Number(curr.valor), 0);
  const totalSaidas = transacoesFiltradas
    .filter((t) => t.tipo === 'saida')
    .reduce((acc, curr) => acc + Number(curr.valor), 0);
  const saldoTotal = totalEntradas - totalSaidas;

  const gastosPorFinalidade = transacoesFiltradas
    .filter((t) => t.tipo === 'saida')
    .reduce((acc: Record<string, number>, curr) => {
      acc[curr.finalidade] = (acc[curr.finalidade] || 0) + Number(curr.valor);
      return acc;
    }, {});

  const dadosGrafico = Object.keys(gastosPorFinalidade).map((key) => ({
    name: key,
    value: gastosPorFinalidade[key],
  }));

  const coresAtuais = modoEscuro ? CORES_GRAFICO_ESCURO : CORES_GRAFICO_CLARO;

  // Lógica de Alertas de Fechamento do Cartão (Dia 04)
  const diaHoje = dataAtual.getDate();
  let alertaCartao = null;

  if (diaHoje >= 1 && diaHoje <= 3) {
    alertaCartao = {
      tipo: 'aviso',
      texto:
        '⚠️ Fatura perto do fechamento! Compras até dia 04 entram na fatura deste mês.',
    };
  } else if (diaHoje === 4) {
    alertaCartao = {
      tipo: 'urgente',
      texto: '🔴 Hoje é o fechamento/vencimento da sua fatura do cartão!',
    };
  } else if (diaHoje >= 5 && diaHoje <= 7) {
    alertaCartao = {
      tipo: 'sucesso',
      texto:
        '🟢 Você está no MELHOR DIA DE COMPRA! Fatura fechou e novas compras vão para o mês que vem.',
    };
  }

  // Tag do Formulário para a data atual
  const tagFaturaAtual = diaHoje <= 4 ? 'deste mês' : 'do mês seguinte';

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        modoEscuro ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-800'
      }`}
    >
      <div className="max-w-4xl mx-auto p-4 font-sans">
        {/* Cabeçalho com Seletor de Tema */}
        <header className="mb-4 flex justify-between items-center relative">
          <div className="flex-1 text-center">
            <h1
              className={`text-2xl font-bold ${
                modoEscuro ? 'text-white' : 'text-gray-800'
              }`}
            >
              Controle Financeiro Familiar
            </h1>
            <p
              className={`text-sm ${
                modoEscuro ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              João & Lorraine
            </p>
          </div>

          <button
            type="button"
            onClick={() => setModoEscuro(!modoEscuro)}
            className={`absolute right-0 top-0 p-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors ${
              modoEscuro
                ? 'bg-gray-800 border-gray-700 text-yellow-400 hover:bg-gray-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100 shadow-sm'
            }`}
          >
            {modoEscuro ? '☀️ Claro' : '🌙 Escuro'}
          </button>
        </header>

        {/* Alerta de Fechamento do Cartão */}
        {alertaCartao && (
          <div
            className={`mb-4 p-3 rounded-lg text-xs md:text-sm font-semibold text-center border shadow-sm ${
              alertaCartao.tipo === 'urgente'
                ? 'bg-red-50 border-red-300 text-red-800 dark:bg-red-950/60 dark:border-red-800 dark:text-red-200'
                : alertaCartao.tipo === 'sucesso'
                ? 'bg-green-50 border-green-300 text-green-800 dark:bg-green-950/60 dark:border-green-800 dark:text-green-200'
                : 'bg-yellow-50 border-yellow-300 text-yellow-800 dark:bg-yellow-950/60 dark:border-yellow-800 dark:text-yellow-200'
            }`}
          >
            {alertaCartao.texto}
          </div>
        )}

        {/* Seletor de Mês */}
        <div
          className={`p-3 rounded-lg shadow-sm mb-4 flex items-center justify-between border ${
            modoEscuro
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200'
          }`}
        >
          <label
            className={`font-semibold text-sm ${
              modoEscuro ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            Visualizar Mês:
          </label>
          <input
            type="month"
            value={mesSelecionado}
            onChange={(e) => setMesSelecionado(e.target.value)}
            className={`p-2 border rounded-lg font-bold ${
              modoEscuro
                ? 'bg-gray-700 border-gray-600 text-blue-400'
                : 'bg-gray-50 border-gray-300 text-blue-600'
            }`}
          />
        </div>

        {/* Resumo Financeiro */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div
            className={`p-3 rounded-lg text-center border ${
              modoEscuro
                ? 'bg-green-950/40 border-green-800/50'
                : 'bg-green-50 border-green-200'
            }`}
          >
            <span
              className={`text-xs font-medium block ${
                modoEscuro ? 'text-green-400' : 'text-green-600'
              }`}
            >
              Entradas
            </span>
            <span
              className={`text-lg font-bold ${
                modoEscuro ? 'text-green-400' : 'text-green-700'
              }`}
            >
              R$ {totalEntradas.toFixed(2)}
            </span>
          </div>
          <div
            className={`p-3 rounded-lg text-center border ${
              modoEscuro
                ? 'bg-red-950/40 border-red-800/50'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <span
              className={`text-xs font-medium block ${
                modoEscuro ? 'text-red-400' : 'text-red-600'
              }`}
            >
              Saídas
            </span>
            <span
              className={`text-lg font-bold ${
                modoEscuro ? 'text-red-400' : 'text-red-700'
              }`}
            >
              R$ {totalSaidas.toFixed(2)}
            </span>
          </div>
          <div
            className={`p-3 rounded-lg text-center border ${
              modoEscuro
                ? 'bg-blue-950/40 border-blue-800/50'
                : 'bg-blue-50 border-blue-200'
            }`}
          >
            <span
              className={`text-xs font-medium block ${
                modoEscuro ? 'text-blue-400' : 'text-blue-600'
              }`}
            >
              Saldo do Mês
            </span>
            <span
              className={`text-lg font-bold ${
                saldoTotal >= 0
                  ? modoEscuro
                    ? 'text-blue-400'
                    : 'text-blue-700'
                  : modoEscuro
                  ? 'text-red-400'
                  : 'text-red-700'
              }`}
            >
              R$ {saldoTotal.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Abas Principais */}
        <div
          className={`flex border-b mb-6 rounded-t-lg shadow-sm ${
            modoEscuro
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200'
          }`}
        >
          <button
            type="button"
            className={`flex-1 py-3 font-semibold ${
              abaAtiva === 'cadastro'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : modoEscuro
                ? 'text-gray-400'
                : 'text-gray-500'
            }`}
            onClick={() => setAbaAtiva('cadastro')}
          >
            Novo Lançamento
          </button>
          <button
            type="button"
            className={`flex-1 py-3 font-semibold ${
              abaAtiva === 'tabela'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : modoEscuro
                ? 'text-gray-400'
                : 'text-gray-500'
            }`}
            onClick={() => setAbaAtiva('tabela')}
          >
            Planilha ({transacoesFiltradas.length})
          </button>
          <button
            type="button"
            className={`flex-1 py-3 font-semibold ${
              abaAtiva === 'resumo'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : modoEscuro
                ? 'text-gray-400'
                : 'text-gray-500'
            }`}
            onClick={() => setAbaAtiva('resumo')}
          >
            Resumo & Gráficos
          </button>
        </div>

        {abaAtiva === 'cadastro' && (
          <form
            onSubmit={salvarTransacao}
            className={`p-6 rounded-lg shadow-sm space-y-4 border ${
              modoEscuro
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
            }`}
          >
            {/* Seletor Quem está lançando */}
            <div>
              <label
                className={`block text-sm font-medium mb-1 ${
                  modoEscuro ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                Quem está lançando?
              </label>
              <div className="flex gap-4">
                <button
                  type="button"
                  className={`flex-1 py-2 rounded-lg border font-medium transition-colors ${
                    responsavel === 'João'
                      ? 'bg-green-600 text-white border-green-600 shadow-sm'
                      : modoEscuro
                      ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => setResponsavel('João')}
                >
                  João
                </button>
                <button
                  type="button"
                  className={`flex-1 py-2 rounded-lg border font-medium transition-colors ${
                    responsavel === 'Lorraine'
                      ? 'bg-pink-500 text-white border-pink-500 shadow-sm'
                      : modoEscuro
                      ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => setResponsavel('Lorraine')}
                >
                  Lorraine
                </button>
              </div>
            </div>

            <div>
              <label
                className={`block text-sm font-medium mb-1 ${
                  modoEscuro ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                Tipo de Movimentação
              </label>
              <div className="flex gap-4">
                <button
                  type="button"
                  className={`flex-1 py-2 rounded-lg border font-medium ${
                    tipo === 'entrada'
                      ? 'bg-green-600 text-white'
                      : modoEscuro
                      ? 'bg-gray-700 text-gray-300 border-gray-600'
                      : 'bg-gray-100'
                  }`}
                  onClick={() => setTipo('entrada')}
                >
                  Entrada (Recebimento)
                </button>
                <button
                  type="button"
                  className={`flex-1 py-2 rounded-lg border font-medium ${
                    tipo === 'saida'
                      ? 'bg-red-600 text-white'
                      : modoEscuro
                      ? 'bg-gray-700 text-gray-300 border-gray-600'
                      : 'bg-gray-100'
                  }`}
                  onClick={() => setTipo('saida')}
                >
                  Saída (Gasto)
                </button>
              </div>
            </div>

            <div>
              <label
                className={`block text-sm font-medium mb-1 ${
                  modoEscuro ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                Valor (R$)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className={`w-full p-2 border rounded-lg text-lg font-bold ${
                  modoEscuro
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-800'
                }`}
                placeholder="0,00"
              />
            </div>

            {tipo === 'entrada' ? (
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${
                    modoEscuro ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  De quem recebeu?
                </label>
                <input
                  type="text"
                  required
                  value={recebidoDe}
                  onChange={(e) => setRecebidoDe(e.target.value)}
                  className={`w-full p-2 border rounded-lg ${
                    modoEscuro
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-800'
                  }`}
                  placeholder="Ex: Salário, Cliente, Reembolso..."
                />
              </div>
            ) : (
              <>
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${
                      modoEscuro ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Forma de Pagamento
                  </label>
                  <select
                    value={formaPagamento}
                    onChange={(e) => setFormaPagamento(e.target.value)}
                    className={`w-full p-2 border rounded-lg ${
                      modoEscuro
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-800'
                    }`}
                  >
                    <option value="pix">PIX</option>
                    <option value="debito">Débito</option>
                    <option value="credito">Crédito</option>
                  </select>
                </div>

                {formaPagamento === 'credito' && (
                  <div
                    className={`p-3 rounded-lg space-y-3 ${
                      modoEscuro
                        ? 'bg-gray-700/60 border border-gray-600'
                        : 'bg-blue-50'
                    }`}
                  >
                    {/* TAG INFORMATIVA DA FATURA */}
                    <div className="text-xs font-semibold px-2 py-1.5 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-700">
                      💳 Fatura: Lançamento hoje entra na{' '}
                      <span className="underline font-bold">
                        fatura {tagFaturaAtual}
                      </span>{' '}
                      (Fechamento dia 04).
                    </div>

                    <div className="flex gap-4">
                      <label
                        className={`flex items-center gap-2 ${
                          modoEscuro ? 'text-gray-300' : 'text-gray-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="credito"
                          checked={tipoCredito === 'a_vista'}
                          onChange={() => setTipoCredito('a_vista')}
                        />{' '}
                        À Vista
                      </label>
                      <label
                        className={`flex items-center gap-2 ${
                          modoEscuro ? 'text-gray-300' : 'text-gray-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="credito"
                          checked={tipoCredito === 'parcelado'}
                          onChange={() => setTipoCredito('parcelado')}
                        />{' '}
                        Parcelado
                      </label>
                    </div>

                    {tipoCredito === 'parcelado' && (
                      <div>
                        <label
                          className={`block text-sm font-medium mb-1 ${
                            modoEscuro ? 'text-gray-300' : 'text-gray-700'
                          }`}
                        >
                          Quantidade de Parcelas
                        </label>
                        <input
                          type="number"
                          min="2"
                          max="72"
                          value={qtdParcelas}
                          onChange={(e) => setQtdParcelas(e.target.value)}
                          className={`w-full p-2 border rounded-lg ${
                            modoEscuro
                              ? 'bg-gray-800 border-gray-600 text-white'
                              : 'bg-white border-gray-300 text-gray-800'
                          }`}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${
                      modoEscuro ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Referente a quê?
                  </label>
                  <select
                    value={referenteA}
                    onChange={(e) => setReferenteA(e.target.value)}
                    className={`w-full p-2 border rounded-lg ${
                      modoEscuro
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-800'
                    }`}
                  >
                    <option value="">Selecione...</option>
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.nome}>
                        {cat.nome}
                      </option>
                    ))}
                  </select>

                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      placeholder="Nova Categoria..."
                      value={novaCategoria}
                      onChange={(e) => setNovaCategoria(e.target.value)}
                      className={`p-2 text-sm border rounded flex-1 ${
                        modoEscuro
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                          : 'bg-white border-gray-300 text-gray-800'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={adicionarCategoria}
                      className={`px-3 py-1 text-sm rounded font-medium ${
                        modoEscuro
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600'
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                      }`}
                    >
                      + Criar
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${
                      modoEscuro ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Finalidade (Para quem/o quê?)
                  </label>
                  <select
                    value={finalidade}
                    onChange={(e) => setFinalidade(e.target.value)}
                    className={`w-full p-2 border rounded-lg ${
                      modoEscuro
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-800'
                    }`}
                  >
                    <option value="Casa">Casa</option>
                    <option value="Elisa">Elisa</option>
                    <option value="João">João</option>
                    <option value="Lorraine">Lorraine</option>
                    <option value="Família">Família</option>
                  </select>
                </div>
              </>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
            >
              Registrar Lançamento
            </button>
          </form>
        )}

        {abaAtiva === 'tabela' && (
          <div
            className={`p-4 rounded-lg shadow-sm border space-y-4 ${
              modoEscuro
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
            }`}
          >
            {/* SELETOR DE FILTROS EXPANDIDO COM CRÉDITO MÊS E MÊS SEGUINTE */}
            <div
              className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b ${
                modoEscuro ? 'border-gray-700' : 'border-gray-200'
              }`}
            >
              <span
                className={`text-xs font-semibold ${
                  modoEscuro ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                Filtrar Pagamento:
              </span>
              <div className="flex flex-wrap gap-1 text-xs">
                {[
                  { label: 'Todos', val: 'todos' },
                  { label: 'PIX', val: 'pix' },
                  { label: 'Débito', val: 'debito' },
                  { label: 'Crédito (Mês)', val: 'credito_atual' },
                  { label: 'Crédito (Mês Seg.)', val: 'credito_seguinte' },
                ].map((item) => (
                  <button
                    key={item.val}
                    onClick={() => setFiltroPagamento(item.val as any)}
                    className={`px-2.5 py-1 rounded font-medium transition-colors ${
                      filtroPagamento === item.val
                        ? 'bg-blue-600 text-white'
                        : modoEscuro
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              {transacoesFiltradas.length === 0 ? (
                <p
                  className={`text-center py-6 text-sm ${
                    modoEscuro ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  Nenhum lançamento encontrado para os filtros selecionados.
                </p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead
                    className={`border-b ${
                      modoEscuro
                        ? 'bg-gray-700/50 border-gray-700 text-gray-300'
                        : 'bg-gray-100 border-gray-200 text-gray-600'
                    }`}
                  >
                    <tr>
                      <th className="p-2">Data</th>
                      <th className="p-2">Quem</th>
                      <th className="p-2">Tipo</th>
                      <th className="p-2">Detalhes</th>
                      <th className="p-2">Pagamento / Fatura</th>
                      <th className="p-2">Finalidade</th>
                      <th className="p-2">Valor</th>
                      <th className="p-2 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transacoesFiltradas.map((t) => {
                      const ehCredito =
                        (t.forma_pagamento || '').toLowerCase() === 'credito';
                      const cicloFatura = ehCredito
                        ? obterTagFatura(t.data_hora)
                        : null;

                      return (
                        <tr
                          key={t.id}
                          className={`border-b transition-colors ${
                            modoEscuro
                              ? 'border-gray-700/60 hover:bg-gray-750'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <td className="p-2 text-xs">
                            {new Date(t.data_hora).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="p-2 font-medium">{t.responsavel}</td>
                          <td className="p-2">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-bold ${
                                t.tipo === 'entrada'
                                  ? modoEscuro
                                    ? 'bg-green-900/60 text-green-300'
                                    : 'bg-green-100 text-green-700'
                                  : modoEscuro
                                  ? 'bg-red-900/60 text-red-300'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {t.tipo.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-2">
                            {t.tipo === 'entrada'
                              ? `De: ${t.recebido_de}`
                              : t.referente_a}
                            {t.tipo_credito === 'parcelado' && (
                              <span
                                className={`block text-xs font-semibold ${
                                  modoEscuro ? 'text-blue-400' : 'text-blue-600'
                                }`}
                              >
                                Parcela {t.parcela_atual}/{t.total_parcelas}
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            <span
                              className={`capitalize text-xs font-semibold ${
                                modoEscuro ? 'text-gray-300' : 'text-gray-700'
                              }`}
                            >
                              {t.forma_pagamento || '-'}
                            </span>
                            {ehCredito && (
                              <span
                                className={`block text-[10px] font-bold mt-0.5 ${
                                  cicloFatura === 'mes_atual'
                                    ? modoEscuro
                                      ? 'text-amber-400'
                                      : 'text-amber-600'
                                    : modoEscuro
                                    ? 'text-purple-400'
                                    : 'text-purple-600'
                                }`}
                              >
                                {cicloFatura === 'mes_atual'
                                  ? '💳 Fatura Mês'
                                  : '🗓️ Fatura Mês Seg.'}
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            <span
                              className={`px-2 py-0.5 rounded text-xs ${
                                modoEscuro
                                  ? 'bg-gray-700 text-gray-300'
                                  : 'bg-gray-200 text-gray-800'
                              }`}
                            >
                              {t.finalidade}
                            </span>
                          </td>
                          <td
                            className={`p-2 font-bold ${
                              t.tipo === 'entrada'
                                ? modoEscuro
                                  ? 'text-green-400'
                                  : 'text-green-600'
                                : modoEscuro
                                ? 'text-red-400'
                                : 'text-red-600'
                            }`}
                          >
                            R$ {Number(t.valor).toFixed(2)}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              onClick={() => deletarTransacao(t)}
                              className={`px-2 py-1 rounded border text-xs font-bold transition-colors ${
                                modoEscuro
                                  ? 'text-red-400 border-red-800/80 hover:bg-red-950/50'
                                  : 'text-red-600 border-red-200 hover:bg-red-50'
                              }`}
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {abaAtiva === 'resumo' && (
          <div className="space-y-6">
            <div
              className={`p-6 rounded-lg shadow-sm border ${
                modoEscuro
                  ? 'bg-gray-800 border-gray-700'
                  : 'bg-white border-gray-200'
              }`}
            >
              <h2
                className={`text-lg font-bold mb-4 text-center ${
                  modoEscuro ? 'text-gray-100' : 'text-gray-800'
                }`}
              >
                Gastos do Mês por Finalidade
              </h2>
              {dadosGrafico.length === 0 ? (
                <p
                  className={`text-center py-6 ${
                    modoEscuro ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  Sem saídas cadastradas para exibir gráfico neste mês.
                </p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dadosGrafico}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={(entry) =>
                          `${entry.name}: R$ ${entry.value.toFixed(2)}`
                        }
                      >
                        {dadosGrafico.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={coresAtuais[index % coresAtuais.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any) => `R$ ${Number(val).toFixed(2)}`}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
