import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toBlob, toPng } from 'html-to-image';
import { ImportControlBar } from './components/ImportControlBar';
import { SmartReportSheet } from './components/SmartReportSheet';
import { SpreadsheetDataPanel } from './components/SpreadsheetDataPanel';
import { TopBar, type ActiveTab } from './components/TopBar';
import { DEFAULT_DATASET, DEFAULT_REPORT_DATA } from './data/defaultReport';
import type { ColumnMapping, ImportedDataset, ReportFilters } from './types/report';
import {
  aggregateRecordsToReport,
  autoDetectColumnMapping,
  extractRecordsFromRows,
  getFilterOptionsFromRecords,
  parseWorkbookArrayBuffer,
} from './utils/spreadsheetParser';
import { downloadTemplateWorkbook } from './utils/templateExporter';

const STORAGE_KEY = 'smart_calda_dataset_v1';

function loadSavedDataset(): ImportedDataset {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DATASET;
    const parsed = JSON.parse(raw) as ImportedDataset;
    if (parsed && (parsed.mode === 'records' || parsed.mode === 'summary')) {
      if (
        parsed.mode === 'records' &&
        Array.isArray(parsed.rawRows) &&
        parsed.rawRows.length > 0 &&
        Array.isArray(parsed.rawHeaders) &&
        parsed.rawHeaders.length > 0
      ) {
        const autoMapped = autoDetectColumnMapping(parsed.rawHeaders, parsed.rawRows);
        const mergedMapping: ColumnMapping = {
          ...autoMapped,
          ...parsed.mapping,
        };
        if (autoMapped.horaSolicitacao && !mergedMapping.horaSolicitacao) {
          mergedMapping.horaSolicitacao = autoMapped.horaSolicitacao;
        }
        if (autoMapped.horaTransferencia && !mergedMapping.horaTransferencia) {
          mergedMapping.horaTransferencia = autoMapped.horaTransferencia;
        }
        if (
          mergedMapping.tempoTransferencia &&
          mergedMapping.tempoTransferencia === mergedMapping.horaTransferencia
        ) {
          mergedMapping.tempoTransferencia = autoMapped.tempoTransferencia;
        }
        if (autoMapped.horaFimDosagem && !mergedMapping.horaFimDosagem) {
          mergedMapping.horaFimDosagem = autoMapped.horaFimDosagem;
        }
        if (
          mergedMapping.tempoPreparo &&
          mergedMapping.tempoPreparo === mergedMapping.horaFimDosagem
        ) {
          mergedMapping.tempoPreparo = autoMapped.tempoPreparo;
        }
        return {
          ...parsed,
          mapping: mergedMapping,
          records: extractRecordsFromRows(parsed.rawRows, mergedMapping),
        };
      }
      return parsed;
    }
  } catch {
    // Ignore invalid storage
  }
  return DEFAULT_DATASET;
}

const INITIAL_FILTERS: ReportFilters = {
  dataStart: '',
  dataEnd: '',
  turno: 'TODOS',
  frente: 'TODOS',
};

