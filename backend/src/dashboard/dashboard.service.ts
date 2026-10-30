import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      totalLabours,
      totalWorkSites,
      totalWorks,
      pendingWorks,
      quotationAggregate,
      monthExpenses,
      recentWorks,
      recentWorkSites,
      lastSixMonthsExpenses,
    ] = await Promise.all([
      this.prisma.labour.count({ where: { userId } }),
      this.prisma.workSite.count({ where: { userId } }),
      this.prisma.work.count({ where: { userId } }),
      this.prisma.work.count({
        where: { userId, status: { equals: 'PENDING', mode: 'insensitive' } },
      }),
      this.prisma.quotation.aggregate({
        where: { userId },
        _sum: { total: true },
      }),
      this.prisma.expense.findMany({
        where: {
          userId,
          date: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        select: {
          type: true,
          amount: true,
        },
      }),
      this.prisma.work.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 5,
        include: {
          workSite: true,
        },
      }),
      this.prisma.workSite.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: {
          _count: {
            select: { works: true },
          },
        },
      }),
      // Get expenses for the last 6 months for chart
      this.prisma.expense.findMany({
        where: {
          userId,
          date: {
            gte: new Date(now.getFullYear(), now.getMonth() - 5, 1),
          },
        },
        select: {
          date: true,
          type: true,
          amount: true,
        },
      }),
    ]);

    let thisMonthIncome = 0;
    let thisMonthExpense = 0;

    for (const exp of monthExpenses) {
      if (exp.type === 'income') {
        thisMonthIncome += exp.amount;
      } else if (exp.type === 'expense') {
        thisMonthExpense += exp.amount;
      }
    }

    const thisMonthProfit = thisMonthIncome - thisMonthExpense;
    const totalQuotationValue = quotationAggregate._sum.total || 0;

    // Build 6 months chart data
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    const chartMap = new Map<string, { month: string; income: number; expense: number; profit: number }>();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
      chartMap.set(key, { month: label, income: 0, expense: 0, profit: 0 });
    }

    for (const item of lastSixMonthsExpenses) {
      const d = new Date(item.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const entry = chartMap.get(key);
      if (entry) {
        if (item.type === 'income') {
          entry.income += item.amount;
        } else if (item.type === 'expense') {
          entry.expense += item.amount;
        }
        entry.profit = entry.income - entry.expense;
      }
    }

    const monthlyFinancials = Array.from(chartMap.values());

    return {
      cards: {
        totalLabours,
        totalWorkSites,
        totalWorks,
        pendingWorks,
        totalQuotationValue,
        thisMonthIncome,
        thisMonthExpense,
        thisMonthProfit,
      },
      recentWorks,
      recentWorkSites,
      monthlyFinancials,
    };
  }
}
