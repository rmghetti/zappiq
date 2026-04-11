import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@zappiq/database';
import { validate } from '../middleware/validate.js';

const router = Router();

const createFlowSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  triggerType: z.enum(['KEYWORD', 'FIRST_CONTACT', 'SCHEDULE', 'MANUAL', 'EVENT']),
  triggerConfig: z.record(z.any()).optional(),
  nodes: z.array(z.any()).default([]),
  edges: z.array(z.any()).default([]),
});

// CRUD
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const flows = await prisma.flow.findMany({
      where: { organizationId: req.organizationId! },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ success: true, data: flows });
  } catch (err) { next(err); }
});

router.post('/', validate(createFlowSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const flow = await prisma.flow.create({
      data: { ...req.body, organizationId: req.organizationId! },
    });
    res.status(201).json({ success: true, data: flow });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const flow = await prisma.flow.findFirst({ where: { id: req.params.id, organizationId: req.organizationId! } });
    if (!flow) { res.status(404).json({ error: 'Flow not found' }); return; }
    res.json({ success: true, data: flow });
  } catch (err) { next(err); }
});

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.flow.updateMany({ where: { id: req.params.id, organizationId: req.organizationId! }, data: req.body });
    if (result.count === 0) { res.status(404).json({ error: 'Flow not found' }); return; }
    const updated = await prisma.flow.findUnique({ where: { id: req.params.id } });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.flow.deleteMany({ where: { id: req.params.id, organizationId: req.organizationId! } });
    if (result.count === 0) { res.status(404).json({ error: 'Flow not found' }); return; }
    res.json({ success: true, message: 'Flow deleted' });
  } catch (err) { next(err); }
});

// POST /api/flows/:id/publish
router.post('/:id/publish', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.flow.updateMany({
      where: { id: req.params.id, organizationId: req.organizationId! },
      data: { isActive: true, version: { increment: 1 } },
    });
    if (result.count === 0) { res.status(404).json({ error: 'Flow not found' }); return; }
    res.json({ success: true, message: 'Flow published' });
  } catch (err) { next(err); }
});

// POST /api/flows/:id/test
router.post('/:id/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const flow = await prisma.flow.findFirst({ where: { id: req.params.id, organizationId: req.organizationId! } });
    if (!flow) { res.status(404).json({ error: 'Flow not found' }); return; }

    const nodes = (flow.nodes as any[]) || [];
    const edges = (flow.edges as any[]) || [];
    const testInput = req.body.input || {};

    if (nodes.length === 0) {
      res.json({ success: true, data: { trace: [], message: 'Flow has no nodes' } });
      return;
    }

    // Encontrar nó inicial (type === 'start' ou primeiro nó)
    const startNode = nodes.find((n: any) => n.type === 'start') || nodes[0];

    // Mapas auxiliares para navegação
    const nodeMap = new Map<string, any>();
    for (const node of nodes) nodeMap.set(node.id, node);

    // Mapa de arestas: sourceId -> lista de edges (para suportar condições com múltiplas saídas)
    const edgeMap = new Map<string, any[]>();
    for (const edge of edges) {
      if (!edgeMap.has(edge.source)) edgeMap.set(edge.source, []);
      edgeMap.get(edge.source)!.push(edge);
    }

    const trace: { nodeId: string; type: string; result: string; timestamp: string }[] = [];
    const maxSteps = 50; // Limite de segurança para evitar loops infinitos
    let currentNodeId: string | null = startNode.id;
    let stepCount = 0;

    while (currentNodeId && stepCount < maxSteps) {
      stepCount++;
      const node = nodeMap.get(currentNodeId);
      if (!node) {
        trace.push({ nodeId: currentNodeId, type: 'unknown', result: 'Node not found — execution stopped', timestamp: new Date().toISOString() });
        break;
      }

      let result: string;
      let nextNodeId: string | null = null;

      switch (node.type) {
        case 'start':
          result = 'Flow started';
          break;

        case 'message':
          result = `Message: ${node.data?.text || node.data?.content || '(empty message)'}`;
          break;

        case 'condition': {
          // Avaliar condição simples: verifica se o campo do input corresponde ao valor esperado
          const field = node.data?.field || '';
          const operator = node.data?.operator || 'equals';
          const expected = node.data?.value;
          const actual = testInput[field];
          let conditionMet = false;

          switch (operator) {
            case 'equals': conditionMet = actual === expected; break;
            case 'not_equals': conditionMet = actual !== expected; break;
            case 'contains': conditionMet = String(actual || '').includes(String(expected)); break;
            case 'greater_than': conditionMet = Number(actual) > Number(expected); break;
            case 'less_than': conditionMet = Number(actual) < Number(expected); break;
            default: conditionMet = actual === expected;
          }

          result = `Condition "${field} ${operator} ${expected}" → ${conditionMet ? 'true' : 'false'}`;

          // Selecionar aresta correta baseado no resultado da condição
          const outEdges = edgeMap.get(currentNodeId) || [];
          const matchedEdge = conditionMet
            ? outEdges.find((e: any) => e.sourceHandle === 'true' || e.label === 'true' || e.data?.condition === 'true')
            : outEdges.find((e: any) => e.sourceHandle === 'false' || e.label === 'false' || e.data?.condition === 'false');

          if (matchedEdge) {
            nextNodeId = matchedEdge.target;
          } else if (outEdges.length > 0) {
            // Fallback: primeira aresta se condição met, segunda se não
            nextNodeId = conditionMet
              ? outEdges[0].target
              : (outEdges[1]?.target || outEdges[0].target);
          }
          break;
        }

        case 'action':
          result = `Action executed: ${node.data?.action || node.data?.type || 'generic'}`;
          break;

        case 'ai':
          result = `AI node: would call LLM with prompt "${(node.data?.prompt || '').substring(0, 80)}..."`;
          break;

        case 'human_handoff':
          result = 'Flagged for human handoff — conversation will be transferred to a human agent';
          trace.push({ nodeId: node.id, type: node.type, result, timestamp: new Date().toISOString() });
          currentNodeId = null;
          continue;

        case 'end':
          result = 'Flow ended';
          trace.push({ nodeId: node.id, type: node.type, result, timestamp: new Date().toISOString() });
          currentNodeId = null;
          continue;

        default:
          result = `Executed node of type "${node.type}"`;
      }

      trace.push({ nodeId: node.id, type: node.type, result, timestamp: new Date().toISOString() });

      // Encontrar próximo nó (se não foi definido pela lógica de condição)
      if (nextNodeId === null && currentNodeId) {
        const outEdges = edgeMap.get(currentNodeId) || [];
        nextNodeId = outEdges.length > 0 ? outEdges[0].target : null;
      }

      currentNodeId = nextNodeId;
    }

    if (stepCount >= maxSteps) {
      trace.push({ nodeId: 'system', type: 'error', result: `Execution halted: reached max steps limit (${maxSteps})`, timestamp: new Date().toISOString() });
    }

    res.json({ success: true, data: { trace, totalSteps: trace.length } });
  } catch (err) {
    // Retornar detalhes do erro em modo teste
    const error = err instanceof Error ? err : new Error(String(err));
    res.status(500).json({
      success: false,
      error: 'Flow test execution failed',
      details: error.message,
    });
  }
});

export default router;
