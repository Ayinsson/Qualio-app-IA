import { Controller, Get, Header, Param, Query, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Response } from 'express';

import { AuthPayload } from '../../auth/auth.types';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { type MonthlyReportDto } from './dto/monthly-report.dto';
import { type OverviewReportDto } from './dto/overview-report.dto';
import { type SprintReportDto } from './dto/sprint-report.dto';
import { ReportsService } from './reports.service';

@Controller('projects/:projectId/reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  getOverview(
    @Req() req: { user?: AuthPayload },
    @Param('projectId') projectId: string,
    @Query('weeks') weeks?: string,
  ): Promise<OverviewReportDto> {
    const parsedWeeks = weeks ? Number(weeks) : undefined;
    return this.reportsService.getOverview(this.getUserId(req), projectId, parsedWeeks);
  }

  @Get('overview.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async getOverviewCsv(
    @Req() req: { user?: AuthPayload },
    @Param('projectId') projectId: string,
    @Query('weeks') weeks: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const parsedWeeks = weeks ? Number(weeks) : undefined;
    res.setHeader('Content-Disposition', `attachment; filename="overview-${projectId}.csv"`);
    return this.reportsService.getOverviewCsv(this.getUserId(req), projectId, parsedWeeks);
  }

  @Get('sprints/:sprintId')
  getSprintReport(
    @Req() req: { user?: AuthPayload },
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
  ): Promise<SprintReportDto> {
    return this.reportsService.getSprintReport(this.getUserId(req), projectId, sprintId);
  }

  @Get('sprints/:sprintId.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async getSprintCsv(
    @Req() req: { user?: AuthPayload },
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    res.setHeader('Content-Disposition', `attachment; filename="sprint-${sprintId}.csv"`);
    return this.reportsService.getSprintCsv(this.getUserId(req), projectId, sprintId);
  }

  @Get('monthly')
  getMonthlyReport(
    @Req() req: { user?: AuthPayload },
    @Param('projectId') projectId: string,
    @Query('month') month?: string,
  ): Promise<MonthlyReportDto> {
    return this.reportsService.getMonthlyReport(
      this.getUserId(req),
      projectId,
      month ?? new Date().toISOString().slice(0, 7),
    );
  }

  @Get('monthly.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async getMonthlyCsv(
    @Req() req: { user?: AuthPayload },
    @Param('projectId') projectId: string,
    @Query('month') month: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const normalizedMonth = month ?? new Date().toISOString().slice(0, 7);
    res.setHeader('Content-Disposition', `attachment; filename="monthly-${normalizedMonth}.csv"`);
    return this.reportsService.getMonthlyCsv(this.getUserId(req), projectId, normalizedMonth);
  }

  private getUserId(req: { user?: AuthPayload }): string {
    const userId = req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('Sesion invalida.');
    }

    return userId;
  }
}
