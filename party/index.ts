import * as build from '@remix-run/dev/server-build'
import type * as Party from 'partykit/server'
import { createRequestHandler, logDevReady } from 'partymix'
import type { Mode } from '~/utils/mode'
import { mode } from '~/utils/mode'

export interface ProcessEnv {
	USER_DIRECTORY_URL?: string
	FEEDBACK_URL?: string
	CALLS_APP_ID: string
	CALLS_APP_SECRET: string
	TRACE_LINK?: string
	API_EXTRA_PARAMS?: string
	MAX_WEBCAM_FRAMERATE?: string
	MAX_WEBCAM_BITRATE?: string
	MAX_WEBCAM_QUALITY_LEVEL?: string
}

declare module '@remix-run/server-runtime' {
	export interface AppLoadContext {
		mode: Mode
		lobby: Party.FetchLobby
		USER_DIRECTORY_URL?: string
		FEEDBACK_URL?: string
		CALLS_APP_ID: string
		CALLS_APP_SECRET: string
		TRACE_LINK?: string
		API_EXTRA_PARAMS?: string
		MAX_WEBCAM_FRAMERATE?: string
		MAX_WEBCAM_BITRATE?: string
		MAX_WEBCAM_QUALITY_LEVEL?: string
	}
}

if (process.env.NODE_ENV === 'development') {
	// trigger a reload on the remix dev server
	logDevReady(build)
}

// create a request handler for remix
const handleRequest = createRequestHandler({
	build,
	getLoadContext: (req, lobby, ctx) => {
		// use this function to expose stuff in loaders
		return {
			mode,
			lobby,
			USER_DIRECTORY_URL: process.env.USER_DIRECTORY_URL as string,
			FEEDBACK_URL: process.env.FEEDBACK_URL as string,
			CALLS_APP_ID: process.env.CALLS_APP_ID as string,
			CALLS_APP_SECRET: process.env.CALLS_APP_SECRET as string,
			TRACE_LINK: process.env.TRACE_LINK as string,
			API_EXTRA_PARAMS: process.env.API_EXTRA_PARAMS as string,
			MAX_WEBCAM_FRAMERATE: process.env.MAX_WEBCAM_FRAMERATE as string,
			MAX_WEBCAM_BITRATE: process.env.MAX_WEBCAM_BITRATE as string,
			MAX_WEBCAM_QUALITY_LEVEL: process.env.MAX_WEBCAM_QUALITY_LEVEL as string,
		}
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
