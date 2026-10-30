import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';

import { assertOwnedRefs } from '../common/ownership';
@Injectable()
export class QuotationService {
  constructor(private prisma: PrismaService) {}

  async generateQuotationNumber(userId: string): Promise<string> {
    // Next number after the highest one used so far, so deleting a quotation never causes a repeat
    const existing = await this.prisma.quotation.findMany({
      where: { userId },
      select: { quotationNo: true },
    });
    const highest = existing.reduce((max, q) => {
      const m = /(\d+)\s*$/.exec(q.quotationNo || '');
      return m ? Math.max(max, Number(m[1])) : max;
    }, existing.length);
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const seq = String(highest + 1).padStart(4, '0');
    return `QT-${yearMonth}-${seq}`;
  }

  async findAll(userId: string, search?: string) {
    const where: any = { userId };
    if (search) {
      where.OR = [
        { quotationNo: { contains: search, mode: 'insensitive' } },
        { clientName: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.quotation.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        workSite: true,
        items: true,
      },
    });
  }

  async findOne(userId: string, id: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, userId },
      include: {
        workSite: true,
        items: true,
      },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation #${id} not found`);
    }

    return quotation;
  }

  async create(userId: string, dto: CreateQuotationDto) {
    await assertOwnedRefs(this.prisma, userId, { workSiteId: dto.workSiteId });
    const quotationNo =
      dto.quotationNo?.trim() || (await this.generateQuotationNumber(userId));

    const gstPercent = dto.gstPercent !== undefined ? Number(dto.gstPercent) : 18;
    const kind = dto.kind || 'ITEMS';

    let subtotal = 0;
    // Written quotations are free text only, without priced items
    const itemsData = (kind === 'WRITTEN' ? [] : dto.items || []).map((item) => {
      const qty = Number(item.qty || 0);
      const itemType = item.itemType || 'BOTH';
      const supplyRate =
        item.supplyRate !== undefined
          ? Number(item.supplyRate)
          : itemType === 'LABOUR'
          ? 0
          : Number(item.rate || 0);
      const labourRate =
        item.labourRate !== undefined
          ? Number(item.labourRate)
          : itemType === 'SUPPLY'
          ? 0
          : 0;

      let rate = Number(item.rate || 0);
      if (itemType === 'BOTH') {
        rate =
          item.supplyRate !== undefined || item.labourRate !== undefined
            ? supplyRate + labourRate
            : Number(item.rate || 0);
      } else if (itemType === 'SUPPLY') {
        rate = item.supplyRate !== undefined ? supplyRate : Number(item.rate || 0);
      } else if (itemType === 'LABOUR') {
        rate = item.labourRate !== undefined ? labourRate : Number(item.rate || 0);
      }

      const amount = qty * rate;
      subtotal += amount;
      return {
        description: item.description,
        unit: item.unit || '',
        qty,
        rate,
        amount,
        itemType,
        supplyRate,
        labourRate,
      };
    });

    const gstAmount = (subtotal * gstPercent) / 100;
    const total = subtotal + gstAmount;

    return this.prisma.quotation.create({
      data: {
        userId,
        quotationNo,
        date: new Date(dto.date),
        clientName: dto.clientName,
        address: dto.address,
        workSiteId: dto.workSiteId || null,
        subtotal,
        gstPercent,
        total,
        kind,
        pan: dto.pan?.trim() || null,
        pages: (dto.pages || []).map((p) => ({ id: p.id, html: p.html })),
        items: {
          create: itemsData,
        },
      },
      include: {
        workSite: true,
        items: true,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateQuotationDto) {
    const existing = await this.findOne(userId, id);
    await assertOwnedRefs(this.prisma, userId, { workSiteId: dto.workSiteId });

    return this.prisma.$transaction(async (tx) => {
      let subtotal = existing.subtotal;
      const gstPercent =
        dto.gstPercent !== undefined ? Number(dto.gstPercent) : existing.gstPercent;

      if (dto.items !== undefined) {
        await tx.quotationItem.deleteMany({ where: { quotationId: id } });

        subtotal = 0;
        const itemsData = (dto.items || []).map((item) => {
          const qty = Number(item.qty || 0);
          const itemType = item.itemType || 'BOTH';
          const supplyRate =
            item.supplyRate !== undefined
              ? Number(item.supplyRate)
              : itemType === 'LABOUR'
              ? 0
              : Number(item.rate || 0);
          const labourRate =
            item.labourRate !== undefined
              ? Number(item.labourRate)
              : itemType === 'SUPPLY'
              ? 0
              : 0;

          let rate = Number(item.rate || 0);
          if (itemType === 'BOTH') {
            rate =
              item.supplyRate !== undefined || item.labourRate !== undefined
                ? supplyRate + labourRate
                : Number(item.rate || 0);
          } else if (itemType === 'SUPPLY') {
            rate = item.supplyRate !== undefined ? supplyRate : Number(item.rate || 0);
          } else if (itemType === 'LABOUR') {
            rate = item.labourRate !== undefined ? labourRate : Number(item.rate || 0);
          }

          const amount = qty * rate;
          subtotal += amount;
          return {
            quotationId: id,
            description: item.description,
            unit: item.unit || '',
            qty,
            rate,
            amount,
            itemType,
            supplyRate,
            labourRate,
          };
        });

        await tx.quotationItem.createMany({
          data: itemsData,
        });
      }

      const gstAmount = (subtotal * gstPercent) / 100;
      const total = subtotal + gstAmount;

      const updateData: any = {
        subtotal,
        gstPercent,
        total,
      };

      if (dto.quotationNo) updateData.quotationNo = dto.quotationNo;
      if (dto.date) updateData.date = new Date(dto.date);
      if (dto.clientName) updateData.clientName = dto.clientName;
      if (dto.address !== undefined) updateData.address = dto.address;
      if (dto.workSiteId !== undefined) updateData.workSiteId = dto.workSiteId || null;
      if (dto.kind) updateData.kind = dto.kind;
      if (dto.pan !== undefined) updateData.pan = dto.pan.trim() || null;
      if (dto.pages !== undefined) updateData.pages = dto.pages.map((p) => ({ id: p.id, html: p.html }));

      return tx.quotation.update({
        where: { id },
        data: updateData,
        include: {
          workSite: true,
          items: true,
        },
      });
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.quotation.delete({
      where: { id },
    });
  }
}
