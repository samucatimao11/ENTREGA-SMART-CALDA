import React from 'react';
import { Download } from 'lucide-react';

export type ActiveTab = 'informativo' | 'dados';

interface TopBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onDownloadTemplate: () => void;
  onExportPng: () => void;
  isExporting: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onTabChange,
  onDownloadTemplate,
  onExportPng,
  isExporting,
}) => {
  return (
    <header className="no-print bg-white border-b border-slate-200">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Title */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onTabChange('informativo');
          }}
          className="font-display text-lg font-extrabold tracking-tight text-[#0B245B] whitespace-nowrap shrink-0"
        >
          Entrega de Calda - SMART
        </a>

        {/* Zone 2: Clean single-line text navigation */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600" aria-label="Navegação principal">
          <button
            type="button"
            onClick={() => onTabChange('informativo')}
            className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
              activeTab === 'informativo'
                ? 'text-[#0B245B] border-[#78B72A] font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Informativo
          </button>
          <button
            type="button"
            onClick={() => onTabChange('dados')}
            className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
              activeTab === 'dados'
                ? 'text-[#0B245B] border-[#78B72A] font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Dados da Planilha
          </button>
          <button
            type="button"
            onClick={onDownloadTemplate}
            className="py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 border-transparent hover:text-slate-900"
          >
            Baixar Modelo
          </button>
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onExportPng}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#0B245B] rounded-lg hover:bg-[#133278] transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
          >
            <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{isExporting ? 'Gerando PNG...' : 'Baixar PNG'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
