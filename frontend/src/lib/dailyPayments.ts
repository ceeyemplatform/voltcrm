import { api } from './api';
import { applyDailyPaymentChange, DailyPaymentChange } from './payments';

/** Changes the payment mode/status of one or more daily log rows, saving each work once. */
export const updateDailyPayments = async (
  changes: { workId: string; dailyId: string; change: DailyPaymentChange }[]
) => {
  const byWork = new Map<string, { dailyId: string; change: DailyPaymentChange }[]>();
  for (const c of changes) {
    const list = byWork.get(c.workId) || [];
    list.push({ dailyId: c.dailyId, change: c.change });
    byWork.set(c.workId, list);
  }

  for (const [workId, list] of byWork) {
    const work = await api.works.get(workId);
    const details = Array.isArray(work.dailyDetails) ? work.dailyDetails : [];
    const updated = details.map((d) =>
      list
        .filter((c) => c.dailyId === d.id)
        .reduce((acc, c) => applyDailyPaymentChange(acc, c.change), d)
    );
    await api.works.updateDailyDetails(workId, updated);
  }
};
