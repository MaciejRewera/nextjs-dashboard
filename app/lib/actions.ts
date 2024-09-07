'use server';

import {z} from 'zod';
import {PrismaClient} from "@prisma/client";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.coerce.number(),
  status: z.enum(['pending', 'paid']),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({id: true, date: true});
const UpdateInvoice = FormSchema.omit({id: true, date: true});

export async function createInvoice(formData: FormData) {
  const rawFormData = {
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  };
  const {customerId, amount, status} = CreateInvoice.parse(rawFormData);

  const amountInCents = amount * 100;
  const date = new Date().toISOString();
  const newInvoice = {
    customer_id: customerId,
    amount: amountInCents,
    status: status,
    date: date
  };

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

  const prisma = new PrismaClient();
  const promise = prisma.$queryRaw`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
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

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string, formData: FormData) {
  const prisma = new PrismaClient();
  const promise = prisma.$queryRaw`DELETE FROM invoices WHERE id = ${id}`;

  promise
    .then(async () => {
      await prisma.$disconnect()
    })
    .catch(async (e) => {
      console.error(e)
      await prisma.$disconnect()
    });

  await promise;

  revalidatePath('/dashboard/invoices');
}
