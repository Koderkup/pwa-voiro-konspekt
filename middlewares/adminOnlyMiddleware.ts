import { NextRequest, NextResponse } from "next/server";
import { User } from "../types/user.dto";

export async function AdminOnlyMiddleware(req: NextRequest) {
  const userInfoCookie = req.cookies.get("user-info");

  if (!userInfoCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    return NextResponse.redirect(url);
  }

  const user: User = JSON.parse(userInfoCookie.value);

  if (user.role !== "admin") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
