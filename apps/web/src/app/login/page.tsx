'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api } from '@/lib/api';

const schema = z.object({ email: z.string().email(), password: z.string().min(8) });
type Form = z.infer<typeof schema>;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });
  useEffect(() => {
    const token = params.get('accessToken');
    if (!token) return;
    localStorage.setItem('accessToken', token);
    localStorage.setItem('refreshToken', params.get('refreshToken') ?? '');
    router.replace('/');
  }, [params, router]);
  const submit = handleSubmit(async (values) => {
    const result = await api<{ accessToken: string; refreshToken: string }>('/auth/login', { method: 'POST', body: JSON.stringify(values) });
    localStorage.setItem('accessToken', result.accessToken);
    localStorage.setItem('refreshToken', result.refreshToken);
    router.push('/');
  });
  return <main className="grid min-h-screen place-items-center bg-slate-950 p-6"><form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"><p className="text-sm font-semibold text-blue-700">IB OPERATIONS PLATFORM</p><h1 className="mt-2 text-3xl font-bold">Welcome back</h1><p className="mb-6 mt-2 text-slate-500">Sign in to your enterprise workspace.</p><label className="block text-sm font-medium">Email</label><input className="mt-1 w-full" {...register('email')}/><p className="h-5 text-xs text-red-600">{errors.email?.message}</p><label className="block text-sm font-medium">Password</label><input type="password" className="mt-1 w-full" {...register('password')}/><p className="h-5 text-xs text-red-600">{errors.password?.message}</p><button className="btn mt-3 w-full" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'}</button><a className="btn-secondary mt-3 w-full" href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}/auth/google`}>Continue with Google</a></form></main>;
}

export default function Login() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-slate-950 text-white">Loading sign-in…</main>}><LoginForm/></Suspense>;
}
