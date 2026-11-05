import { randomUUID } from 'node:crypto';
import { providerRequest } from './validation.ts';
export class InterceptQueue {
  rows = new Map<string, any>();
  sweep() { for (const [id, r] of this.rows) if (Date.now() - r.created > 300000) this.rows.delete(id); }
  add(request: unknown, origin: string) {
    this.sweep();
    if (this.rows.size >= 100) throw Error('Interception queue full');
    const id = randomUUID();
    this.rows.set(id, { id, request: structuredClone(providerRequest(request)), origin, created: Date.now(), status: 'held' });
    return { id };
  }
  list() { this.sweep(); return [...this.rows.values()].filter(r => r.status === 'held'); }
  decide(id: string, decision: string, request?: unknown) {
    this.sweep();
    const row = this.rows.get(id);
    if (!row || row.status !== 'held') throw Error('Request expired or already resolved');
    if (!['forward', 'drop'].includes(decision)) throw Error('Invalid decision');
    if (decision === 'forward' && request) {
      const edited = providerRequest(request);
      if (edited.method !== row.request.method) throw Error('Changing method is not supported');
      if (edited.method === 'eth_sendRawTransaction' && JSON.stringify(edited.params) !== JSON.stringify(row.request.params)) throw Error('Signed transactions cannot be edited');
      row.request = structuredClone(edited);
    }
    row.status = decision;
  }
  poll(id: string) {
    this.sweep();
    const row = this.rows.get(id);
    if (!row) return { status: 'drop' };
    if (row.status !== 'held') this.rows.delete(id);
    return { status: row.status, request: row.request };
  }
  clear() { this.rows.clear(); }
}
