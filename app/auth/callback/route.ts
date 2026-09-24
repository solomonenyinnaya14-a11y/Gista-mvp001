import {createServerClient} from "@supabase/ssr";
import {NextResponse} from "next/server";
export async function GET(request:Request){
 const url=new URL(request.url); const code=url.searchParams.get("code"); const next=url.searchParams.get("next")??"/";
 if(code){
  const response=NextResponse.redirect(new URL(next,url.origin));
  const supabase=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{cookies:{getAll:()=>[],setAll:()=>{}}});
  await supabase.auth.exchangeCodeForSession(code);
  return response;
 }
 return NextResponse.redirect(new URL("/auth",url.origin));
}