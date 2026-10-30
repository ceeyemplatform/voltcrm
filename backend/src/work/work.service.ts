import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkDto } from './dto/create-work.dto';
import { UpdateWorkDto } from './dto/update-work.dto';
import { clearExpenseSummaryCache } from '../expense/expense.service';

import { assertOwnedRefs } from '../common/ownership';
@Injectable()
export class WorkService {
  constructor(private prisma: PrismaService) {}

  async getOptions(userId: string) {
    return this.prisma.work.findMany({
      where: { userId },
      select: {
        id: true,
        workCode: true,
        name: true,
        workSite: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findAll(
    userId: string,
    query?: {
      search?: string;
      status?: string;
      workSiteId?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const where: any = { userId };

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.workSiteId) {
      where.workSiteId = query.workSiteId;
    }

    if (query?.startDate || query?.endDate) {
      where.date = {};
      if (query.startDate) {
        where.date.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.date.lte = new Date(query.endDate);
      }
    }

    if (query?.search) {
      where.OR = [
        { workCode: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { workOrder: { contains: query.search, mode: 'insensitive' } },
        { electricalSection: { contains: query.search, mode: 'insensitive' } },
        { typeOfWork: { contains: query.search, mode: 'insensitive' } },
        { gstMillNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.work.findMany({
      where,
      orderBy: { date: 'desc' },
      select: {
        id: true,
        userId: true,
        date: true,
        endDate: true,
        workCode: true,
        name: true,
        workOrder: true,
        woDate: true,
        contractorAmount: true,
        status: true,
        gstMillNumber: true,
        gstDate: true,
        electricalSection: true,
        typeOfWork: true,
        workSiteId: true,
        workSite: {
          select: {
            id: true,
            name: true,
            section: true,
          },
        },
        dailyDetails: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOne(userId: string, id: string) {
    const work = await this.prisma.work.findFirst({
      where: { id, userId },
      include: {
        workSite: true,
        labours: {
          include: { labour: true },
        },
        materials: true,
      },
    });

    if (!work) {
      throw new NotFoundException(`Work record #${id} not found`);
    }

    return work;
  }

  async create(userId: string, dto: CreateWorkDto) {
    // Prevent duplicate work code for this user
    const existing = await this.prisma.work.findFirst({
      where: {
        userId,
        workCode: { equals: dto.workCode.trim(), mode: 'insensitive' },
      },
    });
    if (existing) {
      throw new BadRequestException(
        `Work code "${dto.workCode.trim()}" already exists. Please use a unique work code.`,
      );
    }

    const { labours, materials, ...workData } = dto;
    await assertOwnedRefs(this.prisma, userId, {
      workSiteId: workData.workSiteId,
      labourIds: (labours || []).map((l) => l.labourId),
    });

    const materialsData = (materials || []).map((m) => {
      const issued = Number(m.quantityIssued || 0);
      const used = Number(m.quantityUsed || 0);
      return {
        materialName: m.materialName,
        quantityIssued: issued,
        quantityUsed: used,
        variance: m.variance !== undefined ? Number(m.variance) : issued - used,
        remarks: m.remarks,
      };
    });

    const laboursData = (labours || []).map((l) => ({
      labourId: l.labourId || null,
      labourName: l.labourName,
      category: l.category,
      wage: Number(l.wage || 0),
    }));

    let initialDailyDetails = workData.dailyDetails;
    if (
      (!initialDailyDetails ||
        (Array.isArray(initialDailyDetails) && initialDailyDetails.length === 0)) &&
      laboursData.length > 0
    ) {
      const dateStr = workData.date
        ? new Date(workData.date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      initialDailyDetails = [
        {
          id: `day-${Date.now()}-1`,
          date: dateStr,
          workDone: `Work mobilized & day 1 workforce deployed - ${workData.name || 'Site execution'}`,
          labourCount: laboursData.length,
          labourDetails: laboursData
            .map((l) => `${l.labourName} (₹${l.wage})`)
            .join(', '),
          labourMembers: laboursData.map((l) => ({
            labourId: l.labourId || undefined,
            name: l.labourName,
            category: l.category || undefined,
            wage: l.wage,
            isAdditional: false,
          })),
          additionalMembersCount: 0,
          totalDailyWage: laboursData.reduce(
            (sum, l) => sum + Number(l.wage || 0),
            0,
          ),
          remarks: 'Auto-populated from initial work entry labour allocation',
          createdAt: new Date().toISOString(),
        },
      ];
    }

    return this.prisma.work.create({
      data: {
        ...workData,
        dailyDetails: initialDailyDetails || [],
        date: new Date(workData.date),
        endDate: workData.endDate
          ? new Date(workData.endDate)
          : workData.status === 'COMPLETED'
          ? new Date(workData.date)
          : null,
        woDate: workData.woDate ? new Date(workData.woDate) : null,
        gstDate: workData.gstDate ? new Date(workData.gstDate) : null,
        userId,
        labours: {
          create: laboursData,
        },
        materials: {
          create: materialsData,
        },
      },
      include: {
        workSite: true,
        labours: true,
        materials: true,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateWorkDto) {
    const current = await this.findOne(userId, id);

    // Prevent duplicate work code when updated
    if (dto.workCode) {
      const existing = await this.prisma.work.findFirst({
        where: {
          userId,
          workCode: { equals: dto.workCode.trim(), mode: 'insensitive' },
          NOT: { id },
        },
      });
      if (existing) {
        throw new BadRequestException(
          `Work code "${dto.workCode.trim()}" already exists. Please use a unique work code.`,
        );
      }
    }

    const { labours, materials, ...workData } = dto;
    await assertOwnedRefs(this.prisma, userId, {
      workSiteId: workData.workSiteId,
      labourIds: (labours || []).map((l) => l.labourId),
    });

    return this.prisma.$transaction(async (tx) => {
      if (labours !== undefined) {
        await tx.workLabour.deleteMany({ where: { workId: id } });
        await tx.workLabour.createMany({
          data: (labours || []).map((l) => ({
            workId: id,
            labourId: l.labourId || null,
            labourName: l.labourName,
            category: l.category,
            wage: Number(l.wage || 0),
          })),
        });
      }

      if (materials !== undefined) {
        await tx.workMaterial.deleteMany({ where: { workId: id } });
        await tx.workMaterial.createMany({
          data: (materials || []).map((m) => {
            const issued = Number(m.quantityIssued || 0);
            const used = Number(m.quantityUsed || 0);
            return {
              workId: id,
              materialName: m.materialName,
              quantityIssued: issued,
              quantityUsed: used,
              variance:
                m.variance !== undefined ? Number(m.variance) : issued - used,
              remarks: m.remarks,
            };
          }),
        });
      }

      const updateData: any = { ...workData };
      if (workData.date) updateData.date = new Date(workData.date);
      if (workData.endDate !== undefined) {
        updateData.endDate = workData.endDate ? new Date(workData.endDate) : null;
      } else if (workData.status === 'COMPLETED' && !current.endDate) {
        // If changed to COMPLETED and no previous endDate, set to today
        updateData.endDate = new Date();
      }
      if (workData.woDate !== undefined)
        updateData.woDate = workData.woDate ? new Date(workData.woDate) : null;
      if (workData.gstDate !== undefined)
        updateData.gstDate = workData.gstDate
          ? new Date(workData.gstDate)
          : null;

      return tx.work.update({
        where: { id },
        data: updateData,
        include: {
          workSite: true,
          labours: true,
          materials: true,
        },
      });
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.work.delete({
      where: { id },
    });
  }

  async getPolevar(userId: string, id: string) {
    const work = await this.findOne(userId, id);
    if (work.polevarData) {
      return work.polevarData;
    }

    // Starting template for a new sheet: a few common columns and three location rows
    return {
      title: `POLE VAR of ${work.name}`,
      columns: [
        // Materials: a few common items; more can be added in the sheet
        { id: 'mat_1', name: '9 mtr PSC', category: 'materials' },
        { id: 'mat_2', name: '8 MTR PSC', category: 'materials' },
        { id: 'mat_3', name: '4L X ARM', category: 'materials' },
        { id: 'mat_4', name: 'LT SHACKLE', category: 'materials' },
        { id: 'mat_5', name: 'EARTH PIPE', category: 'materials' },

        // Labour (2 standard items)
        { id: 'lab_1', name: 'STRINGING 4 WIRE (MTR)', category: 'labour' },
        { id: 'lab_2', name: 'READING SHACKLE', category: 'labour' },

        // Taken Back: a few common items
        { id: 'tb_1', name: 'ACSR RACOON 3 WIRE(MTR)', category: 'takenBack' },
        { id: 'tb_2', name: '9 MTR PSC', category: 'takenBack' },
        { id: 'tb_3', name: '3 MTR CHANNEL', category: 'takenBack' },
      ],
      rows: [
        { id: 'row_1', location: 'PU 1', values: {} },
        { id: 'row_2', location: 'PU 2', values: {} },
        { id: 'row_3', location: 'PU 3', values: {} },
      ],
    };
  }

  async updatePolevar(userId: string, id: string, data: any) {
    await this.findOne(userId, id);
    return this.prisma.work.update({
      where: { id },
      data: { polevarData: data },
    });
  }

  async updateDailyDetails(userId: string, id: string, dailyDetails: any) {
    await this.findOne(userId, id);
    clearExpenseSummaryCache(userId);
    return this.prisma.work.update({
      where: { id },
      data: { dailyDetails },
      include: {
        workSite: true,
        labours: {
          include: { labour: true },
        },
        materials: true,
      },
    });
  }
}
