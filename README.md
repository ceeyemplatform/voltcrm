# VoltCRM - Electrical Contracting CRM Web App

A clean, modern, and production-ready CRM web application built specifically for electrical contracting businesses, substation engineers, and industrial cabling projects.

---

## ⚡ Tech Stack

| Layer | Technology | Port / Details |
| :--- | :--- | :--- |
| **Frontend** | React 19 + Vite + TypeScript + Tailwind CSS | Port `5173` |
| **Icons** | Lucide React | Clean, scalable vector icons |
| **Backend** | NestJS 10 + TypeScript + Express | Port `3000` (`/api` prefix) |
| **Database & ORM** | Prisma ORM connected to Supabase PostgreSQL | Cascade relations, strict `userId` scoping |
| **Authentication** | Supabase Auth (Email + Password) | Client JWT sent in `Authorization: Bearer <token>`, verified by global `SupabaseAuthGuard` |
| **Validation** | `class-validator` + `class-transformer` | Global DTO validation pipe with whitelist & type conversion |
| **Reporting / Print** | Dedicated Print Layouts + Browser PDF Export | Print-friendly CSS media queries & letterhead headers |

---

## 📁 Full Folder Structure

```text
elecrm/
├── package.json                   # Root convenience runner scripts
├── README.md                      # Comprehensive documentation
├── backend/                       # NestJS + Prisma Backend
│   ├── .env.example               # Backend environment variables template
│   ├── .env                       # Backend local configuration
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   ├── prisma/
│   │   └── schema.prisma          # Complete Prisma schema with cascade rules & userId indexes
│   └── src/
│       ├── main.ts                # Bootstrap with CORS, global validation pipe & exception filter
│       ├── app.module.ts          # Core application module importing domain modules
│       ├── app.controller.ts      # Health check endpoint (/api/health)
│       ├── common/
│       │   ├── decorators/
│       │   │   ├── current-user.decorator.ts  # @CurrentUser() injector
│       │   │   └── public.decorator.ts        # @Public() route decorator
│       │   └── filters/
│       │       └── http-exception.filter.ts   # Standardized JSON error response handler
│       ├── prisma/
│       │   ├── prisma.service.ts  # PrismaClient lifecycle connection service
│       │   └── prisma.module.ts   # Global Prisma module
│       ├── auth/
│       │   ├── auth.module.ts     # Global AuthModule registering SupabaseAuthGuard
│       │   ├── supabase.service.ts # Supabase client for token validation
│       │   └── guards/
│       │       └── auth.guard.ts  # Global SupabaseAuthGuard verifying JWTs
│       ├── labour/                # Labour Workforce module
│       │   ├── dto/
│       │   │   ├── create-labour.dto.ts
│       │   │   └── update-labour.dto.ts
│       │   ├── labour.controller.ts
│       │   ├── labour.service.ts  # Queries filtered by userId
│       │   └── labour.module.ts
│       ├── work-site/             # Work Sites & Locations module
│       │   ├── dto/
│       │   │   ├── create-work-site.dto.ts
│       │   │   └── update-work-site.dto.ts
│       │   ├── work-site.controller.ts
│       │   ├── work-site.service.ts
│       │   └── work-site.module.ts
│       ├── work/                  # Work Orders with nested Labour & Polevar Materials
│       │   ├── dto/
│       │   │   ├── create-work-labour.dto.ts
│       │   │   ├── create-work-material.dto.ts
│       │   │   ├── create-work.dto.ts
│       │   │   └── update-work.dto.ts
│       │   ├── work.controller.ts
│       │   ├── work.service.ts
│       │   └── work.module.ts
│       ├── quotation/             # Quotation Generator module
│       │   ├── dto/
│       │   │   ├── create-quotation-item.dto.ts
│       │   │   ├── create-quotation.dto.ts
│       │   │   └── update-quotation.dto.ts
│       │   ├── quotation.controller.ts
│       │   ├── quotation.service.ts # Auto generates quote numbers and computes totals
│       │   └── quotation.module.ts
│       ├── expense/               # Expense and Revenue ledger module
│       │   ├── dto/
│       │   │   ├── create-expense.dto.ts
│       │   │   └── update-expense.dto.ts
│       │   ├── expense.controller.ts
│       │   ├── expense.service.ts # Filtered queries + totals calculation (income, expense, balance)
│       │   └── expense.module.ts
│       ├── polevar/               # Consolidated Material Variance (Polevar) report
│       │   ├── polevar.controller.ts
│       │   ├── polevar.service.ts # Cross-work material reconciliation and summaries
│       │   └── polevar.module.ts
│       └── dashboard/             # Dashboard Metrics & Visuals
│           ├── dashboard.controller.ts
│           ├── dashboard.service.ts # 8 cards stats, recent works & 6-month financial history
│           └── dashboard.module.ts
│
└── frontend/                      # React + Vite + TypeScript + Tailwind Frontend
    ├── .env.example               # Frontend environment template
    ├── .env                       # Frontend local configuration
    ├── package.json
    ├── vite.config.ts             # Configured for port 5173
    ├── tailwind.config.js         # Custom electric amber brand palette
    ├── postcss.config.js
    ├── index.html                 # VoltCRM branding and Inter typography
    └── src/
        ├── index.css              # Tailwind base + @media print layout rules
        ├── main.tsx               # Root mounting with AuthProvider
        ├── App.tsx                # Session protection and page routing
        ├── types/
        │   └── index.ts           # Strict TypeScript models matching Prisma schema
        ├── lib/
        │   ├── supabase.ts        # Supabase JS client
        │   └── api.ts             # Typed REST API client injecting Supabase JWT
        ├── context/
        │   └── AuthContext.tsx    # Supabase email/password auth provider
        ├── components/
        │   ├── auth/
        │   │   └── LoginPage.tsx  # Minimalist auth card with Sign In and Sign Up tabs
        │   ├── layout/
        │   │   ├── Layout.tsx     # Responsive layout wrapper
        │   │   ├── Sidebar.tsx    # Clean navigation with active states & mobile drawer
        │   │   └── TopBar.tsx     # Page titles, user email & quick print trigger
        │   ├── common/
        │   │   ├── Modal.tsx      # Clean animated dialog component
        │   │   ├── ConfirmModal.tsx # Delete confirmation dialog
        │   │   ├── DataTable.tsx  # Searchable, sortable, paginated data table
        │   │   ├── PrintHeader.tsx# Official company letterhead for print/PDF
        │   │   └── StatCard.tsx   # Minimalist metric card
        │   ├── dashboard/
        │   │   └── FinancialChart.tsx # SVG monthly income vs expense comparison
        │   ├── labour/
        │   │   └── LabourModal.tsx
        │   ├── work-site/
        │   │   └── WorkSiteModal.tsx
        │   ├── work/
        │   │   ├── WorkModal.tsx  # Multi-row labour assignment & Polevar material report
        │   │   └── WorkPrintView.tsx # Full work report printable view
        │   ├── quotation/
        │   │   ├── QuotationModal.tsx # Line items, subtotal, auto GST %, total
        │   │   └── QuotationPrintView.tsx # Commercial estimate invoice printout
        │   ├── expense/
        │   │   ├── ExpenseModal.tsx
        │   │   └── ExpensePrintView.tsx # Filtered financial statement printout
        │   └── polevar/
        │       └── PolevarPrintView.tsx # Consolidated Polevar audit printout
        └── pages/
            ├── DashboardPage.tsx  # 8 stat cards, monthly chart & recent works
            ├── LabourPage.tsx     # Workforce CRUD & print register
            ├── WorkSitePage.tsx   # Work site directory CRUD & print
            ├── WorkPage.tsx       # Work orders with sub-tables & full report
            ├── QuotationPage.tsx  # Commercial quote generator & print
            ├── ExpensePage.tsx    # Income/expense ledger with totals & filters
            └── PolevarPage.tsx    # Material variance audit across all sites
```

