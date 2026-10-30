import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import {
  otherItemMode,
  otherItemStatus,
  otherMode,
  otherStatus,
  otherTotal,
  wagesMode,
  wagesSummary,
  wagesTotal,
} from '../common/payment-status';

// In-memory summary cache to provide instant responses on tab switching and filtering
const globalSummaryCache = new Map<string, { data: any; expiresAt: number }>();

export function clearExpenseSummaryCache(userId?: string) {
  if (userId) {
    for (const key of globalSummaryCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        globalSummaryCache.delete(key);
      }
    }
  } else {
    globalSummaryCache.clear();
  }
}

import { assertOwnedRefs } from '../common/ownership';
@Injectable()
export class ExpenseService {
  constructor(private prisma: PrismaService) {}

  private buildWhereClause(
    userId: string,
    filter?: {
      startDate?: string;
      endDate?: string;
      type?: string;
      category?: string;
      search?: string;
      workId?: string;
      workCode?: string;
      paymentMode?: string;
    },
  ) {
    const where: any = { userId };

    if (filter?.type) {
      where.type = filter.type;
    }

    if (filter?.category) {
      where.category = filter.category;
    }

    if (filter?.workId) {
      where.workId = filter.workId;
    }

    if (filter?.workCode) {
      where.workCode = filter.workCode;
    }

    if (filter?.paymentMode) {
      where.paymentMode = filter.paymentMode;
    }

    if (filter?.startDate || filter?.endDate) {
      where.date = {};
      if (filter.startDate) {
        where.date.gte = new Date(filter.startDate);
      }
      if (filter.endDate) {
        where.date.lte = new Date(filter.endDate);
      }
    }

    if (filter?.search) {
      where.OR = [
        { category: { contains: filter.search, mode: 'insensitive' } },
        { remarks: { contains: filter.search, mode: 'insensitive' } },
        { workCode: { contains: filter.search, mode: 'insensitive' } },
        { workName: { contains: filter.search, mode: 'insensitive' } },
        { personName: { contains: filter.search, mode: 'insensitive' } },
        { paymentMode: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  async getSummary(
    userId: string,
    filter?: {
      startDate?: string;
      endDate?: string;
      type?: string;
      category?: string;
      search?: string;
      workId?: string;
      workCode?: string;
      paymentMode?: string;
    },
  ) {
    const cacheKey = `${userId}:${JSON.stringify(filter || {})}`;
    const now = Date.now();
    const cached = globalSummaryCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const where = this.buildWhereClause(userId, filter);

    // Sequential queries on single pooled TCP connection: avoids establishing a 2nd TLS connection to Supabase
    const expenses = await this.prisma.expense.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    const works = await this.prisma.work.findMany({
      where: { userId },
      select: {
        id: true,
        workCode: true,
        name: true,
        electricalSection: true,
        dailyDetails: true,
        workSite: {
          select: {
            id: true,
            name: true,
            section: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    // Lightweight works list for frontend dropdowns
    const workOptions = works.map((w) => ({
      id: w.id,
      workCode: w.workCode,
      name: w.name,
      siteName: w.workSite?.name || '',
      siteId: w.workSite?.id || '',
      section: w.electricalSection || w.workSite?.section || '',
    }));

    // Extract daily work entries from works
    const dailyItems: any[] = [];
    for (const w of works) {
      if (filter?.workId && w.id !== filter.workId) continue;
      if (filter?.workCode && w.workCode !== filter.workCode) continue;

      if (Array.isArray(w.dailyDetails) && w.dailyDetails.length > 0) {
        for (const daily of w.dailyDetails as any[]) {
          // Date filters
          if (filter?.startDate && new Date(daily.date) < new Date(filter.startDate)) continue;
          if (filter?.endDate && new Date(daily.date) > new Date(filter.endDate)) continue;

          // Flow type filter: daily logs are expenses
          if (filter?.type === 'income') continue;

          const wages = wagesTotal(daily);
          const other = otherTotal(daily);
          if (wages <= 0 && other <= 0) continue;

          // Search filter
          if (filter?.search) {
            const q = filter.search.toLowerCase();
            const matches =
              (w.workCode && w.workCode.toLowerCase().includes(q)) ||
              (w.name && w.name.toLowerCase().includes(q)) ||
              (daily.workDone && daily.workDone.toLowerCase().includes(q)) ||
              (daily.remarks && daily.remarks.toLowerCase().includes(q)) ||
              String(wages + other).includes(q);
            if (!matches) continue;
          }

          const workerCount = daily.labourCount || daily.labourMembers?.length || 0;
          const base = {
            userId,
            date: daily.date,
            type: 'expense',
            workId: w.id,
            workCode: w.workCode,
            workName: w.name,
            isFlagged: false,
            isDailyWorkEntry: true,
            dailyId: daily.id,
            createdAt: daily.createdAt || daily.date,
            updatedAt: daily.createdAt || daily.date,
          };

          // Wages and other site expenses are separate rows, each with its own mode and status
          if (wages > 0) {
            const ws = wagesSummary(daily);
            dailyItems.push({
              ...base,
              id: `daily_${w.id}_${daily.id}_wages`,
              dailyPart: 'wages',
              amount: wages,
              category: 'Daily Labour Wages',
              remarks: daily.workDone || daily.remarks || 'Daily work log',
              personName: workerCount > 0 ? `${workerCount} Workers` : 'Daily Workforce',
              paymentMode: wagesMode(daily) || undefined,
              paymentStatus: ws.status,
              pendingAmount: ws.pending,
              isPending: ws.pending > 0,
            });
          }
          if (other > 0) {
            // Each site expense item is its own row with its own status and mode
            const items: any[] = (Array.isArray(daily.otherExpenses) ? daily.otherExpenses : []).filter(
              (e: any) => Number(e?.amount || 0) > 0,
            );
            const parts = items.length
              ? items.map((e: any, i: number) => ({
                  key: e.id || String(i),
                  itemId: e.id as string | undefined,
                  amount: Number(e.amount || 0),
                  description: e.description || 'Site expense',
                  status: otherItemStatus(daily, e),
                  mode: otherItemMode(daily, e) || undefined,
                }))
              : [
                  {
                    key: 'all',
                    itemId: undefined,
                    amount: other,
                    description: daily.workDone || 'Daily site expenses',
                    status: otherStatus(daily),
                    mode: otherMode(daily) || undefined,
                  },
                ];
            for (const part of parts) {
              dailyItems.push({
                ...base,
                id: `daily_${w.id}_${daily.id}_other_${part.key}`,
                dailyPart: 'other',
                dailyItemId: part.itemId,
                amount: part.amount,
                category: 'Site Expense',
                remarks: part.description,
                personName: undefined,
                paymentMode: part.status === 'paid' ? part.mode : undefined,
                paymentStatus: part.status,
                pendingAmount: part.status === 'pending' ? part.amount : 0,
                isPending: part.status === 'pending',
              });
            }
          }
        }
      }
    }

    // Manual transactions: isFlagged marks money still to collect (income) or still to pay (expense)
    const manualItems = expenses.map((e) => ({
      ...e,
      paymentStatus: e.isFlagged ? 'pending' : 'paid',
      pendingAmount: e.isFlagged ? Number(e.amount || 0) : 0,
    }));

    // Merge and sort
    // Newest date first; within a day, the most recently created record first
    const allItems: any[] = [...manualItems, ...dailyItems].sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime() ||
        new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime(),
    );

    // Compute totals
    let incomeReceived = 0;
    let incomeToGet = 0;
    let expenseOutflow = 0;
    let expensePending = 0;

    for (const item of allItems) {
      const val = Number(item.amount || 0);
      const pending = Number(item.pendingAmount || 0);
      if (item.type === 'income') {
        incomeToGet += pending;
        incomeReceived += val - pending;
      } else {
        expenseOutflow += val;
        expensePending += pending;
      }
    }

    const result = {
      items: allItems,
      works: workOptions,
      totals: {
        count: allItems.length,
        incomeReceived,
        incomeToGet,
        expenseOutflow,
        expensePending,
        netCashBalance: incomeReceived - (expenseOutflow - expensePending),
      },
    };

    // Cache summary for 20 seconds to provide instant filter switching and tab navigation
    globalSummaryCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + 20 * 1000,
    });

    return result;
  }

  async findAll(
    userId: string,
    filter?: {
      startDate?: string;
      endDate?: string;
      type?: string;
      category?: string;
      search?: string;
      workId?: string;
      workCode?: string;
      paymentMode?: string;
    },
  ) {
    const where = this.buildWhereClause(userId, filter);
    return this.prisma.expense.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getTotals(
    userId: string,
    filter?: {
      startDate?: string;
      endDate?: string;
      type?: string;
      category?: string;
      search?: string;
      workId?: string;
      workCode?: string;
      paymentMode?: string;
    },
  ) {
    const where = this.buildWhereClause(userId, filter);
    const records = await this.prisma.expense.findMany({
      where,
      select: {
        type: true,
        amount: true,
      },
    });

    let income = 0;
    let expense = 0;

    for (const item of records) {
      if (item.type === 'income') {
        income += item.amount;
      } else if (item.type === 'expense') {
        expense += item.amount;
      }
    }

    return {
      income,
      expense,
      balance: income - expense,
      count: records.length,
    };
  }

  async findOne(userId: string, id: string) {
    const record = await this.prisma.expense.findFirst({
      where: { id, userId },
    });
    if (!record) {
      throw new NotFoundException(`Expense record #${id} not found`);
    }
    return record;
  }

  async create(userId: string, dto: CreateExpenseDto) {
    await assertOwnedRefs(this.prisma, userId, { workId: dto.workId });
    clearExpenseSummaryCache(userId);
    return this.prisma.expense.create({
      data: {
        userId,
        date: new Date(dto.date),
        amount: Number(dto.amount),
        category: dto.category,
        type: dto.type,
        remarks: dto.remarks,
        workId: dto.workId,
        workCode: dto.workCode,
        workName: dto.workName,
        personName: dto.personName,
        paymentMode: dto.paymentMode,
        isFlagged: dto.isFlagged ?? false,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateExpenseDto) {
    await this.findOne(userId, id);
    await assertOwnedRefs(this.prisma, userId, { workId: dto.workId });
    clearExpenseSummaryCache(userId);
    const updateData: any = { ...dto };
    if (dto.date) {
      updateData.date = new Date(dto.date);
    }
    if (dto.amount !== undefined) {
      updateData.amount = Number(dto.amount);
    }
    return this.prisma.expense.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    clearExpenseSummaryCache(userId);
    return this.prisma.expense.delete({
      where: { id },
    });
  }
}
