import {sql} from '@vercel/postgres';
import {
  CardData,
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoice,
  Revenue,
} from './definitions';
import {formatCurrency, formatCurrencyBigInt} from './utils';
import {PrismaClient, PrismaPromise} from '@prisma/client'

export async function fetchRevenue() {
  try {
    // Artificially delay a response for demo purposes.
    // Don't do this in production :)
    console.log('Fetching revenue data...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const prisma = new PrismaClient();
    const promise: PrismaPromise<Revenue[]> = prisma.$queryRaw`SELECT * FROM revenue`;

    promise
      .then(async () => {
        await prisma.$disconnect()
      })
      .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
      });

    const data: Revenue[] = await promise;
    console.log('Data fetch for revenue completed after 3 seconds.');

    return data;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  try {
    console.log('Fetching latest invoices data...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const prisma = new PrismaClient();
    const promise = prisma.$queryRaw`
      SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      ORDER BY invoices.date DESC
      LIMIT 5`;

    promise
      .then(async () => {
        await prisma.$disconnect()
      })
      .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
      });

    const latestInvoices: LatestInvoice[] = (await promise).map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));

    console.log('Data fetch for latest invoices completed after 2 seconds.');

    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData(): Promise<CardData> {
  try {
    // You can probably combine these into a single SQL query
    // However, we are intentionally splitting them to demonstrate
    // how to initialize multiple queries in parallel with JS.

    const prisma = new PrismaClient()

    const invoiceCountPromise: PrismaPromise<{ count: number }> = prisma.$queryRaw`SELECT COUNT(*)
                                                                                   FROM invoices`;
    const customerCountPromise: PrismaPromise<{ count: number }> = prisma.$queryRaw`SELECT COUNT(*)
                                                                                    FROM customers`;
    const invoiceStatusPromise: PrismaPromise<{
      paid: number,
      pending: number
    }> = prisma.$queryRaw`SELECT SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END)    AS "paid",
                                 SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
                          FROM invoices`;

    const dataPromise = Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromise,
    ]);

    dataPromise
      .then(async () => {
        await prisma.$disconnect()
      })
      .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
      });

    const data = await dataPromise;
    const numberOfInvoices = Number(data[0][0].count ?? '0');
    const numberOfCustomers = Number(data[1][0].count ?? '0');
    const totalPaidInvoices = formatCurrencyBigInt(data[2][0].paid ?? 0n);
    const totalPendingInvoices = formatCurrencyBigInt(data[2][0].pending ?? 0n);

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;

export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
): Promise<InvoicesTable[]> {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const prisma = new PrismaClient();
    const promise: PrismaPromise<InvoicesTable[]> = prisma.$queryRaw`
        SELECT invoices.id,
               invoices.amount,
               invoices.date,
               invoices.status,
               customers.name,
               customers.email,
               customers.image_url
        FROM invoices
        JOIN customers ON invoices.customer_id = customers.id
        WHERE customers.name ILIKE ${`%${query}%`}
           OR customers.email ILIKE ${`%${query}%`}
           OR invoices.amount::text ILIKE ${`%${query}%`}
           OR invoices.date::text ILIKE ${`%${query}%`}
           OR invoices.status ILIKE ${`%${query}%`}
        ORDER BY invoices.date DESC
        LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    `;

    promise
      .then(async () => {
        await prisma.$disconnect()
      })
      .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
      });

    return await promise;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(query: string): Promise<number> {
  try {
    const prisma = new PrismaClient();
    const promise =  prisma.$queryRaw`
        SELECT COUNT(*)
        FROM invoices
        JOIN customers ON invoices.customer_id = customers.id
        WHERE customers.name ILIKE ${`%${query}%`}
           OR customers.email ILIKE ${`%${query}%`}
           OR invoices.amount::text ILIKE ${`%${query}%`}
           OR invoices.date::text ILIKE ${`%${query}%`}
           OR invoices.status ILIKE ${`%${query}%`}
    `;
    promise
      .then(async () => {
        await prisma.$disconnect()
      })
      .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
      });

    const count = await promise
    const totalPages = Math.ceil(Number(count[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string): Promise<InvoiceForm> {
  try {
    const prisma = new PrismaClient();
    const promise: PrismaPromise<InvoiceForm[]> = prisma.$queryRaw`
        SELECT invoices.id,
               invoices.customer_id,
               invoices.amount,
               invoices.status
        FROM invoices
        WHERE invoices.id = ${id};
    `;

    promise
      .then(async () => {
        await prisma.$disconnect()
      })
      .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
      });

    const data = await promise;
    const invoice = data.map((invoice) => ({
      ...invoice,
      // Convert amount from cents to dollars
      amount: invoice.amount / 100,
    }));

    return invoice[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers(): Promise<CustomerField[]> {
  try {
    const prisma = new PrismaClient();
    const promise: PrismaPromise<CustomerField[]> = prisma.$queryRaw`
        SELECT id,
               name
        FROM customers
        ORDER BY name ASC
    `;

    promise
      .then(async () => {
        await prisma.$disconnect()
      })
      .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
      });

    const customers = await promise;
    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const data = await sql<CustomersTableType>`
        SELECT customers.id,
               customers.name,
               customers.email,
               customers.image_url,
               COUNT(invoices.id)                                                         AS total_invoices,
               SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
               SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END)    AS total_paid
        FROM customers
                 LEFT JOIN invoices ON customers.id = invoices.customer_id
        WHERE customers.name ILIKE ${`%${query}%`}
           OR customers.email ILIKE ${`%${query}%`}
        GROUP BY customers.id, customers.name, customers.email, customers.image_url
        ORDER BY customers.name ASC
    `;

    const customers = data.rows.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}
