import React from 'react';

interface FinancialChartProps {
  data: {
    month: string;
    income: number;
    expense: number;
    profit: number;
  }[];
}

export const FinancialChart: React.FC<FinancialChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-xs text-slate-400">
        No financial transaction history available.
      </div>
    );
  }

  // Find max value to scale chart bars
  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.income, d.expense)),
    10000
  );

  return (
    <div className="w-full">
      {/* Legend */}
      <div className="flex items-center justify-end space-x-6 mb-4 text-xs font-semibold">
        <div className="flex items-center space-x-2">
          <span className="h-3 w-3 rounded-sm bg-emerald-500" />
          <span className="text-slate-600">Monthly Income</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="h-3 w-3 rounded-sm bg-rose-500" />
          <span className="text-slate-600">Monthly Expense</span>
        </div>
      </div>

      {/* Chart Bars Grid */}
      <div className="h-64 flex items-end justify-between gap-2 sm:gap-6 pt-6 pb-2 border-b border-slate-300">
        {data.map((item, idx) => {
          const incomeHeight = Math.max(
            4,
            Math.round((item.income / maxVal) * 200)
          );
          const expenseHeight = Math.max(
            4,
            Math.round((item.expense / maxVal) * 200)
          );

          return (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center h-full justify-end group relative"
            >
              {/* Tooltip on hover */}
              <div className="absolute -top-14 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-slate-900 text-white rounded px-2 py-1 text-[10px] z-20 whitespace-nowrap shadow-lg">
                <div className="font-bold">{item.month}</div>
                <div>Income: ₹{item.income.toLocaleString()}</div>
                <div>Expense: ₹{item.expense.toLocaleString()}</div>
                <div
                  className={
                    item.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }
                >
                  Net: ₹{item.profit.toLocaleString()}
                </div>
              </div>

              {/* Bars container */}
              <div className="w-full flex items-end justify-center space-x-1 sm:space-x-2 h-full">
                {/* Income bar */}
                <div
                  style={{ height: `${incomeHeight}px` }}
                  className="w-full max-w-[20px] rounded-t-md bg-emerald-500 hover:bg-emerald-600 transition-all cursor-pointer"
                  title={`Income: ₹${item.income}`}
                />
                {/* Expense bar */}
                <div
                  style={{ height: `${expenseHeight}px` }}
                  className="w-full max-w-[20px] rounded-t-md bg-rose-500 hover:bg-rose-600 transition-all cursor-pointer"
                  title={`Expense: ₹${item.expense}`}
                />
              </div>

              {/* Month label */}
              <span className="mt-2 text-[11px] font-medium text-slate-500 truncate w-full text-center">
                {item.month}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
