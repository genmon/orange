// need to import the module in order for the declaration
// below to extend it instead of overwriting it.
// https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation
import 'partymix'
import type { Mode } from '~/utils/mode'
import type { Env } from './Env'

declare module 'partymix' {
	export interface AppLoadContext extends Env {
		mode: Mode
	}
}
