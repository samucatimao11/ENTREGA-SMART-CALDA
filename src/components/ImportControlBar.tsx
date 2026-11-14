import React, { useRef, useState } from 'react';
import { FileSpreadsheet, Printer, RotateCcw, SlidersHorizontal, Upload } from 'lucide-react';
import type { ImportedDataset, ReportFilters } from '../types/report';
import { DateRangeCalendarPicker } from './DateRangeCalendarPicker';

interface ImportControlBarProps {
  dataset: ImportedDataset;
  filters: ReportFilters;
  filterOptions: {
    datas: string[];
    turnos: string[];
    frentes: string[];
  };
  onFileSelected: (file: File) => void;
  onFilterChange: (next: ReportFilters) => void;
  onSheetChange: (sheetName: string) => void;
  onResetDefault: () => void;
  onPrint: () => void;
  onOpenMapping: () => void;
  errorMessage: string | null;
}

export const ImportControlBar: React.FC<ImportControlBarProps> = ({
  dataset,
  filters,
  filterOptions,
  onFileSelected,
  onFilterChange,
  onSheetChange,
  onResetDefault,
  onPrint,
  onOpenMapping,
  errorMessage,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    onFileSelected(files[0]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const isDefault = dataset.fileName === 'Informativo_Padrao_18_10_2024.xlsx';

  return (
    <section
      aria-label="Importação de planilha e filtros do informativo"
      className="no-print w-full max-w-[1160px] mx-auto mb-4 bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4"
    >
      {/* Prominent Spreadsheet Import Field */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-lg border-2 border-dashed transition-colors ${
          isDragging
            ? 'border-[#78B72A] bg-lime-50/60'
            : 'border-slate-300 bg-slate-50/70 hover:border-slate-400'
        }`}
      >
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-[#78B72A]/12 text-[#5B8E1C] flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-sm sm:text-base font-bold text-slate-900">
              Importar Planilha Atualizada
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 truncate">
              Arraste um arquivo ou selecione <span className="font-medium text-slate-800">.xlsx, .xls ou .csv</span> para atualizar o informativo automaticamente.
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
              <span className="font-medium text-slate-700 truncate max-w-[260px]" title={dataset.fileName}>
                {dataset.fileName}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {dataset.mode === 'records'
                  ? `${dataset.records.length} registros lidos`
                  : 'Modo resumo consolidado'}
              </span>
              {dataset.activeSheet && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Aba: {dataset.activeSheet}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <input
            ref={inputRef}
            id="planilha-upload-input"
            aria-label="Selecionar arquivo de planilha atualizada"
            type="file"
            accept=".xlsx,.xls,.csv,.ods"
            className="sr-only"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#6AA621] hover:bg-[#5A9019] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Selecionar Planilha</span>
          </button>

          {!isDefault && (
            <button
              type="button"
              onClick={onResetDefault}
              title="Restaurar dados padrão do exemplo"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Restaurar Padrão</span>
            </button>
          )}
        </div>
      </div>

      {/* Error feedback */}
      {errorMessage && (
        <div
          role="alert"
          className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 font-medium"
        >
          {errorMessage}
        </div>
      )}

      {/* Filter & Secondary Utility Toolbar */}
      <div className="mt-4 pt-3.5 border-t border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {dataset.sheetNames.length > 1 && (
            <div className="flex items-center gap-2">
              <label htmlFor="sheet-select" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                Aba:
              </label>
              <select
                id="sheet-select"
                value={dataset.activeSheet}
                onChange={(e) => onSheetChange(e.target.value)}
                className="h-9 px-2.5 text-xs sm:text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B245B]/20"
              >
                {dataset.sheetNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {dataset.mode === 'records' && (
            <>
              <DateRangeCalendarPicker
                availableBrDates={filterOptions.datas}
                dataStart={filters.dataStart}
                dataEnd={filters.dataEnd}
                onChange={(nextStart, nextEnd) =>
                  onFilterChange({
                    ...filters,
                    dataStart: nextStart,
                    dataEnd: nextEnd,
                  })
                }
              />

              <div className="flex items-center gap-2">
                <label htmlFor="filter-turno" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                  Turno:
                </label>
                <select
                  id="filter-turno"
                  value={filters.turno}
                  onChange={(e) => onFilterChange({ ...filters, turno: e.target.value })}
                  className="h-9 px-2.5 text-xs sm:text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B245B]/20"
                >
                  <option value="TODOS">TODOS</option>
                  {filterOptions.turnos.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="filter-frente" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                  Frente:
                </label>
                <select
                  id="filter-frente"
                  value={filters.frente}
                  onChange={(e) => onFilterChange({ ...filters, frente: e.target.value })}
                  className="h-9 px-2.5 text-xs sm:text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B245B]/20"
                >
                  <option value="TODOS">TODOS</option>
                  {filterOptions.frentes.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {dataset.mode === 'summary' && (
            <p className="text-xs text-slate-500">
              Para filtrar por Data, Turno e Frente diretamente no app, importe uma planilha com linhas operacionais (use o botão <span className="font-semibold text-slate-700">Baixar Modelo</span>).
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {dataset.rawHeaders.length > 0 && (
            <button
              type="button"
              onClick={onOpenMapping}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Mapear Colunas</span>
            </button>
          )}

          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>
    </section>
  );
};
