import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLabourDto } from './dto/create-labour.dto';
import { UpdateLabourDto } from './dto/update-labour.dto';

@Injectable()
export class LabourService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, search?: string) {
    const where: any = { userId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contact: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.labour.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const labour = await this.prisma.labour.findFirst({
      where: { id, userId },
    });
    if (!labour) {
      throw new NotFoundException(`Labour record #${id} not found`);
    }
    return labour;
  }

  async create(userId: string, dto: CreateLabourDto) {
    return this.prisma.labour.create({
      data: {
        ...dto,
        userId,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateLabourDto) {
    await this.findOne(userId, id);
    return this.prisma.labour.update({
      where: { id },
      data: dto,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.labour.delete({
      where: { id },
    });
  }
}
