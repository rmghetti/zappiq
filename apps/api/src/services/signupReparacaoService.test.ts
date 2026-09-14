/* ══════════════════════════════════════════════════════════════════════
 * A242: reparação dos cadastros órfãos. Só o PLANO é decidido aqui; a
 * gravação é decisão do fundador e roda pelo script, fora do produto.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi } from 'vitest';
import {
  planejarReparacao,
  executarReparacao,
  type OrfaoParaReparo,
  type UsuarioComOrganizacao,
} from './signupReparacaoService.js';

const orfaos: OrfaoParaReparo[] = [
  { id: 'sig-1', email: 'Dono@Empresa.com.br', plan_chosen: 'IZA_LITE' },
  { id: 'sig-2', email: 'lead@gmail.com', plan_chosen: 'GROWTH' },
  { id: 'sig-3', email: 'outro@empresa.com.br', plan_chosen: null },
];

const usuarios: UsuarioComOrganizacao[] = [
  { email: 'dono@empresa.com.br', organizationId: 'org-1' },
  { email: 'alguem@terceiro.com', organizationId: 'org-9' },
];

describe('planejarReparacao: quem dá para religar', () => {
  const plano = planejarReparacao(orfaos, usuarios);

  it('liga o signup à organização quando o e-mail bate, ignorando a caixa', () => {
    expect(plano.ligaveis).toEqual([
      { signupId: 'sig-1', email: 'dono@empresa.com.br', organizationId: 'org-1' },
    ]);
  });

  it('separa quem é lead de verdade, sem organização nenhuma', () => {
    expect(plano.semOrganizacao.map((x) => x.signupId)).toEqual(['sig-2', 'sig-3']);
  });

  it('não inventa organização para ninguém', () => {
    for (const l of plano.ligaveis) {
      expect(usuarios.some((u) => u.organizationId === l.organizationId)).toBe(true);
    }
  });

  it('lista vazia devolve plano vazio, sem estourar', () => {
    expect(planejarReparacao([], usuarios)).toEqual({ ligaveis: [], semOrganizacao: [] });
  });
});

describe('executarReparacao: dry-run é o padrão', () => {
  it('sem dryRun:false, NÃO escreve nada', async () => {
    const ligar = vi.fn(async () => 1);
    const r = await executarReparacao(planejarReparacao(orfaos, usuarios), { ligar });

    expect(ligar).not.toHaveBeenCalled();
    expect(r.dryRun).toBe(true);
    expect(r.ligados).toBe(0);
    expect(r.aLigar).toBe(1);
    expect(r.semOrganizacao).toBe(2);
  });

  it('com dryRun:false, liga cada signup uma vez', async () => {
    const ligar = vi.fn(async () => 1);
    const r = await executarReparacao(planejarReparacao(orfaos, usuarios), {
      dryRun: false,
      ligar,
    });

    expect(ligar).toHaveBeenCalledTimes(1);
    expect(ligar).toHaveBeenCalledWith({
      signupId: 'sig-1',
      email: 'dono@empresa.com.br',
      organizationId: 'org-1',
    });
    expect(r.ligados).toBe(1);
    expect(r.dryRun).toBe(false);
  });

  it('nunca escreve nada para quem não tem organização (é decisão comercial)', async () => {
    const ligar = vi.fn(async () => 1);
    const r = await executarReparacao(
      planejarReparacao([orfaos[1]], usuarios),
      { dryRun: false, ligar },
    );
    expect(ligar).not.toHaveBeenCalled();
    expect(r.semOrganizacao).toBe(1);
  });

  it('erro numa linha não impede as outras', async () => {
    const plano = planejarReparacao(
      [
        { id: 'sig-a', email: 'a@x.com', plan_chosen: null },
        { id: 'sig-b', email: 'b@x.com', plan_chosen: null },
      ],
      [
        { email: 'a@x.com', organizationId: 'org-a' },
        { email: 'b@x.com', organizationId: 'org-b' },
      ],
    );
    const ligar = vi.fn(async ({ signupId }: { signupId: string }) => {
      if (signupId === 'sig-a') throw new Error('banco fora');
      return 1;
    });

    const r = await executarReparacao(plano, { dryRun: false, ligar });
    expect(r.ligados).toBe(1);
    expect(r.falhas).toEqual(['sig-a']);
  });
});
