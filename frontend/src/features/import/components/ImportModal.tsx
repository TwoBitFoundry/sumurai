import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  UploadCloud,
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { transactionsRowRecipes } from '@/features/transactions/components/TransactionsTable';
import {
  type CsvColumnMapping,
  type ImportResponse,
  importFormatLabel,
  importSupportedFileFormats,
  isCsvImportFormat,
  type PreviewTransaction,
} from '@/models/import';
import {
  Alert,
  Button,
  cn,
  FormLabel,
  GlassCard,
  IconButton,
  Modal,
  Pill,
  Select,
} from '@/ui/primitives';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import {
  border as uiBorderRecipes,
  checkboxControl as uiCheckboxControlRecipes,
  radius as uiRadiusRecipes,
  status as uiStatusRecipes,
  surface as uiSurfaceRecipes,
  text as uiTextRecipes,
  transactionsTable as uiTransactionsTableRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { fmtUSD } from '@/utils/format';
import {
  isMappingComplete,
  mappingUsesSplitAmount,
  normalizeCsvMapping,
  resolveMappedHeader,
} from '../csvMapping';
import type { UseImportTransactionsResult } from '../hooks/useImportTransactions';
import { useImportTransactions } from '../hooks/useImportTransactions';

export interface ImportModalAccount {
  id: string;
  name: string;
  mask: string;
}

interface ImportModalProps {
  account: ImportModalAccount;
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: (count: number, mask: string) => void;
}

interface ImportModalViewProps extends ImportModalProps {
  workflow: UseImportTransactionsResult;
}

const acceptedFormats = '.csv,.ofx,.qbo,.qfx,.qbx';
const importFileInputLabel = 'Choose an import file (CSV, OFX, QBO, QFX, or QBX)';
const importPanelHeadingClassName = cn(uiTypographyRecipes.bodyStrong, uiTextRecipes.primary);

const importModalTitleClassName = cn(uiTypographyRecipes.cardTitle, uiTextRecipes.primary);

const importModalShell = {
  overlay: cn(
    'p-[env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)]'
  ),
  grid: cn('p-2', 'md:p-4'),
  content: cn('w-full', 'max-w-none', 'max-h-[min(92dvh,42rem)]', 'md:max-w-2xl'),
  header: cn(
    'flex-shrink-0',
    'border-b',
    'px-3',
    'py-3',
    'md:px-6',
    'md:py-4',
    ...uiBorderRecipes.divider
  ),
  body: cn('min-h-0', 'flex-1', 'overflow-y-auto', 'px-3', 'py-3', 'md:px-6', 'md:py-5'),
  footer: cn(
    'flex-shrink-0',
    'border-t',
    'px-3',
    'py-3',
    'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
    'md:px-6',
    'md:py-4',
    ...uiBorderRecipes.divider
  ),
  footerActions: cn(
    'flex',
    'w-full',
    'flex-col',
    'gap-[length:var(--spacing-compact-gap)]',
    'md:flex-row',
    'md:justify-end',
    'md:gap-3',
    '[&_button]:w-full',
    'md:[&_button]:w-auto'
  ),
  sectionStack: cn('space-y-[length:var(--spacing-section-gap)]'),
} as const;

const previewTableCellClassName = cn('px-2', 'py-1.5', 'align-middle', 'md:px-4', 'md:py-3');

const previewDescriptionColumnClassName = cn('hidden', 'min-[400px]:table-cell');

const emptyMapping: CsvColumnMapping = {
  date_column: null,
  amount_column: null,
  debit_column: null,
  credit_column: null,
  description_column: null,
};

export const ImportModal: React.FC<ImportModalProps> = (props) => {
  const workflow = useImportTransactions(props.account.id);
  return <ImportModalView {...props} workflow={workflow} />;
};

export const ImportModalView: React.FC<ImportModalViewProps> = ({
  account,
  isOpen,
  onClose,
  onImportSuccess,
  workflow,
}) => {
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = workflow.status === 'validating' || workflow.status === 'importing';
  const validation = workflow.validationResult;
  const headers = validation?.csv_headers ?? validation?.sample_csv_rows[0] ?? [];
  const currentMapping = normalizeCsvMapping(
    workflow.csvMapping ?? validation?.suggested_csv_mapping ?? emptyMapping,
    headers
  );
  const mappingComplete =
    !isCsvImportFormat(validation?.format) || isMappingComplete(currentMapping);
  const needsMapping = isCsvImportFormat(validation?.format) && !mappingComplete;
  const [mappingExpanded, setMappingExpanded] = useState(needsMapping);
  const selectedFileName = workflow.selectedFile?.name;

  useEffect(() => {
    setMappingExpanded(needsMapping);
  }, [needsMapping]);

  const handleClose = () => {
    workflow.reset();
    onClose();
  };

  const handleFile = async (file: File | undefined) => {
    if (file) {
      await workflow.validateFile(file);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    await handleFile(file);
  };

  const handleDrop = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    await handleFile(event.dataTransfer.files[0]);
  };

  const handleImport = async () => {
    await workflow.importFile(undefined, currentMapping);
  };

  const handleDone = () => {
    if (workflow.importResult) {
      onImportSuccess?.(workflow.importResult.imported_count, account.mask);
    }
    handleClose();
  };

  const handleMappingChange = (field: keyof CsvColumnMapping, value: string) => {
    const nextValue = value || null;
    const next = { ...currentMapping, [field]: nextValue };
    if (field === 'amount_column' && nextValue) {
      next.debit_column = null;
      next.credit_column = null;
    }
    if ((field === 'debit_column' || field === 'credit_column') && nextValue) {
      next.amount_column = null;
    }
    workflow.setCsvMapping(next);
  };

  const handleMappingPatch = (patch: Partial<CsvColumnMapping>) => {
    workflow.setCsvMapping({ ...currentMapping, ...patch });
  };

  const resetDetectedMapping = () => {
    const suggested = validation?.suggested_csv_mapping;
    workflow.setCsvMapping(suggested ? normalizeCsvMapping(suggested, headers) : null);
  };

  const canImport = workflow.status === 'preview' && mappingComplete;
  const canClose = !busy;

  return (
    <Modal
      isOpen={isOpen}
      onClose={canClose ? handleClose : undefined}
      labelledBy={titleId}
      preventCloseOnBackdrop={busy}
      size="lg"
      className={importModalShell.content}
      containerClassName={importModalShell.overlay}
      gridClassName={importModalShell.grid}
      onEscapeKeyDown={(event) => {
        if (busy) {
          event.preventDefault();
        }
      }}
    >
      <GlassCard
        variant="accent"
        rounded="xl"
        padding="none"
        withInnerEffects={false}
        className={cn('flex', 'max-h-[min(92dvh,42rem)]', 'flex-col', 'overflow-hidden')}
      >
        <header className={importModalShell.header}>
          <div className={cn('flex', 'items-start', 'gap-2', 'md:gap-3')}>
            <div className={cn('min-w-0', 'flex-1', 'space-y-1.5')}>
              <h2 id={titleId} className={cn(importModalTitleClassName, 'pr-1')}>
                Import Transactions
              </h2>
              <div className={cn('min-w-0')}>
                {importDestinationLine(selectedFileName, account)}
              </div>
            </div>
            {canClose ? (
              <IconButton
                type="button"
                variant="ghost"
                aria-label="Close import modal"
                onClick={handleClose}
                className={cn('-mr-1', '-mt-0.5', 'shrink-0')}
              >
                <X aria-hidden="true" />
              </IconButton>
            ) : null}
          </div>
        </header>

        <div className={importModalShell.body}>
          {workflow.status === 'idle' ? (
            <UploadPanel
              inputRef={fileInputRef}
              selectedFileName={selectedFileName}
              onFileChange={handleFileChange}
              onDrop={handleDrop}
              onDragOver={(event) => event.preventDefault()}
            />
          ) : null}

          {workflow.status === 'validating' ? (
            <BusyPanel
              title={`Validating ${selectedFileName ?? 'file'}`}
              description="Parsing your file."
            />
          ) : null}

          {workflow.status === 'validation-error' ? (
            <ErrorPanel
              title="Validation failed"
              message={workflow.error ?? 'Choose another file and try again.'}
              primaryAction="Try another file"
              onPrimary={() => {
                workflow.reset();
                fileInputRef.current?.click();
              }}
            />
          ) : null}

          {workflow.status === 'preview' && validation ? (
            <PreviewPanel
              validation={validation}
              mapping={currentMapping}
              headers={headers}
              mappingExpanded={mappingExpanded}
              onToggleMapping={() => setMappingExpanded((value) => !value)}
              onMappingChange={handleMappingChange}
              onMappingPatch={handleMappingPatch}
              onResetMapping={resetDetectedMapping}
            />
          ) : null}

          {workflow.status === 'importing' ? (
            <BusyPanel title="Importing transactions" description="Saving transactions." />
          ) : null}

          {workflow.status === 'success' && workflow.importResult ? (
            <SuccessPanel result={workflow.importResult} />
          ) : null}

          {workflow.status === 'error' ? (
            <ErrorPanel
              title="Import failed"
              message={workflow.error ?? 'The validated file could not be imported.'}
              primaryAction="Try again"
              secondaryAction="Choose another file"
              onPrimary={() => void workflow.importFile(undefined, currentMapping)}
              onSecondary={() => {
                workflow.reset();
                fileInputRef.current?.click();
              }}
            />
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFormats}
            aria-label={importFileInputLabel}
            className="sr-only"
            disabled={busy}
            onChange={handleFileChange}
          />
        </div>

        <footer className={importModalShell.footer}>
          <div className={importModalShell.footerActions}>
            {busy ? null : (
              <FooterActions
                workflow={workflow}
                canImport={canImport}
                onClose={handleClose}
                onChooseFile={() => fileInputRef.current?.click()}
                onImport={handleImport}
                onDone={handleDone}
              />
            )}
          </div>
        </footer>
      </GlassCard>
    </Modal>
  );
};

interface UploadPanelProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  selectedFileName?: string;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: React.DragEvent<HTMLLabelElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLLabelElement>) => void;
}

