import { PrismaService } from '../prisma/prisma.service';

// Short codes that link records across the app and the Google Sheet, e.g. SITE-001, LAB-014.

export const formatCode = (prefix: string, n: number) => `${prefix}-${String(n).padStart(3, '0')}`;

/** Next number after the highest one already used with this prefix */
export const nextCodeNumber = (codes: (string | null | undefined)[], prefix: string) =>
  codes.reduce((max, c) => {
    const m = c ? new RegExp(`^${prefix}-(\d+)$`).exec(c) : null;
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0) + 1;

export const nextSiteCode = async (prisma: PrismaService, userId: string) => {
  const rows = await prisma.workSite.findMany({ where: { userId }, select: { siteCode: true } });
  return formatCode('SITE', nextCodeNumber(rows.map((r) => r.siteCode), 'SITE'));
};

export const nextLabourCode = async (prisma: PrismaService, userId: string) => {
  const rows = await prisma.labour.findMany({ where: { userId }, select: { labourCode: true } });
  return formatCode('LAB', nextCodeNumber(rows.map((r) => r.labourCode), 'LAB'));
};

/** Gives codes to sites and workers saved before codes existed, oldest first */
export const assignMissingCodes = async (prisma: PrismaService, userId: string) => {
  const sites = await prisma.workSite.findMany({
    where: { userId },
    select: { id: true, siteCode: true },
    orderBy: { createdAt: 'asc' },
  });
  if (sites.some((s) => !s.siteCode)) {
    let n = nextCodeNumber(sites.map((s) => s.siteCode), 'SITE');
    for (const s of sites.filter((s) => !s.siteCode)) {
      await prisma.workSite.update({ where: { id: s.id }, data: { siteCode: formatCode('SITE', n++) } });
    }
  }

  const labours = await prisma.labour.findMany({
    where: { userId },
    select: { id: true, labourCode: true },
    orderBy: { createdAt: 'asc' },
  });
  if (labours.some((l) => !l.labourCode)) {
    let n = nextCodeNumber(labours.map((l) => l.labourCode), 'LAB');
    for (const l of labours.filter((l) => !l.labourCode)) {
      await prisma.labour.update({ where: { id: l.id }, data: { labourCode: formatCode('LAB', n++) } });
    }
  }
};
