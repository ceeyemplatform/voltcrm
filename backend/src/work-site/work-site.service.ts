import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkSiteDto } from './dto/create-work-site.dto';
import { UpdateWorkSiteDto } from './dto/update-work-site.dto';

@Injectable()
export class WorkSiteService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, search?: string) {
    const where: any = { userId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { section: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { contact: { contains: search, mode: 'insensitive' } },
        { note: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.workSite.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { works: true, quotations: true },
        },
      },
    });
  }

  async findOne(userId: string, id: string) {
    const site = await this.prisma.workSite.findFirst({
      where: { id, userId },
      include: {
        works: {
          orderBy: { date: 'desc' },
          include: {
            labours: {
              include: { labour: true },
            },
            materials: true,
          },
        },
        quotations: {
          orderBy: { date: 'desc' },
        },
        _count: {
          select: { works: true, quotations: true },
        },
      },
    });
    if (!site) {
      throw new NotFoundException(`Work Site #${id} not found`);
    }
    return site;
  }

  async create(userId: string, dto: CreateWorkSiteDto) {
    return this.prisma.workSite.create({
      data: {
        ...dto,
        userId,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateWorkSiteDto) {
    await this.findOne(userId, id);
    return this.prisma.workSite.update({
      where: { id },
      data: dto,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.workSite.delete({
      where: { id },
    });
  }
}
