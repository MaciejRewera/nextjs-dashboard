import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import Credentials from "next-auth/providers/credentials";

import { z } from 'zod';
import type { User } from '@/app/lib/definitions';
import bcrypt from 'bcrypt';
import {PrismaClient, PrismaPromise} from "@prisma/client";
import {Revenue} from "@/app/lib/definitions";

async function getUser(email: string): Promise<User | undefined> {
  try {
    const prisma = new PrismaClient();
    const promise: PrismaPromise<User[]> = prisma.$queryRaw`SELECT * FROM users WHERE email=${email}`;

    promise
      .then(async () => {
        await prisma.$disconnect()
      })
      .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
      });

    return (await promise)[0];
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}

export const { auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [Credentials({
    async authorize(credentials) {
      const parsedCredentials = z
        .object({ email: z.string().email(), password: z.string().min(6) })
        .safeParse(credentials);

      if (parsedCredentials.success) {
        const { email, password } = parsedCredentials.data;
        const user = await getUser(email);
        if (!user) return null;
        const passwordsMatch = await bcrypt.compare(password, user.password);

        if (passwordsMatch) return user;
      }

      console.log('Invalid credentials');
      return null;
    },
  })],
});
