import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const protectedPaths = ["/create", "/profile", "/settings", "/notifications", "/saved"];

  if (!user && pathname.startsWith("/post/")) {
    const authUrl = new URL("/auth", request.url);
    authUrl.searchParams.set("returnTo", `${pathname}${request.nextUrl.search}${request.nextUrl.hash}`);
    return NextResponse.redirect(authUrl);
  }

  if (pathname.startsWith("/gist/")) {
    const postId = pathname.split("/")[2];
    return NextResponse.redirect(new URL(`/post/${postId ?? ""}${request.nextUrl.search}`, request.url));
  }

  if (!user && protectedPaths.some((path) => pathname.startsWith(path))) return NextResponse.redirect(new URL("/auth", request.url));
  if (user && pathname === "/auth") return NextResponse.redirect(new URL("/", request.url));
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