function ImportSupportedFormats() {
  return (
    <div className={cn('flex', 'max-w-md', 'flex-col', 'items-center', 'gap-2.5')}>
      <div className={cn('flex', 'flex-wrap', 'items-center', 'justify-center', 'gap-2')}>
        {importSupportedFileFormats.map((format) => (
          <Pill key={format} variant="status" tone="info">
            {importFormatLabel(format)}
          </Pill>
        ))}
      </div>
      <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>
        CSV must include a header row
      </p>
      <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>Up to 10 MB per file</p>
    </div>
  );
}

function UploadPanel({
  inputRef,
  selectedFileName,
  onFileChange,
  onDrop,
  onDragOver,
}: UploadPanelProps) {
  return (
    <label
      data-testid="import-drop-zone"
      className={cn(
        'flex',
        'min-h-56',
        'cursor-pointer',
        'flex-col',
        'items-center',
        'justify-center',
        'gap-[length:var(--spacing-compact-gap)]',
        'border',
        'border-dashed',
        'p-[length:var(--spacing-page-x)]',
        'text-center',
        'transition',
        'hover:-translate-y-0.5',
        'md:min-h-64',
        'md:gap-4',
        'md:p-8',
        uiRadiusRecipes.standard,
        ...uiBorderRecipes.control,
        ...uiSurfaceRecipes.insetWell
      )}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <span
        className={cn(
          'flex',
          'h-14',
          'w-14',
          'items-center',
          'justify-center',
          'rounded-full',
          ...uiStatusRecipes.info.strongSurface,
          ...uiStatusRecipes.info.icon
        )}
      >
        <UploadCloud className={cn('h-7', 'w-7')} aria-hidden="true" />
      </span>
      <span className={cn(uiTypographyRecipes.bodyStrong, uiTextRecipes.primary)}>
        {selectedFileName ?? 'Choose file or drop it here'}
      </span>
      <ImportSupportedFormats />
      {selectedFileName ? (
        <span className={cn(uiTypographyRecipes.captionStrong, uiTextRecipes.accent)}>
          Choose a replacement file
        </span>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={acceptedFormats}
        aria-label="Select import file"
        className="sr-only"
        onChange={onFileChange}
      />
    </label>
  );
}

function BusyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div
      className={cn(
        'flex',
        'min-h-56',
        'flex-col',
        'items-center',
        'justify-center',
        'gap-4',
        'text-center',
        'md:min-h-72'
      )}
    >
      <Loader2
        className={cn('h-10', 'w-10', 'animate-spin', uiTextRecipes.accent)}
        aria-hidden="true"
      />
      <div className={cn('space-y-2')}>
        <h3 className={cn(uiTypographyRecipes.cardTitle, uiTextRecipes.primary)}>{title}</h3>
        <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>{description}</p>
      </div>
    </div>
  );
}

