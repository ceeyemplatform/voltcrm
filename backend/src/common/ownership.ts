import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Linked records sent from the browser (work site, work, labour) must belong to the same user,
 * otherwise one account could attach to — and then read through — another account's data.
 */
export const assertOwnedRefs = async (
  prisma: PrismaService,
  userId: string,
  refs: { workSiteId?: string | null; workId?: string | null; labourIds?: (string | null | undefined)[] },
) => {
  if (refs.workSiteId) {
    const site = await prisma.workSite.findFirst({ where: { id: refs.workSiteId, userId }, select: { id: true } });
    if (!site) throw new BadRequestException('Work site not found');
  }

  if (refs.workId) {
    const work = await prisma.work.findFirst({ where: { id: refs.workId, userId }, select: { id: true } });
    if (!work) throw new BadRequestException('Work not found');
  }

  const labourIds = Array.from(new Set((refs.labourIds || []).filter(Boolean) as string[]));
  if (labourIds.length > 0) {
    const count = await prisma.labour.count({ where: { id: { in: labourIds }, userId } });
    if (count !== labourIds.length) throw new BadRequestException('Labour record not found');
  }
};
