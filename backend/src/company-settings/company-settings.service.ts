import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';

@Injectable()
export class CompanySettingsService {
  constructor(private prisma: PrismaService) {}

  /** The user's saved header details, or empty values when nothing is saved yet */
  async get(userId: string) {
    const settings = await this.prisma.companySettings.findUnique({ where: { userId } });
    return settings || { userId, pans: [] };
  }

  async update(userId: string, dto: UpdateCompanySettingsDto) {
    const data: any = {};
    for (const key of ['companyName', 'tagline', 'regNo', 'gstin', 'phone', 'email', 'address', 'signatoryName'] as const) {
      if (dto[key] !== undefined) data[key] = dto[key]!.trim() || null;
    }
    if (dto.logo !== undefined) data.logo = dto.logo || null;
    if (dto.pans !== undefined) {
      // At most one default PAN
      let defaultSeen = false;
      data.pans = dto.pans.map((p) => {
        const isDefault = Boolean(p.isDefault) && !defaultSeen;
        if (isDefault) defaultSeen = true;
        return { id: p.id, pan: p.pan.trim().toUpperCase(), label: p.label?.trim() || '', isDefault };
      });
    }
    return this.prisma.companySettings.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }
}
