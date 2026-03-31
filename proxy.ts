import { NextRequest, NextResponse } from "next/server";

const AUTH_USER = process.env.DASHBOARD_BASIC_AUTH_USER;
const AUTH_PASS = process.env.DASHBOARD_BASIC_AUTH_PASS;

function unauthorizedResponse() {
  return new NextResponse("Autenticacao obrigatoria", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Dashboard Criatus"',
    },
  });
}

export function proxy(request: NextRequest) {
  const isDashboardPath =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/api");

  if (!isDashboardPath) {
    return NextResponse.next();
  }

  if (!AUTH_USER || !AUTH_PASS) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Basic ")) {
    return unauthorizedResponse();
  }

  const encodedPart = authHeader.split(" ")[1];
  const decoded = atob(encodedPart);
  const [username, password] = decoded.split(":");

  if (username !== AUTH_USER || password !== AUTH_PASS) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/:path*",
    "/dashbordadmin/dashboard/:path*",
    "/dashbordadmin/api/:path*",
  ],
};
