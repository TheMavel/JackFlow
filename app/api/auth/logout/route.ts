import { clearSessionCookie } from "../../../lib/auth";

export async function POST(request: Request) {
  const response = Response.json({ ok: true });
  response.headers.append("Set-Cookie", clearSessionCookie(request));
  return response;
}
