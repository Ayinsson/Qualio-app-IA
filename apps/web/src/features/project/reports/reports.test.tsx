import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';

import { ToastProvider } from '../../../ui';
import { formatLeadTime, formatPercent, monthSliceLabel, niceScale, shortDay, weekLabel } from './chartLogic';
import { ReportsPanel } from './ReportsPanel';

vi.mock('../../../lib/reports', () => ({
  getOverviewReport: vi.fn(),
  getSprintReport: vi.fn(),
  getMonthlyReport: vi.fn(),
  downloadOverviewCsv: vi.fn(),
  downloadSprintCsv: vi.fn(),
  downloadMonthlyCsv: vi.fn(),
}));
vi.mock('../../../lib/sprints', () => ({ listSprints: vi.fn() }));
vi.mock('../../../lib/pdf', () => ({ exportElementToPdf: vi.fn() }));

describe('chart logic', () => {
  it('builds round axes and never a 0-to-0 scale', () => {
    expect(niceScale(12)).toEqual({ max: 15, ticks: [0, 5, 10, 15] });
    expect(niceScale(5).max).toBeGreaterThanOrEqual(5);
    expect(niceScale(0)).toEqual({ max: 4, ticks: [0, 1, 2, 3, 4] });
  });

  it('labels weeks by their first day, as calendar dates', () => {
    expect(shortDay('2026-11-16')).toBe('16 nov');
    expect(weekLabel('2026-11-16', '2026-W48')).toBe('16 nov');
    expect(weekLabel(undefined, '2026-W48')).toBe('2026-W48');
    expect(monthSliceLabel('2026-11-15')).toBe('15–21 nov');
    expect(monthSliceLabel('2026-11-29')).toBe('29–30 nov');
  });

  it('writes readable figures', () => {
    expect(formatPercent(8.3)).toBe('8,3 %');
    expect(formatPercent(50)).toBe('50 %');
    expect(formatLeadTime(0, 0)).toBe('Sin cierres este mes');
    expect(formatLeadTime(0, 1)).toBe('Menos de 1 día');
    expect(formatLeadTime(0.4, 3)).toBe('Menos de 1 día');
    expect(formatLeadTime(2.25, 3)).toBe('2,3 días');
  });
});

describe('ReportsPanel', () => {
  it('shows the overview with week dates, single-hue priorities and a table view', async () => {
    const reports = await import('../../../lib/reports');
    const sprints = await import('../../../lib/sprints');
    vi.mocked(sprints.listSprints).mockResolvedValue([]);
    vi.mocked(reports.getOverviewReport).mockResolvedValue({
      kpis: { totalTickets: 12, completedTickets: 1, completionRate: 8.3, openBugs: 5, reopenedTickets: 0, rolloverTickets: 0 },
      trend: [
        { bucket: '2026-W47', weekStart: '2026-11-09', created: 0, closed: 0 },
        { bucket: '2026-W48', weekStart: '2026-11-16', created: 12, closed: 1 },
      ],
      priorityDistribution: [
        { priority: 'HIGH', count: 4 },
        { priority: 'MEDIUM', count: 5 },
        { priority: 'LOW', count: 3 },
      ],
      summaryTable: [
        { type: 'TASK', open: 5, inProgress: 1, completed: 1 },
        { type: 'BUG', open: 4, inProgress: 1, completed: 0 },
      ],
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <ReportsPanel accessToken="token" projectId="p1" />
        </ToastProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('8,3 % del total')).toBeInTheDocument();
    expect(screen.getByText('7 tareas · 5 bugs')).toBeInTheDocument();
    expect(screen.getByLabelText('Semana del 16 nov: 12 creados, 1 cerrados')).toBeInTheDocument();

    const chart = screen.getByRole('region', { name: 'Creados y cerrados por semana' });
    fireEvent.click(within(chart).getByRole('button', { name: 'Ver tabla' }));
    const row = within(chart).getByRole('row', { name: /16 nov/ });
    expect(within(row).getByText('12')).toBeInTheDocument();
    expect(screen.queryByText('2026-W48')).not.toBeInTheDocument();
  });

  it('explains when the project has no sprints yet', async () => {
    const sprints = await import('../../../lib/sprints');
    vi.mocked(sprints.listSprints).mockResolvedValue([]);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <ReportsPanel accessToken="token" projectId="p1" />
        </ToastProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sprint' }));
    expect(await screen.findByText(/todavía no tiene sprints/)).toBeInTheDocument();
  });
});
