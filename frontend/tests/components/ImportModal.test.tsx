import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportModalView } from '@/features/import/components/ImportModal';
import type { UseImportTransactionsResult } from '@/features/import/hooks/useImportTransactions';
import type { CsvColumnMapping, ImportResponse, ValidateResponse } from '@/models/import';
import { ThemeTestProvider } from '../utils/ThemeTestProvider';

const completeMapping: CsvColumnMapping = {
  date_column: 'Date',
  amount_column: null,
  debit_column: 'Debit Amount',
  credit_column: 'Credit Amount',
  description_column: 'Description',
};

const incompleteMapping: CsvColumnMapping = {
  date_column: null,
  amount_column: null,
  debit_column: null,
  credit_column: null,
  description_column: 'Description',
};

const csvValidation: ValidateResponse = {
  valid: true,
  format: 'Csv',
  transaction_count: 3,
  truncated_count: 1,
  date_range: {
    start_date: '2026-01-01',
    end_date: '2026-01-03',
  },
  preview_rows: [
    {
      date: '2026-01-01',
      description: 'Coffee Shop With A Very Long Merchant Name',
      amount: '-4.75',
    },
    { date: '2026-01-02', description: 'Payroll', amount: '2500.00' },
  ],
  suggested_csv_mapping: completeMapping,
  csv_headers: ['Date', 'Description', 'Debit Amount', 'Credit Amount'],
  sample_csv_rows: [
    ['Date', 'Description', 'Debit Amount', 'Credit Amount'],
    ['2026-01-01', 'Coffee Shop', '4.75', ''],
  ],
  errors: [],
};

const importResult: ImportResponse = {
  imported_count: 2,
  skipped_count: 1,
  truncated_count: 1,
  total_parsed: 4,
  errors: ['Row 4 was skipped because the amount was missing.'],
};

function workflow(
  overrides: Partial<UseImportTransactionsResult> = {}
): UseImportTransactionsResult {
  return {
    status: 'idle',
    selectedFile: null,
    validationResult: null,
    importResult: null,
    csvMapping: null,
    error: null,
    validateFile: jest.fn().mockResolvedValue(csvValidation),
    importFile: jest.fn().mockResolvedValue(importResult),
    setCsvMapping: jest.fn(),
    reset: jest.fn(),
    backToPreview: jest.fn(),
    ...overrides,
  };
}

function renderModal(activeWorkflow: UseImportTransactionsResult) {
  return render(
    <ThemeTestProvider>
      <ImportModalView
        account={{ id: 'account-1', name: 'Checking', mask: '1234' }}
        isOpen
        onClose={jest.fn()}
        onImportSuccess={jest.fn()}
        workflow={activeWorkflow}
      />
    </ThemeTestProvider>
  );
}