---

## 🗄️ Database Models (Prisma)

The schema in `backend/prisma/schema.prisma` models all core entities with UUID primary keys, timestamps, indexes, and cascading relations:

- **`Labour`**: Workforce register (`name`, `category`, `contact`, `address`, `hourlyRate`, `dailyWage`, `userId`).
- **`WorkSite`**: Project facilities (`name`, `address`, `contact`, `note`, `userId`).
- **`Work`**: Main contract order (`workCode`, `name`, `date`, `workOrder`, `woDate`, `contractorAmount`, `status`, `gstMillNumber`, `gstDate`, `electricalSection`, `typeOfWork`, `workSiteId`, `userId`).
  - **`WorkLabour`** (`onDelete: Cascade`): Multi-row worker assignment (`labourName`, `category`, `wage`).
  - **`WorkMaterial`** (`onDelete: Cascade`): Material consumption (`materialName`, `quantityIssued`, `quantityUsed`, `variance`, `remarks`).
- **`Quotation`**: Commercial estimates (`quotationNo`, `date`, `clientName`, `address`, `workSiteId`, `subtotal`, `gstPercent`, `total`, `userId`).
  - **`QuotationItem`** (`onDelete: Cascade`): Line items (`description`, `unit`, `qty`, `rate`, `amount`).
