import { NextRequest, NextResponse, NextFetchEvent, NextMiddleware } from "next/server";
import { MiddlewareFactory } from "./stackHandler";
import { AdminOnlyMiddleware } from "./adminOnlyMiddleware";
import { AuthUsersOnlyMiddleware } from "./authUsersOnlyMiddleware";


export const withAuth: MiddlewareFactory = (next) => {
  return async (request: NextRequest, event: NextFetchEvent) => {
    const pathname = request.nextUrl.pathname;
    if (pathname.startsWith("/users-list")) {

      const response = await AdminOnlyMiddleware(request);
      if (response) {
        return response; 
      }
    }
if (pathname === "/study-page" || pathname === "/workbook") {
  const response = await AuthUsersOnlyMiddleware(request);
  if (response) {
    return response;
  }
}
    return next(request, event); 
  };
};

