"use client";

import Link from "next/link";

import { AdminSecurityPanel } from "~/components/admin-security-panel";

export default function AdminPage() {
  return (
    <main className="container max-w-3xl py-16">
      <Link
        className="text-muted-foreground text-sm underline underline-offset-4"
        href="/"
      >
        ← Beat으로 돌아가기
      </Link>
      <p className="text-muted-foreground mt-8 text-sm font-medium tracking-wide uppercase">
        Beat administrator
      </p>
      <h1 className="mt-3 text-4xl font-bold">관리자 보안 센터</h1>
      <p className="text-muted-foreground mt-4 max-w-2xl text-lg">
        지속 로그인과 토큰을 직접 관리합니다. 전체 로그아웃을 실행하면 다음
        접근부터 다시 로그인해야 합니다.
      </p>
      <div className="mt-10">
        <AdminSecurityPanel />
      </div>
    </main>
  );
}
