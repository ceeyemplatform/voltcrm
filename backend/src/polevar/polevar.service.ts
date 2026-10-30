import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PolevarService {
  constructor(private prisma: PrismaService) {}

  /** One row per work that has a saved Polevar sheet, with per-category totals. */
  async getSheets(
    userId: string,
    filter?: { workSiteId?: string; section?: string; search?: string },
  ) {
    const where: any = { userId };
    if (filter?.workSiteId) where.workSiteId = filter.workSiteId;
    if (filter?.search) {
      where.OR = [
        { workCode: { contains: filter.search, mode: 'insensitive' } },
        { name: { contains: filter.search, mode: 'insensitive' } },
        { electricalSection: { contains: filter.search, mode: 'insensitive' } },
        { workSite: { name: { contains: filter.search, mode: 'insensitive' } } },
      ];
    }

    const works = await this.prisma.work.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        workCode: true,
        name: true,
        date: true,
        status: true,
        electricalSection: true,
        polevarData: true,
        updatedAt: true,
        workSite: { select: { id: true, name: true, section: true } },
      },
    });

    const sheets = works
      .filter((w) => w.polevarData && typeof w.polevarData === 'object')
      .map((w) => {
        const data = w.polevarData as any;
        const columns: any[] = Array.isArray(data.columns) ? data.columns : [];
        const rows: any[] = Array.isArray(data.rows) ? data.rows : [];
        const categoryOf = new Map(columns.map((c) => [c.id, c.category]));
        const totals = { materials: 0, labour: 0, takenBack: 0 };

        for (const row of rows) {
          for (const [colId, raw] of Object.entries(row?.values || {})) {
            const qty = Number(raw) || 0;
            const category = categoryOf.get(colId) as keyof typeof totals;
            if (category && category in totals) totals[category] += qty;
          }
        }

        return {
          workId: w.id,
          workCode: w.workCode,
          workName: w.name,
          workDate: w.date,
          workStatus: w.status,
          section: w.electricalSection || w.workSite?.section || null,
          workSiteId: w.workSite?.id || null,
          workSiteName: w.workSite?.name || null,
          title: data.title || null,
          locationCount: rows.length,
          itemCount: columns.length,
          totals,
          updatedAt: w.updatedAt,
        };
      })
      .filter((s) => !filter?.section || s.section === filter.section);

    return sheets;
  }

  async getReport(
    userId: string,
    filter?: {
      startDate?: string;
      endDate?: string;
      workCode?: string;
      workSiteId?: string;
      search?: string;
    },
  ) {
    const workWhere: any = { userId };

    if (filter?.workCode) {
      workWhere.workCode = {
        contains: filter.workCode,
        mode: 'insensitive',
      };
    }

    if (filter?.workSiteId) {
      workWhere.workSiteId = filter.workSiteId;
    }

    if (filter?.startDate || filter?.endDate) {
      workWhere.date = {};
      if (filter.startDate) {
        workWhere.date.gte = new Date(filter.startDate);
      }
      if (filter.endDate) {
        workWhere.date.lte = new Date(filter.endDate);
      }
    }

    const materialWhere: any = {
      work: workWhere,
    };

    if (filter?.search) {
      materialWhere.OR = [
        { materialName: { contains: filter.search, mode: 'insensitive' } },
        { remarks: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const materials = await this.prisma.workMaterial.findMany({
      where: materialWhere,
      include: {
        work: {
          include: {
            workSite: true,
          },
        },
      },
      orderBy: {
        work: {
          date: 'desc',
        },
      },
    });

    let totalIssued = 0;
    let totalUsed = 0;
    let totalVariance = 0;

    const rows = materials.map((m) => {
      totalIssued += m.quantityIssued;
      totalUsed += m.quantityUsed;
      totalVariance += m.variance;

      return {
        id: m.id,
        workId: m.workId,
        workCode: m.work.workCode,
        workName: m.work.name,
        workDate: m.work.date,
        workStatus: m.work.status,
        workSiteId: m.work.workSiteId,
        workSiteName: m.work.workSite?.name || 'Unassigned',
        materialName: m.materialName,
        quantityIssued: m.quantityIssued,
        quantityUsed: m.quantityUsed,
        variance: m.variance,
        remarks: m.remarks,
      };
    });

    return {
      summary: {
        totalRows: rows.length,
        totalIssued,
        totalUsed,
        totalVariance,
      },
      rows,
    };
  }
}
