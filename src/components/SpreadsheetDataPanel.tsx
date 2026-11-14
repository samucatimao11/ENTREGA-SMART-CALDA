import React from 'react';
import type { ColumnMapping, ImportedDataset, ReportData } from '../types/report';
import { formatMinutesToReportDuration, formatVolumePTBR } from '../utils/formatters';

interface SpreadsheetDataPanelProps {
  dataset: ImportedDataset;
  activeReport: ReportData;
  onUpdateMapping: (nextMapping: ColumnMapping) => void;
  onBackToReport: () => void;
}

const MAPPING_FIELDS: { key: keyof ColumnMapping; label: string }[] = [
  { key: 'data', label: 'Coluna de Data' },
  { key: 'turno', label: 'Coluna de Turno' },
  { key: 'frente', label: 'Coluna de Frente (Gráfico Volume)' },
  { key: 'volume', label: 'Coluna de Volume (L)' },
  { key: 'horaSolicitacao', label: 'Hora de Solicitação' },
  { key: 'horaTransferencia', label: 'Hora Transferência' },
  { key: 'horaFimDosagem', label: 'Hora Fim Dosagem' },
  { key: 'tempoTransferencia', label: 'Tempo Transferência (Opcional)' },
  { key: 'tempoPreparo', label: 'Tempo Preparo (Opcional)' },
  { key: 'operacao', label: 'Coluna Auxiliar (Opcional)' },
];

export const SpreadsheetDataPanel: React.FC<SpreadsheetDataPanelProps> = ({
  dataset,
  activeReport,
  onUpdateMapping,
  onBackToReport,
}) => {
  return (
    <div className="no-print w-full max-w-[1160px] mx-auto space-y-5">
      {/* Column Mapping Section (when tabular headers exist) */}
      {dataset.rawHeaders.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Mapeamento de Colunas da Planilha
              </h2>
              <p className="text-xs sm:text-sm text-slate-600">
                O sistema detectou as colunas abaixo automaticamente. Ajuste caso sua planilha utilize outros títulos.
              </p>
            </div>
            <button
              type="button"
              onClick={onBackToReport}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0B245B] hover:bg-[#133278] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Ver Informativo Atualizado
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {MAPPING_FIELDS.map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1">
                <label
                  htmlFor={`map-${key}`}
                  className="text-xs font-semibold text-slate-700"
                >
                  {label}
                </label>
                <select
                  id={`map-${key}`}
                  value={dataset.mapping[key] ?? ''}
                  onChange={(e) =>
                    onUpdateMapping({
                      ...dataset.mapping,
                      [key]: e.target.value || undefined,
                    })
                  }
                  className="h-9 px-2.5 text-xs sm:text-sm text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B245B]/20"
                >
                  <option value="">Não mapeada</option>
                  {dataset.rawHeaders.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Records or Summary Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              {dataset.mode === 'records'
                ? `Registros Lidos (${dataset.records.length})`
                : 'Resumo Consolidado em Exibição'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Arquivo: {dataset.fileName} · Aba: {dataset.activeSheet}
            </p>
          </div>
        </div>

        {dataset.mode === 'records' && dataset.records.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-4">Data</th>
                  <th className="py-2.5 px-4">Turno</th>
                  <th className="py-2.5 px-4">Frente</th>
                  <th className="py-2.5 px-4">Operação</th>
                  <th className="py-2.5 px-4 text-right">Volume (L)</th>
                  <th className="py-2.5 px-4 text-right">Transf.</th>
                  <th className="py-2.5 px-4 text-right">Preparo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {dataset.records.slice(0, 200).map((rec, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">{rec.data || '—'}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-800 whitespace-nowrap">{rec.turno}</td>
                    <td className="py-2.5 px-4 font-medium text-[#0B245B] whitespace-nowrap">{rec.frente}</td>
                    <td className="py-2.5 px-4 text-slate-600">{rec.operacao}</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-slate-900">
                      {formatVolumePTBR(rec.volume)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-700">
                      {rec.tempoTransferenciaMin !== null
                        ? formatMinutesToReportDuration(rec.tempoTransferenciaMin)
                        : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-700">
                      {rec.tempoPreparoMin !== null
                        ? formatMinutesToReportDuration(rec.tempoPreparoMin)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dataset.records.length > 200 && (
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
                Exibindo os primeiros 200 de {dataset.records.length} registros. Todos os registros são contabilizados no informativo.
              </div>
            )}
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h3 className="font-semibold text-slate-800 mb-2">Indicadores Gerais e Turnos</h3>
              <dl className="divide-y divide-slate-100 border border-slate-200 rounded-lg tabular-nums">
                <div className="flex justify-between px-3.5 py-2.5">
                  <dt className="text-slate-600">Data</dt>
                  <dd className="font-semibold text-slate-900">{activeReport.data}</dd>
                </div>
                <div className="flex justify-between px-3.5 py-2.5">
                  <dt className="text-slate-600">Total Período (L)</dt>
                  <dd className="font-semibold text-slate-900">{formatVolumePTBR(activeReport.totalDia)}</dd>
                </div>
                {activeReport.turnos.map((t) => (
                  <div key={t.name} className="flex justify-between px-3.5 py-2.5">
                    <dt className="text-slate-600">{t.name} (L)</dt>
                    <dd className="font-semibold text-slate-900">{formatVolumePTBR(t.volume)}</dd>
                  </div>
                ))}
                <div className="flex justify-between px-3.5 py-2.5">
                  <dt className="text-slate-600">Média Transferência</dt>
                  <dd className="font-semibold text-slate-900">
                    {formatMinutesToReportDuration(activeReport.mediaTransferenciaMin)}
                  </dd>
                </div>
                <div className="flex justify-between px-3.5 py-2.5">
                  <dt className="text-slate-600">Média Preparo</dt>
                  <dd className="font-semibold text-slate-900">
                    {formatMinutesToReportDuration(activeReport.mediaPreparoMin)}
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="font-semibold text-slate-800 mb-2">Volume por Frente (L)</h3>
              <dl className="divide-y divide-slate-100 border border-slate-200 rounded-lg tabular-nums">
                {activeReport.operacoes.map((op) => (
                  <div key={op.name} className="flex justify-between px-3.5 py-2.5">
                    <dt className="text-slate-700 font-medium">{op.name}</dt>
                    <dd className="font-semibold text-slate-900">{formatVolumePTBR(op.volume)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
