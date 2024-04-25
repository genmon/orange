import * as build from '@remix-run/dev/server-build'
import type * as Party from 'partykit/server'
import { createRequestHandler, logDevReady } from 'partymix'

declare module '@remix-run/server-runtime' {
	export interface AppLoadContext {
		lobby: Party.FetchLobby
	}
}

if (process.env.NODE_ENV === 'development') {
	// trigger a reload on the remix dev server
	// @ts-ignore TODO: we should fix this, needs a new partymix release
	logDevReady(build)
}

// create a request handler for remix
const handleRequest = createRequestHandler({
	// @ts-ignore TODO: we should fix this, needs a new partymix release
	build,
	// @ts-ignore TODO: we should fix this, needs a new partymix release
	getLoadContext: (req, lobby, ctx) => {
		// use this function to expose stuff in loaders
		return { lobby }
	},
})
//const handleRequest = createRequestHandler({ build })

// This "main" party server simply handles all regular http requests
export default class MyRemix implements Party.Server {
	static onFetch(
		request: Party.Request,
		lobby: Party.FetchLobby,
		ctx: Party.ExecutionContext
	) {
		return handleRequest(request, lobby, ctx)
	}
}

MyRemix satisfies Party.Worker