- **`Expense`**: Transaction ledger (`date`, `amount`, `category`, `type` [`income` or `expense`], `remarks`, `userId`).

> **Security Guarantee**: Every single database query across all services filters strictly by the authenticated request's `userId`.

---

## ⚙️ Supabase Setup Steps

1. **Create a Supabase Project**:
   - Go to [database.new](https://database.new) and create a new project.
2. **Retrieve API Credentials**:
   - Navigate to **Project Settings** → **API**.
   - Copy **Project URL** (e.g. `https://xyzcompany.supabase.co`).
   - Copy **Project API Keys**: `anon` (public key) and `service_role` (secret key).
3. **Retrieve Database Connection Strings**:
   - Navigate to **Project Settings** → **Database** → **Connection pooling**.
   - Copy the **Connection string** in **URI** format:
     - **Transaction Mode (Port 6543)**: For `DATABASE_URL` (add `?pgbouncer=true`).
     - **Session / Direct Mode (Port 5432)**: For `DIRECT_URL` (used by Prisma migrations).
4. **Enable Email / Password Auth**:
   - In Supabase dashboard, go to **Authentication** → **Providers** → ensure **Email** is enabled.
   - For immediate local testing, you can uncheck **"Confirm email"** under **Authentication** → **Email Templates** / **Providers** to allow instant logins without clicking email confirmation links.

---

## 🚀 Setup & Execution Guide

### 1. Configure Environment Files

#### In `backend/.env`:
```env
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

DATABASE_URL="postgresql://postgres.[YOUR-PROJECT-ID]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[YOUR-PROJECT-ID]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

SUPABASE_URL="https://[YOUR-PROJECT-ID].supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

#### In `frontend/.env`:
```env
VITE_API_BASE_URL="http://localhost:3000/api"
VITE_SUPABASE_URL="https://[YOUR-PROJECT-ID].supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
```

---

### 2. Run Database Migrations

From the root directory or inside `backend/`:

```bash
# Generate Prisma Client
npm run prisma:generate

# Push schema directly to Supabase Postgres
npm run prisma:push

# Or create a formal migration history
npm run prisma:migrate
```

---

### 3. Start Both Servers

Open two terminals:

#### Terminal 1: Backend Server (Port 3000)
```bash
cd backend
npm run start:dev
```
*Backend API will run at `http://localhost:3000/api`*

#### Terminal 2: Frontend Server (Port 5173)
```bash
cd frontend
npm run dev
```
*Frontend application will run at `http://localhost:5173`*

---

## 📋 Comprehensive Feature Walkthrough

### 1. Dashboard
- **8 Metric Cards**: Total labours, work sites, total works, pending works, total quotation pipeline value, this month's income, this month's expense, and net profit.
- **Financial Chart**: 6-month SVG bar comparison of monthly income vs expenses.
- **Recent Works Table**: Last 5 work orders with live status badges and direct printable view actions.
- **Print Feature**: Full executive overview report layout.

### 2. Labour Entry
- Fields: Name, skill category, contact, address, hourly rate, daily wage.
- Quick search, sorting by wage/name, pagination.
- Create / update modal and delete confirm dialog.
- Print Workforce Register with official contractor header.

### 3. Work Site Entry
- Fields: Name, site address, site in-charge contact, safety notes.
- Displays number of active jobs linked to each site.
- Create / edit modal, delete confirm modal, and print site directory.

### 4. Work Entry
- **Main Fields**: Date, work code (auto-suggested or custom), name, work order (W/O) number, W/O date, contractor amount, status (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`), GST mill number, GST date, electrical section, and type of work.
- **Sub-table "Labour Work"**: Assign multiple workers directly from the Labour directory or custom names with specific trades and wages, with auto-summed total labour wage.
- **Section "Material Report (Polevar Report)"**: Record materials with quantity issued, quantity used, auto-calculated variance (`issued - used`), and audit remarks.
- **Print Full Work Report**: Complete job execution certificate with work specs, labour wages table, material Polevar variance table, and signature blocks.

### 5. Quotation Generator
- Fields: Quotation number (auto-generated e.g. `QT-202610-0001`), quotation date, client name, billing address, linked work site.
- **Dynamic Line Items**: Item description, unit (`Mtrs`, `Nos`, `Sets`, etc.), quantity, unit rate, and auto-computed line amount.
- **Financial Calculations**: Automated subtotal, adjustable GST % (default 18%), and grand total.
- **Print / PDF**: Professional formal proposal with company letterhead, client billing details, line items table, standard terms & conditions, and authorized signatory seal.

### 6. Expense Tracker
- **3-Color Financial Model**: 🟢 Green (+ Income / Received), 🟠 Orange Flag (To Get / Pending Receivables), 🔴 Red (- Output / Cash Out).
- **Zero-Duplicate Work Log Sync**: Automatically pulls daily labor wages and site expenses logged under Work Orders into the unified ledger.
- **Dynamic Metrics**: Net Cash Balance (realized liquid cash), Income Received, To Get (Receivables), and Total Outflow.
- **Multi-Filter Toolbar**: Date range (`From` / `To`), flow type filter, work order filter, payment mode filter, and instant search.
- **Custom Extensibility**: Instant inline creation of custom payment modes and transaction categories.
- **Print / PDF**: Filtered financial statement report with audit signature blocks and executive summary.
- 📖 *For complete technical and user documentation, see [EXPENSE_TRACKER.md](EXPENSE_TRACKER.md).*

### 7. Polevar Page (Consolidated Material Report)
- Consolidated material variance report across all work orders.
- Filters by work code, work site, and date range.
- Shows total issued units, total used units, and net surplus variance.
- Print / export consolidated Polevar audit certificate.

---

## 🖨️ Print & PDF Export Architecture

Every page is built with dedicated print support:
1. **Clean Media Query**: CSS `@media print` automatically strips out all UI chrome (sidebar, top bar, search bars, action buttons, pagination) and standardizes fonts for A4 paper.
2. **Dedicated Print Modals**: Work Orders, Quotations, Expenses, and Polevar views include specialized document sheets (`WorkPrintView`, `QuotationPrintView`, `ExpensePrintView`, `PolevarPrintView`).
3. **One-Click PDF Export**: Clicking **"Print / Export PDF"** triggers native `window.print()`, allowing users to directly save as PDF or print to physical printers with 0 third-party print dependencies.