function ErrorPanel({
  title,
  message,
  primaryAction,
  secondaryAction,
  onPrimary,
  onSecondary,
}: {
  title: string;
  message: string;
  primaryAction: string;
  secondaryAction?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
}) {
  return (
    <div className={cn('space-y-4')}>
      <Alert variant="error" title={title} icon={<AlertCircle className={cn('h-5', 'w-5')} />}>
        {message}
      </Alert>
      <div
        className={cn(
          'flex',
          'w-full',
          'flex-col',
          'gap-[length:var(--spacing-compact-gap)]',
          'md:flex-row',
          '[&_button]:w-full',
          'md:[&_button]:w-auto'
        )}
      >
        <Button type="button" variant="primary" onClick={onPrimary}>
          {primaryAction}
        </Button>
        {secondaryAction && onSecondary ? (
          <Button type="button" variant="secondary" onClick={onSecondary}>
            {secondaryAction}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ImportPanelHeading({
  leading,
  children,
}: {
  leading: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex', 'items-center', 'gap-2')}>
      <div className={cn('shrink-0')}>{leading}</div>
      <h3 className={importPanelHeadingClassName}>{children}</h3>
    </div>
  );
}

function PreviewPanel({
  validation,
  mapping,
  headers,
  mappingExpanded,
  onToggleMapping,
  onMappingChange,
  onMappingPatch,
  onResetMapping,
}: {
  validation: NonNullable<UseImportTransactionsResult['validationResult']>;
  mapping: CsvColumnMapping;
  headers: string[];
  mappingExpanded: boolean;
  onToggleMapping: () => void;
  onMappingChange: (field: keyof CsvColumnMapping, value: string) => void;
  onMappingPatch: (patch: Partial<CsvColumnMapping>) => void;
  onResetMapping: () => void;
}) {
  return (
    <div className={importModalShell.sectionStack}>
      <div className={cn('flex', 'flex-wrap', 'items-center', 'gap-1.5', 'md:gap-2')}>
        <Pill variant="status" tone="info" className={cn('max-w-full', 'truncate')}>
          {importFormatLabel(validation.format)}
        </Pill>
        <Pill variant="status" tone="info" className={cn('max-w-full', 'truncate')}>
          {validation.transaction_count} transactions
        </Pill>
        <Pill variant="status" tone="info" className={cn('max-w-full', 'truncate')}>
          {formatDateRange(validation)}
        </Pill>
      </div>

      {isCsvImportFormat(validation.format) ? (
        <MappingPanel
          mapping={mapping}
          suggestedMapping={validation.suggested_csv_mapping}
          headers={headers}
          expanded={mappingExpanded}
          onToggle={onToggleMapping}
          onChange={onMappingChange}
          onPatch={onMappingPatch}
          onReset={onResetMapping}
        />
      ) : null}

      <PreviewTable rows={validation.preview_rows} />
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      className={cn(
        'border',
        'p-3',
        uiRadiusRecipes.standard,
        ...uiBorderRecipes.subtle,
        ...uiSurfaceRecipes.insetWell
      )}
    >
      <p className={cn(uiTypographyRecipes.label, uiTextRecipes.label)}>{label}</p>
      <p className={cn('mt-2', uiTypographyRecipes.captionStrong, uiTextRecipes.primary)}>
        {value}
      </p>
    </div>
  );
}

function MappingPanel({
  mapping,
  suggestedMapping,
  headers,
  expanded,
  onToggle,
  onChange,
  onPatch,
  onReset,
}: {
  mapping: CsvColumnMapping;
  suggestedMapping: CsvColumnMapping | null;
  headers: string[];
  expanded: boolean;
  onToggle: () => void;
  onChange: (field: keyof CsvColumnMapping, value: string) => void;
  onPatch: (patch: Partial<CsvColumnMapping>) => void;
  onReset: () => void;
}) {
  const [splitAmountMode, setSplitAmountMode] = useState(() => mappingUsesSplitAmount(mapping));

  useEffect(() => {
    setSplitAmountMode(mappingUsesSplitAmount(mapping));
  }, [mapping]);

  const enableSplitAmount = () => {
    setSplitAmountMode(true);
    onPatch({
      amount_column: null,
      debit_column: mapping.debit_column ?? suggestedMapping?.debit_column ?? null,
      credit_column: mapping.credit_column ?? suggestedMapping?.credit_column ?? null,
    });
  };

  const enableSingleAmount = () => {
    setSplitAmountMode(false);
    onPatch({
      amount_column: mapping.amount_column ?? suggestedMapping?.amount_column ?? null,
      debit_column: null,
      credit_column: null,
    });
  };

  return (
    <section
      className={cn(
        'border',
        'p-3',
        'md:p-4',
        uiRadiusRecipes.standard,
        ...uiBorderRecipes.subtle,
        ...uiSurfaceRecipes.card
      )}
    >
      <ImportPanelHeading
        leading={
          <IconButton
            type="button"
            variant="ghost"
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse column mapping' : 'Expand column mapping'}
            onClick={onToggle}
            className={cn(appTitleBarRecipes.settingsIdle)}
          >
            <ChevronDown
              className={cn(
                'h-4',
                'w-4',
                'transition-transform',
                'duration-200',
                expanded && 'rotate-180'
              )}
              aria-hidden="true"
            />
          </IconButton>
        }
      >
        Column mapping
      </ImportPanelHeading>
      {expanded ? (
        <div className={cn('mt-4', 'space-y-4')}>
          <div className={cn('grid', 'gap-4', 'md:grid-cols-2')}>
            <MappingSelect
              targetLabel="Date"
              value={mapping.date_column}
              headers={headers}
              onChange={(value) => onChange('date_column', value)}
              required
            />
            <MappingSelect
              targetLabel="Description"
              value={mapping.description_column}
              headers={headers}
              onChange={(value) => onChange('description_column', value)}
              required
            />
            {splitAmountMode ? (
              <>
                <MappingSelect
                  targetLabel="Debit"
                  value={mapping.debit_column}
                  headers={headers}
                  onChange={(value) => onChange('debit_column', value)}
                />
                <MappingSelect
                  targetLabel="Credit"
                  value={mapping.credit_column}
                  headers={headers}
                  onChange={(value) => onChange('credit_column', value)}
                />
              </>
            ) : (
              <MappingSelect
                targetLabel="Amount"
                value={mapping.amount_column}
                headers={headers}
                onChange={(value) => onChange('amount_column', value)}
              />
            )}
          </div>
          <div
            className={cn(
              'flex',
              'flex-wrap',
              'items-center',
              'justify-between',
              'gap-3',
              'border-t',
              'pt-4',
              ...uiBorderRecipes.divider
            )}
          >
            <label
              htmlFor="import-split-amounts"
              className={cn('flex', 'cursor-pointer', 'items-center', 'gap-2')}
            >
              <span className={cn(uiCheckboxControlRecipes.shell)}>
                <input
                  id="import-split-amounts"
                  type="checkbox"
                  role="switch"
                  aria-checked={splitAmountMode}
                  checked={splitAmountMode}
                  onChange={(event) =>
                    event.target.checked ? enableSplitAmount() : enableSingleAmount()
                  }
                  className={cn(uiCheckboxControlRecipes.field)}
                />
                <span className={cn(uiCheckboxControlRecipes.box)} aria-hidden="true" />
                <Check className={cn(uiCheckboxControlRecipes.icon)} aria-hidden="true" />
              </span>
              <span className={cn(uiTypographyRecipes.captionStrong, uiTextRecipes.primary)}>
                Split Amounts
              </span>
            </label>
            <Button type="button" variant="secondary" onClick={onReset}>
              Reset
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function mappingHeaderOptions(selectId: string, headers: string[]) {
  const seen = new Map<string, number>();
  return headers.map((header) => {
    const token = header.trim() === '' ? '__blank__' : header;
    const occurrence = seen.get(token) ?? 0;
    seen.set(token, occurrence + 1);
    return {
      header,
      key: `${selectId}:${token}:${occurrence}`,
      label: header.trim() === '' ? `Column ${occurrence + 1}` : header,
    };
  });
}

function MappingSelect({
  targetLabel,
  value,
  headers,
  required,
  onChange,
}: {
  targetLabel: string;
  value: string | null;
  headers: string[];
  required?: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className={cn('space-y-2')}>
      <FormLabel htmlFor={id}>
        {targetLabel}
        {required ? <span className={cn('sr-only')}> required</span> : null}
      </FormLabel>
      <Select
        id={id}
        variant="glass"
        value={resolveMappedHeader(headers, value) ?? ''}
        onChange={(event) => onChange(event.target.value)}
        aria-label={targetLabel}
      >
        <option value="">Choose a column</option>
        {mappingHeaderOptions(id, headers).map((option) => (
          <option key={option.key} value={option.header}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

const previewTableHeader = [
  ...uiTransactionsTableRecipes.chromeBar,
  uiTextRecipes.body,
  'transition-colors duration-500',
] as const;

function PreviewTable({ rows }: { rows: PreviewTransaction[] }) {
  return (
    <div className={cn('space-y-2')}>
      <h3 className={importPanelHeadingClassName}>Preview</h3>
      <div
        className={cn(
          'min-w-0',
          'overflow-hidden',
          uiRadiusRecipes.standard,
          'border',
          ...uiBorderRecipes.subtle
        )}
      >
        <div className={cn('overflow-x-auto')} data-no-swipe>
          <table className={cn('w-full', 'table-auto', 'md:min-w-full', 'md:table-fixed')}>
            <thead className={cn(previewTableHeader)}>
              <tr className={cn('border-b', ...uiBorderRecipes.divider)}>
                <th
                  scope="col"
                  className={cn(
                    'whitespace-nowrap',
                    'text-left',
                    previewTableCellClassName,
                    'md:w-[28%]',
                    uiTypographyRecipes.label
                  )}
                >
                  Date
                </th>
                <th
                  scope="col"
                  className={cn(
                    'text-left',
                    previewTableCellClassName,
                    previewDescriptionColumnClassName,
                    'md:w-[44%]',
                    uiTypographyRecipes.label
                  )}
                >
                  Description
                </th>
                <th
                  scope="col"
                  className={cn(
                    'whitespace-nowrap',
                    'text-right',
                    previewTableCellClassName,
                    'md:w-[28%]',
                    uiTypographyRecipes.label
                  )}
                >
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const amount = Number(row.amount);
                return (
                  <tr
                    key={`${row.date}-${row.description}-${row.amount}`}
                    className={cn(
                      transactionsRowRecipes.shell,
                      index % 2 ? transactionsRowRecipes.odd : transactionsRowRecipes.even
                    )}
                  >
                    <td className={previewTableCellClassName} title={row.description}>
                      <span
                        className={cn(
                          'block',
                          'whitespace-nowrap',
                          uiTypographyRecipes.body,
                          uiTextRecipes.primary,
                          'transition-colors',
                          'duration-500'
                        )}
                      >
                        {row.date}
                      </span>
                      <span
                        className={cn(
                          'mt-0.5',
                          'block',
                          'truncate',
                          'min-[400px]:hidden',
                          uiTypographyRecipes.caption,
                          uiTextRecipes.muted
                        )}
                      >
                        {row.description}
                      </span>
                    </td>
                    <td
                      className={cn(
                        previewTableCellClassName,
                        previewDescriptionColumnClassName,
                        'md:max-w-none'
                      )}
                      title={row.description}
                    >
                      <span
                        className={cn(
                          'block',
                          'truncate',
                          uiTypographyRecipes.body,
                          uiTextRecipes.primary,
                          'transition-colors',
                          'duration-500'
                        )}
                      >
                        {row.description}
                      </span>
                    </td>
                    <td
                      className={cn(
                        'whitespace-nowrap',
                        'text-right',
                        'tabular-nums',
                        previewTableCellClassName,
                        uiTypographyRecipes.body,
                        'transition-colors',
                        'duration-500',
                        amount < 0
                          ? uiTextRecipes.danger
                          : amount > 0
                            ? uiTextRecipes.success
                            : uiTextRecipes.muted
                      )}
                    >
                      {fmtUSD(amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SuccessPanel({ result }: { result: ImportResponse }) {
  const rowWarnings = result.errors.length;
  return (
    <div className={importModalShell.sectionStack}>
      <div className={cn('flex', 'items-start', 'gap-3')}>
        <CheckCircle2
          className={cn('mt-0.5', 'h-6', 'w-6', uiTextRecipes.success)}
          aria-hidden="true"
        />
        <div>
          <h3 className={cn(uiTypographyRecipes.cardTitle, uiTextRecipes.primary)}>
            Import complete
          </h3>
          <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>
            {result.total_parsed} parsed transactions were reviewed.
          </p>
        </div>
      </div>
      <div className={cn('grid', 'grid-cols-1', 'gap-3', 'md:grid-cols-2', 'lg:grid-cols-4')}>
        <SummaryTile label="Imported" value={`${result.imported_count} imported`} />
        <SummaryTile label="Skipped" value={`${result.skipped_count} skipped`} />
        <SummaryTile label="Truncated" value={`${result.truncated_count} truncated`} />
        <SummaryTile
          label="Warnings"
          value={`${rowWarnings} ${rowWarnings === 1 ? 'row warning' : 'row warnings'}`}
        />
      </div>
      {result.errors.length > 0 ? (
        <Alert variant="warning" title="Partial import warning">
          <ul className={cn('list-disc', 'space-y-1', 'pl-5')}>
            {result.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
    </div>
  );
}

function FooterActions({
  workflow,
  canImport,
  onClose,
  onChooseFile,
  onImport,
  onDone,
}: {
  workflow: UseImportTransactionsResult;
  canImport: boolean;
  onClose: () => void;
  onChooseFile: () => void;
  onImport: () => void;
  onDone: () => void;
}) {
  if (workflow.status === 'success') {
    return (
      <Button type="button" variant="primary" onClick={onDone}>
        Done
      </Button>
    );
  }

  if (workflow.status === 'preview') {
    return (
      <>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" variant="primary" onClick={onImport} disabled={!canImport}>
          Import
        </Button>
      </>
    );
  }

  if (workflow.status === 'idle') {
    return (
      <>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" variant="primary" onClick={onChooseFile}>
          Choose file
        </Button>
      </>
    );
  }

  return (
    <Button type="button" variant="secondary" onClick={onClose}>
      Cancel
    </Button>
  );
}

function importDestinationLine(
  fileName: string | undefined,
  account: ImportModalAccount
): React.ReactNode {
  const lineClassName = cn(
    uiTypographyRecipes.captionStrong,
    uiTextRecipes.primary,
    'min-w-0',
    'line-clamp-2',
    'md:line-clamp-none',
    'md:truncate'
  );
  const accountLabel = `${account.name} ••${account.mask}`;

  if (!fileName) {
    return <p className={lineClassName}>{accountLabel}</p>;
  }

  const fullTitle = `${fileName} → ${accountLabel}`;

  return (
    <p className={lineClassName} title={fullTitle}>
      {fullTitle}
    </p>
  );
}

function formatDateRange(
  validation: NonNullable<UseImportTransactionsResult['validationResult']>
): string {
  if (!validation.date_range) {
    return 'Unavailable';
  }
  return `${validation.date_range.start_date} to ${validation.date_range.end_date}`;
}

export default ImportModal;
