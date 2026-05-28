/**
 * POST /api/auth/set-password
 * --------------------------------------------------------------
 * HOTFIX 2026-05-19 — Define senha real do cliente que entrou via Magic Link.
 *
 * Fluxo:
 *   1. Cliente faz signup com email -> recebe magic link -> clica
 *   2. Cadastro.tsx detecta hash #access_token, persiste em localStorage
 *   3. /onboarding Step 0 captura senha + confirmação (criterios NIST 800-63B)
 *   4. Ao avançar Step 0 OU no submit final, frontend chama este endpoint
 *      passando access_token Supabase + nova senha
 *   5. Endpoint usa Supabase Admin (service role) pra setar a senha
 *   6. Cliente passa a poder logar com email + senha
 *
 * Quando Google OAuth: este endpoint NAO e chamado (cliente loga sempre por Google)
 *
 * Critérios de senha (validados client e server):
 *   - min 12 chars, 1 maiuscula, 1 minuscula, 1 número, 1 especial
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface Body {
  access_token: string;
  password: string;
}

function validatePasswordStrength(pwd: string): string | null {
  if (typeof pwd !== 'string') return 'Senha inválida';
  if (pwd.length < 12) return 'Senha deve ter no mínimo 12 caracteres';
  if (!/[A-Z]/.test(pwd)) return 'Senha deve ter ao menos 1 letra maiúscula';
  if (!/[a-z]/.test(pwd)) return 'Senha deve ter ao menos 1 letra minúscula';
  if (!/[0-9]/.test(pwd)) return 'Senha deve ter ao menos 1 número';
  if (!/[^A-Za-z0-9]/.test(pwd)) return 'Senha deve ter ao menos 1 caractere especial';
  return null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const { access_token, password } = body;

    if (!access_token || !password) {
      return NextResponse.json({ error: 'access_token e password obrigatórios' }, { status: 400 });
    }

    const pwdErr = validatePasswordStrength(password);
    if (pwdErr) {
      return NextResponse.json({ error: pwdErr }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !serviceKey || !anonKey) {
      console.error('[set-password] Missing Supabase env');
      return NextResponse.json({ error: 'Configuração indisponível' }, { status: 500 });
    }

    // 1. Cliente ANON pra validar o access_token e descobrir o user_id
    const sbAnon = createClient(supabaseUrl, anonKey);
    const { data: userData, error: userErr } = await sbAnon.auth.getUser(access_token);
    if (userErr || !userData?.user) {
      console.warn('[set-password] Invalid access_token:', userErr?.message);
      return NextResponse.json({ error: 'Sessão expirada. Faça login novamente.' }, { status: 401 });
    }

    const userId = userData.user.id;
    const email = userData.user.email;

    // 2. Cliente ADMIN pra atualizar a senha (requer service_role)
    const sbAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: updateErr } = await sbAdmin.auth.admin.updateUserById(userId, {
      password,
    });

    if (updateErr) {
      console.error('[set-password] updateUserById error:', updateErr.message);
      return NextResponse.json({ error: 'Erro ao salvar senha. Tente novamente.' }, { status: 500 });
    }

    console.log('[set-password] OK user=%s email=%s', userId, email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[set-password] Unexpected error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
