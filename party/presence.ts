import type * as Party from 'partykit/server'
import type {
	Metadata,
	// ClientMessage,
	PartyMessage,
	Presence,
	User,
} from '~/presence/presence-schema'
import {
	clientMessageSchema,
	decodeMessage,
	encodePartyMessage,
} from '~/presence/presence-schema'

export type ConnectionWithUser = Party.Connection<{
	metadata?: Metadata
	presence?: Presence
}>

const BROADCAST_INTERVAL = 1000 / 60 // 60fps

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET',
	'Access-Control-Allow-Headers':
		'Origin, X-Requested-With, Content-Type, Accept',
}

// server.ts
export default class PresenceServer implements Party.Server {
	constructor(public room: Party.Room) {}
	options: Party.ServerOptions = {
		hibernate: true,
	}

	// pending updates are stored in memory and sent every tick
	add: { [id: string]: User } = {}
	presence: { [id: string]: Presence } = {}
	remove: string[] = []

	lastBroadcast = 0
	interval: ReturnType<typeof setInterval> | null = null

	static onBeforeConnect(req: Party.Request, lobby: Party.Lobby) {
		// we assume that the request url is encoded into the request query param
		const encodedHomeURL = new URL(req.url).searchParams.get('from')

		if (!encodedHomeURL) {
			return new Response('Not Allowed', { status: 403 })
		}
		console.log('onBeforeConnect encodedHomeURL', encodedHomeURL)
		const homeURL = new URL(decodeURIComponent(encodedHomeURL))

		const PRESENCE_WEBSITES = JSON.parse(
			((process.env.PRESENCE_WEBSITES || '[]') as string).replace(/'/g, '"')
		) as string[]

		if (['localhost', '127.0.0.1', '0.0.0.0'].includes(homeURL.hostname)) {
			return req
		}

		const matchWith = homeURL.origin + homeURL.pathname

		const patterns = PRESENCE_WEBSITES.map((site) => {
			try {
				return new URLPattern(site)
			} catch (e) {
				console.log(
					`

⚠️  Invalid URL pattern "${site}" in .env -> WEBSITES. 
It should be a valid input to new URLPattern(). 
Learn more: https://developer.mozilla.org/en-US/docs/Web/API/URL_Pattern_API

`
				)
				throw e
			}
		})

		const allowed = patterns.some((pattern) => pattern.test(matchWith))
		if (!allowed) {
			const errMessage = `The URL ${matchWith} does not match any allowed pattern from ${process.env.PRESENCE_WEBSITES}`
			const pair = new WebSocketPair()
			// @ts-expect-error we're using dom types here. apparently
			pair[1].accept()
			pair[1].close(1011, errMessage || 'Uncaught exception when connecting')
			return new Response(null, {
				status: 101,
				webSocket: pair[0],
			})
		}

		return req
	}

	onConnect(
		connection: Party.Connection,
		{ request }: Party.ConnectionContext
	): void | Promise<void> {
		const metadata = { country: request.cf?.country ?? null } as Metadata

		// The client may set name and color (from the presence object) in the query string
		const params = new URLSearchParams(request.url.split('?')[1])
		const presence = {
			name: params.get('name') ?? undefined,
			color: params.get('color') ?? undefined,
		} as Presence

		// Stash the metadata and the presence on the websocket
		connection.setState((prevState: User) => ({
			presence: { ...prevState?.presence, ...presence },
			metadata,
		}))

		this.join(connection)

		console.log('onConnect', this.room.id, connection.id, request.cf?.country)
	}

	enqueueAdd(id: string, user: User) {
		this.add[id] = user
	}

	enqueuePresence(id: string, presence: Presence) {
		this.presence[id] = presence
	}

	enqueueRemove(id: string) {
		this.remove.push(id)
		delete this.presence[id]
	}

	getUser(connection: ConnectionWithUser): User {
		return {
			presence: connection.state?.presence ?? ({} as Presence),
			metadata: connection.state?.metadata ?? ({} as Metadata),
		}
	}

	makeSyncMessage() {
		// Build users list
		const users = <Record<string, User>>{}
		for (const connection of this.room.getConnections()) {
			const user = this.getUser(connection)
			users[connection.id] = user
		}

		return {
			type: 'sync',
			users,
		} satisfies PartyMessage
	}

	join(connection: ConnectionWithUser) {
		// Keep the presence on the websocket. onConnect will add metadata
		connection.setState((prevState) => ({
			...prevState,
			presence: connection.state?.presence ?? ({} as Presence),
		}))
		this.enqueueAdd(connection.id, this.getUser(connection))
		// Reply with the current presence of all connections, including self
		const sync = this.makeSyncMessage()
		//connection.send(JSON.stringify(sync));
		console.log('sync', JSON.stringify(sync, null, 2))
		connection.send(encodePartyMessage(sync))
	}

	leave(connection: ConnectionWithUser) {
		this.enqueueRemove(connection.id)
		this.broadcast().catch((err) => {
			console.error(err)
		})
	}

	onMessage(
		msg: string | ArrayBufferLike,
		connection: ConnectionWithUser
	): void | Promise<void> {
		//const message = JSON.parse(msg as string) as ClientMessage;
		const result = clientMessageSchema.safeParse(decodeMessage(msg))
		if (!result.success) return
		const message = result.data
		/*console.log(
      "onMessage",
      this.party.id,
      connection.id,
      JSON.stringify(message, null, 2)
    );*/
		switch (message.type) {
			case 'update': {
				// A presence update, replacing the existing presence
				connection.setState((prevState) => {
					this.enqueuePresence(connection.id, message.presence)
					return {
						...prevState,
						presence: message.presence,
					}
				})
				break
			}
		}

		this.broadcast().catch((err) => {
			console.error(err)
		})
	}

	onClose(connection: ConnectionWithUser) {
		this.leave(connection)
	}

	onError(connection: ConnectionWithUser) {
		this.leave(connection)
	}

	async broadcast() {
		// Broadcasts deltas. Looks at lastBroadcast
		// - If it's longer ago than BROADCAST_INTERVAL, broadcasts immediately
		// - If it's less than BROADCAST_INTERVAL ago, schedules an alarm
		//   to broadcast later
		const now = Date.now()
		const ago = now - this.lastBroadcast
		if (ago >= BROADCAST_INTERVAL) {
			this._broadcast()
		} else {
			if (!this.interval) {
				this.interval = setInterval(() => {
					this._broadcast()
					if (this.interval) {
						clearInterval(this.interval)
						this.interval = null
					}
				}, BROADCAST_INTERVAL - ago)
			}
		}
	}

	_broadcast() {
		this.lastBroadcast = Date.now()

		// Avoid the situation where there's only one connection and we're
		// rebroadcasting its own deltas to it
		const connections = [...this.room.getConnections()]
		const presenceUniqueIds = new Set(Object.keys(this.presence))
		if (
			connections.length === 1 &&
			this.remove.length === 0 &&
			Object.keys(this.add).length === 0 &&
			presenceUniqueIds.size === 1 &&
			presenceUniqueIds.has(connections[0].id)
		) {
			this.presence = {}
			return
		}

		const update = {
			type: 'changes',
			add: this.add,
			presence: this.presence,
			remove: this.remove,
		} satisfies PartyMessage
		//this.party.broadcast(JSON.stringify(update));
		this.room.broadcast(encodePartyMessage(update))
		this.add = {}
		this.presence = {}
		this.remove = []
	}

	async onRequest(req: Party.Request) {
		if (req.method === 'GET') {
			// For SSR, return the current presence of all connections
			const users = [...this.room.getConnections()].reduce(
				(acc, user) => ({ ...acc, [user.id]: this.getUser(user) }),
				{}
			)
			return Response.json({ users }, { status: 200, headers: CORS })
		}

		// respond to cors preflight requests
		if (req.method === 'OPTIONS') {
			return Response.json({ ok: true }, { status: 200, headers: CORS })
		}

		return new Response('Method Not Allowed', { status: 405 })
	}
}

PresenceServer satisfies Party.Worker
