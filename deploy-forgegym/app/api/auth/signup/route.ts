import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: 'Public sign-up is disabled. Staff accounts are created by a gym owner or Super Admin.',
    },
    { status: 403 }
  );
}
