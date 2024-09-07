'use server';

import {z} from 'zod';
import {PrismaClient} from "@prisma/client";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer.',
  }),
  amount: z.coerce.number().gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({id: true, date: true});
const UpdateInvoice = FormSchema.omit({id: true, date: true});

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
}

export async function createInvoice(prevState: State, formData: FormData) {
  const rawFormData = {
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  };
  const validatedFields = CreateInvoice.safeParse(rawFormData);

  console.error(validatedFields);
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      mesasge: 'Missing Fields. Failed to Create Invoice.',
    };
  }

  const {customerId, amount, status} = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString();
  const newInvoice = {
    customer_id: customerId,
    amount: amountInCents,
    status: status,
    date: date
  };

  try {
    const prisma = new PrismaClient();
    const promise = prisma.invoices.create({data: newInvoice});

    promise
      .then(async () => {
        await prisma.$disconnect()
      })
      .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
      });

    await promise;
  } catch (error) {
    console.error('Database Error: Failed to create invoice.');
    return {message: 'Database Error: Failed to create invoice.'};
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function updateInvoice(id: string, formData: FormData) {
  const rawFormData = {
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  };
  const {customerId, amount, status} = UpdateInvoice.parse(rawFormData);

  const amountInCents = amount * 100;

  try {
    const prisma = new PrismaClient();
    const promise = prisma.$queryRaw`
        UPDATE invoices
        SET customer_id = ${customerId},
            amount      = ${amountInCents},
            status      = ${status}
        WHERE id = ${id}
    `;

    promise
      .then(async () => {
        await prisma.$disconnect()
      })
      .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
      });

    await promise;
  } catch (error) {
    console.error('Database Error: Failed to update invoice.');
    return {message: 'Database Error: Failed to update invoice.'};
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  try {
    const prisma = new PrismaClient();
    const promise = prisma.$queryRaw`DELETE
                                     FROM invoices
                                     WHERE id = ${id}`;

    promise
      .then(async () => {
        await prisma.$disconnect()
      })
      .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
      });

    await promise;
  } catch (error) {
    console.error('Database Error: Failed to delete invoice.');
    return {message: 'Database Error: Failed to delete invoice.'};
  }

  revalidatePath('/dashboard/invoices');
}
