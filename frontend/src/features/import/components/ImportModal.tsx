import { AlertCircle, CheckCircle2, Loader2, UploadCloud, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import type { CsvColumnMapping, ImportResponse, PreviewTransaction } from '@/models/import';
import { Alert, Button, cn, FormLabel, GlassCard, Modal, Pill, Select } from '@/ui/primitives';
import {
  border as uiBorderRecipes,
  status as uiStatusRecipes,
  surface as uiSurfaceRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
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

const acceptedFormats = '.csv,.qbo,.qfx';
const maxSizeText = 'CSV, QBO, and QFX files up to 10 MB';
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
  const currentMapping = workflow.csvMapping ?? validation?.suggested_csv_mapping ?? emptyMapping;
  const headers = validation?.sample_csv_rows[0] ?? [];
  const mappingComplete = validation?.format !== 'Csv' || isMappingComplete(currentMapping);
  const needsMapping = validation?.format === 'Csv' && !mappingComplete;
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

  const resetDetectedMapping = () => {
    workflow.setCsvMapping(validation?.suggested_csv_mapping ?? null);
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
      className={cn('max-h-[min(82dvh,42rem)]')}
      containerClassName={cn(
        'p-[env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)]'
      )}
      onEscapeKeyDown={(event) => {
        if (busy) {
          event.preventDefault();
        }
      }}
    >
      <GlassCard
        variant="accent"
        rounded="xl"
        padding="lg"
        withInnerEffects={false}
        className={cn('flex', 'max-h-[min(82dvh,42rem)]', 'flex-col', 'overflow-hidden', 'p-0')}
      >
        <header
          className={cn(
            'flex-shrink-0',
            'space-y-4',
            'border-b',
            'px-5',
            'pb-4',
            'pt-5',
            'sm:px-6',
            ...uiBorderRecipes.divider
          )}
        >
          <div className={cn('flex', 'items-start', 'justify-between', 'gap-4')}>
            <div className={cn('min-w-0', 'space-y-2')}>
              <div className={cn('flex', 'flex-wrap', 'items-center', 'gap-2')}>
                <h2
                  id={titleId}
                  className={cn(uiTypographyRecipes.cardTitle, uiTextRecipes.primary)}
                >
                  Import transactions
                </h2>
                {validation?.format ? (
                  <Pill variant="status" tone="info">
                    {validation.format}
                  </Pill>
                ) : (
                  <Pill variant="status" tone={statusPillTone(workflow.status)}>
                    {statusLabel(workflow.status)}
                  </Pill>
                )}
              </div>
              <div
                className={cn(
                  'grid',
                  'gap-1',
                  'md:grid-cols-[auto_auto]',
                  'md:items-center',
                  'md:gap-x-3',
                  uiTypographyRecipes.caption,
                  uiTextRecipes.muted
                )}
              >
                <span>
                  {account.name} <span className={uiTextRecipes.primary}>••{account.mask}</span>
                </span>
                {selectedFileName ? (
                  <span className={cn('truncate')} title={selectedFileName}>
                    {selectedFileName}
                  </span>
                ) : null}
              </div>
            </div>
            {canClose ? (
              <Button
                type="button"
                variant="icon"
                size="icon"
                aria-label="Close import modal"
                onClick={handleClose}
              >
                <X className={cn('h-4', 'w-4')} aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </header>

        <div className={cn('min-h-0', 'flex-1', 'overflow-y-auto', 'px-5', 'py-5', 'sm:px-6')}>
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
              description={`Checking file format and preview rows for ${account.name} ••${account.mask}.`}
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
              accountMask={account.mask}
              validation={validation}
              mapping={currentMapping}
              headers={headers}
              mappingComplete={mappingComplete}
              mappingExpanded={mappingExpanded}
              onToggleMapping={() => setMappingExpanded((value) => !value)}
              onMappingChange={handleMappingChange}
              onResetMapping={resetDetectedMapping}
            />
          ) : null}

          {workflow.status === 'importing' ? (
            <BusyPanel
              title="Importing transactions"
              description={`${validation?.transaction_count ?? 0} parsed transactions are being written for ${account.name} ••${account.mask}.`}
            />
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
            aria-label="Choose a CSV, QBO, or QFX file"
            className="sr-only"
            disabled={busy}
            onChange={handleFileChange}
          />
        </div>

        <footer
          className={cn(
            'flex-shrink-0',
            'border-t',
            'px-5',
            'py-4',
            'pb-[max(1rem,env(safe-area-inset-bottom))]',
            'sm:px-6',
            ...uiBorderRecipes.divider
          )}
        >
          <div className={cn('flex', 'flex-col-reverse', 'gap-3', 'md:flex-row', 'md:justify-end')}>
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
        'min-h-64',
        'cursor-pointer',
        'flex-col',
        'items-center',
        'justify-center',
        'gap-4',
        'rounded-3xl',
        'border',
        'border-dashed',
        'p-8',
        'text-center',
        'transition',
        'hover:-translate-y-0.5',
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
      <span className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>{maxSizeText}</span>
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
        'min-h-72',
        'flex-col',
        'items-center',
        'justify-center',
        'gap-4',
        'text-center'
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
      <div className={cn('flex', 'flex-col', 'gap-3', 'md:flex-row')}>
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

function PreviewPanel({
  accountMask,
  validation,
  mapping,
  headers,
  mappingComplete,
  mappingExpanded,
  onToggleMapping,
  onMappingChange,
  onResetMapping,
}: {
  accountMask: string;
  validation: NonNullable<UseImportTransactionsResult['validationResult']>;
  mapping: CsvColumnMapping;
  headers: string[];
  mappingComplete: boolean;
  mappingExpanded: boolean;
  onToggleMapping: () => void;
  onMappingChange: (field: keyof CsvColumnMapping, value: string) => void;
  onResetMapping: () => void;
}) {
  return (
    <div className={cn('space-y-5')}>
      <div className={cn('grid', 'grid-cols-2', 'gap-3', 'lg:grid-cols-4')}>
        <SummaryTile label="Transactions" value={`${validation.transaction_count} transactions`} />
        <SummaryTile label="Date range" value={formatDateRange(validation)} />
        <SummaryTile label="Format" value={validation.format ?? 'Unknown'} />
        <SummaryTile label="Account" value={`••${accountMask}`} />
      </div>

      <Alert
        variant={mappingComplete ? 'success' : 'warning'}
        title={mappingComplete ? 'Ready to import' : 'Choose columns to continue'}
      >
        {mappingComplete
          ? 'Review the sample rows, then import when this looks like the right file for this account.'
          : 'Date and description are required, plus either a signed amount column or debit and credit columns.'}
      </Alert>

      {validation.format === 'Csv' ? (
        <MappingPanel
          mapping={mapping}
          headers={headers}
          expanded={mappingExpanded}
          onToggle={onToggleMapping}
          onChange={onMappingChange}
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
        'rounded-2xl',
        'border',
        'p-3',
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
  headers,
  expanded,
  onToggle,
  onChange,
  onReset,
}: {
  mapping: CsvColumnMapping;
  headers: string[];
  expanded: boolean;
  onToggle: () => void;
  onChange: (field: keyof CsvColumnMapping, value: string) => void;
  onReset: () => void;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl',
        'border',
        'p-4',
        ...uiBorderRecipes.subtle,
        ...uiSurfaceRecipes.card
      )}
    >
      <button
        type="button"
        className={cn('flex', 'w-full', 'items-center', 'justify-between', 'gap-3', 'text-left')}
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className={cn(uiTypographyRecipes.bodyStrong, uiTextRecipes.primary)}>
          Review column mapping
        </span>
        <span className={cn('truncate', uiTypographyRecipes.caption, uiTextRecipes.muted)}>
          {mappingSummary(mapping)}
        </span>
      </button>
      {expanded ? (
        <div className={cn('mt-4', 'space-y-4')}>
          <div className={cn('grid', 'gap-4', 'md:grid-cols-2')}>
            <MappingSelect
              label="Date column"
              value={mapping.date_column}
              headers={headers}
              onChange={(value) => onChange('date_column', value)}
              required
            />
            <MappingSelect
              label="Description column"
              value={mapping.description_column}
              headers={headers}
              onChange={(value) => onChange('description_column', value)}
              required
            />
            <MappingSelect
              label="Amount column"
              value={mapping.amount_column}
              headers={headers}
              onChange={(value) => onChange('amount_column', value)}
            />
            <MappingSelect
              label="Debit column"
              value={mapping.debit_column}
              headers={headers}
              onChange={(value) => onChange('debit_column', value)}
            />
            <MappingSelect
              label="Credit column"
              value={mapping.credit_column}
              headers={headers}
              onChange={(value) => onChange('credit_column', value)}
            />
          </div>
          <Alert variant="info" tone="subtle">
            Preview rows may stay unchanged after edits. The adjusted mapping will be used when
            importing.
          </Alert>
          <Button type="button" variant="secondary" onClick={onReset}>
            Reset detected mapping
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function MappingSelect({
  label,
  value,
  headers,
  required,
  onChange,
}: {
  label: string;
  value: string | null;
  headers: string[];
  required?: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className={cn('space-y-2')}>
      <FormLabel htmlFor={id}>
        {label}
        {required ? <span className={cn('sr-only')}> required</span> : null}
      </FormLabel>
      <Select
        id={id}
        variant="glass"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
      >
        <option value="">Not used</option>
        {headers.map((header) => (
          <option key={header} value={header}>
            {header}
          </option>
        ))}
      </Select>
    </div>
  );
}

function PreviewTable({ rows }: { rows: PreviewTransaction[] }) {
  return (
    <div className={cn('overflow-x-auto', 'rounded-2xl', 'border', ...uiBorderRecipes.subtle)}>
      <table className={cn('min-w-full', 'divide-y', ...uiBorderRecipes.divider)}>
        <thead className={cn(...uiSurfaceRecipes.insetWell)}>
          <tr>
            <TableHeader>Date</TableHeader>
            <TableHeader>Description</TableHeader>
            <TableHeader>Amount</TableHeader>
          </tr>
        </thead>
        <tbody className={cn('divide-y', ...uiBorderRecipes.divider)}>
          {rows.map((row) => (
            <tr key={`${row.date}-${row.description}-${row.amount}`}>
              <td
                className={cn(
                  'whitespace-nowrap',
                  'px-4',
                  'py-3',
                  uiTypographyRecipes.caption,
                  uiTextRecipes.muted
                )}
              >
                {row.date}
              </td>
              <td
                className={cn(
                  'max-w-[16rem]',
                  'truncate',
                  'px-4',
                  'py-3',
                  uiTypographyRecipes.captionStrong,
                  uiTextRecipes.primary
                )}
                title={row.description}
              >
                {row.description}
              </td>
              <td
                className={cn(
                  'whitespace-nowrap',
                  'px-4',
                  'py-3',
                  'text-right',
                  'tabular-nums',
                  uiTypographyRecipes.captionStrong,
                  Number(row.amount) < 0 ? uiTextRecipes.danger : uiTextRecipes.success
                )}
              >
                {formatCurrency(row.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableHeader({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className={cn('px-4', 'py-3', 'text-left', uiTypographyRecipes.label, uiTextRecipes.label)}
    >
      {children}
    </th>
  );
}

function SuccessPanel({ result }: { result: ImportResponse }) {
  const rowWarnings = result.errors.length;
  return (
    <div className={cn('space-y-5')}>
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
      <div className={cn('grid', 'grid-cols-2', 'gap-3', 'lg:grid-cols-4')}>
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
          Import transactions
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

function isMappingComplete(mapping: CsvColumnMapping): boolean {
  const hasDateAndDescription = Boolean(mapping.date_column && mapping.description_column);
  const hasAmount = Boolean(mapping.amount_column);
  const hasSplitAmount = Boolean(mapping.debit_column || mapping.credit_column);
  return hasDateAndDescription && (hasAmount || hasSplitAmount);
}

function mappingSummary(mapping: CsvColumnMapping): string {
  const amount =
    mapping.amount_column ??
    [mapping.debit_column, mapping.credit_column].filter(Boolean).join('/');
  return `Date: ${mapping.date_column ?? 'Missing'} · Description: ${mapping.description_column ?? 'Missing'} · Amount: ${amount || 'Missing'}`;
}

function formatDateRange(
  validation: NonNullable<UseImportTransactionsResult['validationResult']>
): string {
  if (!validation.date_range) {
    return 'Unavailable';
  }
  return `${validation.date_range.start_date} to ${validation.date_range.end_date}`;
}

function formatCurrency(rawAmount: string): string {
  const amount = Number(rawAmount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function statusLabel(status: UseImportTransactionsResult['status']): string {
  const labels = {
    idle: 'Upload',
    validating: 'Validating',
    preview: 'Preview',
    'validation-error': 'Needs attention',
    importing: 'Importing',
    success: 'Complete',
    error: 'Needs attention',
  } as const;
  return labels[status];
}

function statusPillTone(status: UseImportTransactionsResult['status']) {
  if (status === 'success') {
    return 'success';
  }
  if (status === 'validation-error' || status === 'error') {
    return 'danger';
  }
  if (status === 'validating' || status === 'importing') {
    return 'warning';
  }
  return 'info';
}

export default ImportModal;
