// Worker threads don't inherit tsx's loader; register it, then load the TS worker.
import { register } from 'tsx/esm/api';

register();
await import('./worker.ts');