export default function App() {
  const [dataset, setDataset] = useState<ImportedDataset>(loadSavedDataset);
  const [filters, setFilters] = useState<ReportFilters>(INITIAL_FILTERS);
  const [activeTab, setActiveTab] = useState<ActiveTab>('informativo');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const lastBufferRef = useRef<{ buffer: ArrayBuffer; fileName: string } | null>(null);
  const reportSheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset));
    } catch {
      // Storage quota exceeded on very large files; ignore silently
    }
  }, [dataset]);

  const filterOptions = useMemo(() => {
    if (dataset.mode !== 'records') {
      return { datas: [], turnos: [], frentes: [] };
    }
    return getFilterOptionsFromRecords(dataset.records);
  }, [dataset]);

  const activeReport = useMemo(() => {
    if (dataset.mode === 'records') {
      return aggregateRecordsToReport(dataset.records, filters);
    }
    return dataset.summaryReport ?? DEFAULT_REPORT_DATA;
  }, [dataset, filters]);

  const handleFileSelected = useCallback(async (file: File) => {
    setErrorMessage(null);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseWorkbookArrayBuffer(buffer, file.name);
      lastBufferRef.current = { buffer, fileName: file.name };
      setDataset(parsed);
      setFilters(INITIAL_FILTERS);
      setActiveTab('informativo');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Não foi possível ler o arquivo enviado. Verifique o formato da planilha.';
      setErrorMessage(msg);
    }
  }, []);

  const handleSheetChange = useCallback((sheetName: string) => {
    if (!lastBufferRef.current) return;
    setErrorMessage(null);
    try {
      const parsed = parseWorkbookArrayBuffer(
        lastBufferRef.current.buffer,
        lastBufferRef.current.fileName,
        sheetName
      );
      setDataset(parsed);
      setFilters(INITIAL_FILTERS);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Erro ao carregar a aba selecionada.';
      setErrorMessage(msg);
    }
  }, []);

  const handleUpdateMapping = useCallback((nextMapping: ColumnMapping) => {
    setDataset((prev) => {
      const updatedRecords = extractRecordsFromRows(prev.rawRows, nextMapping);
      return {
        ...prev,
        mode: 'records',
        mapping: nextMapping,
        records: updatedRecords,
      };
    });
    setFilters(INITIAL_FILTERS);
  }, []);

  const handleResetDefault = useCallback(() => {
    lastBufferRef.current = null;
    localStorage.removeItem(STORAGE_KEY);
    setDataset(DEFAULT_DATASET);
    setFilters(INITIAL_FILTERS);
    setErrorMessage(null);
    setActiveTab('informativo');
  }, []);

  const handleExportPng = useCallback(async () => {
    if (activeTab !== 'informativo') {
      setActiveTab('informativo');
      await new Promise((r) => setTimeout(r, 150));
    }
    const node = reportSheetRef.current;
    if (!node) return;

    setIsExporting(true);
    setErrorMessage(null);
    try {
      if (typeof document !== 'undefined' && document.fonts?.ready) {
        await document.fonts.ready;
      }
      const exportOptions = {
        backgroundColor: '#FFFFFF',
        pixelRatio: 2,
        cacheBust: true,
        width: node.offsetWidth,
        height: Math.max(node.offsetHeight, node.scrollHeight),
        style: {
          margin: '0',
        },
      };
      const safeDate = activeReport.data.replace(/[/\\:\s–-]+/g, '-');
      const fileName = `Informativo_Entrega_Calda_${safeDate}.png`;

      const blob = await toBlob(node, exportOptions);
      if (blob) {
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = fileName;
        link.href = objectUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      } else {
        const dataUrl = await toPng(node, exportOptions);
        const link = document.createElement('a');
        link.download = fileName;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch {
      setErrorMessage('Não foi possível exportar a imagem PNG. Tente usar Imprimir / PDF.');
    } finally {
      setIsExporting(false);
    }
  }, [activeReport.data, activeTab]);

  const handlePrint = useCallback(() => {
    if (activeTab !== 'informativo') {
      setActiveTab('informativo');
      setTimeout(() => window.print(), 100);
    } else {
      window.print();
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F3F5F8] text-slate-900">
      <TopBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onDownloadTemplate={downloadTemplateWorkbook}
        onExportPng={handleExportPng}
        isExporting={isExporting}
      />

      {/* Mobile navigation strip */}
      <div className="no-print md:hidden bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-4 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('informativo')}
          className={activeTab === 'informativo' ? 'text-[#0B245B] underline underline-offset-4' : 'text-slate-600'}
        >
          Informativo
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('dados')}
          className={activeTab === 'dados' ? 'text-[#0B245B] underline underline-offset-4' : 'text-slate-600'}
        >
          Dados da Planilha
        </button>
        <button
          type="button"
          onClick={downloadTemplateWorkbook}
          className="text-slate-600 ml-auto"
        >
          Baixar Modelo (.xlsx)
        </button>
      </div>

      <main className="flex-1 px-4 sm:px-6 py-5 sm:py-6">
        <ImportControlBar
          dataset={dataset}
          filters={filters}
          filterOptions={filterOptions}
          onFileSelected={handleFileSelected}
          onFilterChange={setFilters}
          onSheetChange={handleSheetChange}
          onResetDefault={handleResetDefault}
          onExportPng={handleExportPng}
          isExporting={isExporting}
          onPrint={handlePrint}
          onOpenMapping={() => setActiveTab('dados')}
          errorMessage={errorMessage}
        />

        {activeTab === 'informativo' ? (
          <SmartReportSheet report={activeReport} sheetRef={reportSheetRef} />
        ) : (
          <SpreadsheetDataPanel
            dataset={dataset}
            activeReport={activeReport}
            onUpdateMapping={handleUpdateMapping}
            onBackToReport={() => setActiveTab('informativo')}
          />
        )}
      </main>
    </div>
  );
}
