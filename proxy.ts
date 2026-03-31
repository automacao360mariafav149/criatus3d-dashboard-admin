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

function decodeBasicAuth(value: string): string {
  try {
    if (typeof atob === "function") {
      return atob(value);
    }

    if (typeof Buffer !== "undefined") {
      return Buffer.from(value, "base64").toString("utf-8");
    }
  } catch {
    return "";
  }

  return "";
}

export function proxy(request: NextRequest) {
  try {
    const isDashboardPath =
      request.nextUrl.pathname.startsWith("/dashboard") ||
      request.nextUrl.pathname.startsWith("/api") ||
      request.nextUrl.pathname.startsWith("/dashbordadmin/dashboard") ||
      request.nextUrl.pathname.startsWith("/dashbordadmin/api");

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
    const decoded = decodeBasicAuth(encodedPart);
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex < 0) {
      return unauthorizedResponse();
    }

    const username = decoded.slice(0, separatorIndex);
    const password = decoded.slice(separatorIndex + 1);

    if (username !== AUTH_USER || password !== AUTH_PASS) {
      return unauthorizedResponse();
    }

    return NextResponse.next();
  } catch {
    return unauthorizedResponse();
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/:path*",
    "/dashbordadmin/dashboard/:path*",
    "/dashbordadmin/api/:path*",
  ],
};