describe('ImportModal', () => {
  it('shows a tappable upload drop zone and validates selected and dropped files', async () => {
    const user = userEvent.setup();
    const activeWorkflow = workflow();
    renderModal(activeWorkflow);

    const file = new File(['date,description,amount'], 'bank.csv', { type: 'text/csv' });
    await user.upload(
      screen.getByLabelText(/choose an import file \(csv, ofx, qbo, qfx, or qbx\)/i),
      file
    );
    expect(activeWorkflow.validateFile).toHaveBeenCalledWith(file);

    const dropped = new File(['ofx'], 'statement.qbo', { type: 'application/octet-stream' });
    fireEvent.drop(screen.getByTestId('import-drop-zone'), {
      dataTransfer: { files: [dropped] },
    });
    expect(activeWorkflow.validateFile).toHaveBeenCalledWith(dropped);
  });

  it('prevents dismissal and hides footer actions while validating', () => {
    const onClose = jest.fn();
    const activeWorkflow = workflow({
      status: 'validating',
      selectedFile: new File(['content'], 'statement.qfx'),
    });

    render(
      <ThemeTestProvider>
        <ImportModalView
          account={{ id: 'account-1', name: 'Checking', mask: '1234' }}
          isOpen
          onClose={onClose}
          workflow={activeWorkflow}
        />
      </ThemeTestProvider>
    );

    expect(screen.getByText(/validating statement.qfx/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    fireEvent.pointerDown(screen.getByTestId('modal-backdrop'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows preview metadata, table rows, and keeps complete CSV mapping collapsed by default', () => {
    renderModal(
      workflow({
        status: 'preview',
        selectedFile: new File(['csv'], 'bank.csv'),
        validationResult: csvValidation,
        csvMapping: completeMapping,
      })
    );

    expect(screen.getByText('3 transactions')).toBeVisible();
    expect(screen.getByText('2026-01-01 to 2026-01-03')).toBeVisible();
    expect(screen.getByText('CSV')).toBeVisible();
    expect(screen.getByText(/bank\.csv → Checking ••1234/)).toBeVisible();
    expect(
      screen.getAllByText('Coffee Shop With A Very Long Merchant Name').length
    ).toBeGreaterThan(0);
    expect(screen.getByText('-$4.75')).toBeVisible();
    expect(screen.getByText('$2,500.00')).toBeVisible();
    expect(screen.getByRole('button', { name: /expand column mapping/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('renders mapping selects when CSV headers include duplicate or blank names', () => {
    renderModal(
      workflow({
        status: 'preview',
        selectedFile: new File(['csv'], 'bank.csv'),
        validationResult: {
          ...csvValidation,
          csv_headers: ['Column 1', 'Column 2', 'Date', 'Description'],
          sample_csv_rows: [
            ['Column 1', 'Column 2', 'Date', 'Description'],
            ['a', 'b', '2026-01-01', 'Coffee'],
          ],
          suggested_csv_mapping: incompleteMapping,
        },
        csvMapping: incompleteMapping,
      })
    );

    const dateSelect = screen.getByLabelText('Date');
    const options = Array.from(dateSelect.querySelectorAll('option')).map(
      (option) => option.textContent
    );
    expect(options).toEqual(['Choose a column', 'Column 1', 'Column 2', 'Date', 'Description']);
  });

  it('pre-selects mapped columns when header casing differs from stored mapping', async () => {
    const user = userEvent.setup();
    renderModal(
      workflow({
        status: 'preview',
        selectedFile: new File(['csv'], 'bank.csv'),
        validationResult: {
          ...csvValidation,
          csv_headers: ['DATE', 'DESCRIPTION', 'AMOUNT'],
          sample_csv_rows: [
            ['DATE', 'DESCRIPTION', 'AMOUNT'],
            ['2026-01-01', 'Coffee Shop', '-4.75'],
          ],
          suggested_csv_mapping: {
            date_column: 'DATE',
            description_column: 'DESCRIPTION',
            amount_column: 'AMOUNT',
            debit_column: null,
            credit_column: null,
          },
        },
        csvMapping: {
          date_column: 'date',
          description_column: 'description',
          amount_column: 'amount',
          debit_column: null,
          credit_column: null,
        },
      })
    );

    await user.click(screen.getByRole('button', { name: /expand column mapping/i }));

    expect(screen.getByLabelText('Date')).toHaveValue('DATE');
    expect(screen.getByLabelText('Description')).toHaveValue('DESCRIPTION');
    expect(screen.getByLabelText('Amount')).toHaveValue('AMOUNT');
  });

  it('switches between single and split amount column layouts', async () => {
    const user = userEvent.setup();
    const setCsvMapping = jest.fn();
    const singleAmountMapping: CsvColumnMapping = {
      date_column: 'Date',
      description_column: 'Description',
      amount_column: 'Amount',
      debit_column: null,
      credit_column: null,
    };

    renderModal(
      workflow({
        status: 'preview',
        selectedFile: new File(['csv'], 'bank.csv'),
        validationResult: {
          ...csvValidation,
          sample_csv_rows: [
            ['Date', 'Description', 'Amount', 'Debit Amount', 'Credit Amount'],
            ['2026-01-01', 'Coffee Shop', '-4.75', '4.75', ''],
          ],
          suggested_csv_mapping: completeMapping,
        },
        csvMapping: singleAmountMapping,
        setCsvMapping,
      })
    );

    await user.click(screen.getByRole('button', { name: /expand column mapping/i }));
    await user.click(screen.getByRole('switch', { name: /split amounts/i }));

    expect(screen.getByLabelText('Debit')).toBeInTheDocument();
    expect(screen.getByLabelText('Credit')).toBeInTheDocument();
    expect(setCsvMapping).toHaveBeenCalledWith({
      ...singleAmountMapping,
      amount_column: null,
      debit_column: 'Debit Amount',
      credit_column: 'Credit Amount',
    });

    await user.click(screen.getByRole('switch', { name: /split amounts/i }));

    expect(screen.getByLabelText('Amount')).toBeInTheDocument();
    expect(setCsvMapping).toHaveBeenLastCalledWith({
      date_column: 'Date',
      description_column: 'Description',
      amount_column: 'Amount',
      debit_column: null,
      credit_column: null,
    });
  });

  it('auto-expands incomplete CSV mapping and enforces required mapping rules', async () => {
    const user = userEvent.setup();
    const setCsvMapping = jest.fn();
    renderModal(
      workflow({
        status: 'preview',
        selectedFile: new File(['csv'], 'bank.csv'),
        validationResult: { ...csvValidation, suggested_csv_mapping: incompleteMapping },
        csvMapping: incompleteMapping,
        setCsvMapping,
      })
    );

    expect(screen.getByRole('button', { name: /collapse column mapping/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByRole('button', { name: /^import$/i })).toBeDisabled();

    await user.selectOptions(screen.getByLabelText('Date'), 'Date');
    expect(setCsvMapping).toHaveBeenLastCalledWith({ ...incompleteMapping, date_column: 'Date' });

    await user.selectOptions(screen.getByLabelText('Amount'), 'Debit Amount');
    expect(setCsvMapping).toHaveBeenLastCalledWith({
      ...incompleteMapping,
      amount_column: 'Debit Amount',
      debit_column: null,
      credit_column: null,
    });
  });

  it('keeps import disabled when split amount mapping leaves a column unselected', () => {
    renderModal(
      workflow({
        status: 'preview',
        selectedFile: new File(['csv'], 'bank.csv'),
        validationResult: { ...csvValidation, suggested_csv_mapping: completeMapping },
        csvMapping: {
          ...completeMapping,
          credit_column: null,
        },
      })
    );

    expect(screen.getByRole('button', { name: /^import$/i })).toBeDisabled();
    expect(screen.getByLabelText('Credit')).toHaveValue('');
  });

  it('shows distinct actionable validation and import errors', () => {
    renderModal(
      workflow({
        status: 'validation-error',
        selectedFile: new File(['bad'], 'bad.csv'),
        error: 'Unsupported file structure.',
      })
    );

    expect(screen.getByText('Validation failed')).toBeVisible();
    expect(screen.getByRole('button', { name: /try another file/i })).toBeVisible();

    renderModal(
      workflow({
        status: 'error',
        selectedFile: new File(['csv'], 'bank.csv'),
        validationResult: csvValidation,
        csvMapping: completeMapping,
        error: 'Import failed.',
      })
    );

    expect(screen.getByText('Import failed')).toBeVisible();
    expect(screen.getByRole('button', { name: /try again/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /choose another file/i })).toBeVisible();
  });

  it('shows success receipt counts and row warnings', () => {
    renderModal(
      workflow({
        status: 'success',
        selectedFile: new File(['csv'], 'bank.csv'),
        validationResult: csvValidation,
        importResult,
      })
    );

    expect(screen.getByText('Import complete')).toBeVisible();
    expect(screen.getByText('2 imported')).toBeVisible();
    expect(screen.getByText('1 skipped')).toBeVisible();
    expect(screen.getByText('1 truncated')).toBeVisible();
    expect(screen.getByText('1 row warning')).toBeVisible();
    expect(screen.getByText(importResult.errors[0])).toBeVisible();
  });
});
