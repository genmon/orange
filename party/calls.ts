import type * as Party from 'partykit/server'
import type { ClientMessage, ServerMessage, User } from '~/types/Messages'
import { assertError } from '~/utils/assertError'
import assertNever from '~/utils/assertNever'
import { assertNonNullable } from '~/utils/assertNonNullable'
import getUsername from '~/utils/getUsername.server'

type Session = {
	heartbeatTimeout: ReturnType<typeof setTimeout> | null
	connection: Party.Connection
	blockedMessages: ServerMessage[]
	messageQueue: ServerMessage[]
	id: string
	name: string
	quit: boolean
	screen: boolean
	user: User
}

// =======================================================================================
// The ChatRoom Durable Object Class
// ChatRoom implements a Durable Object that coordinates an individual chat room. Participants
// connect to the room using WebSockets, and the room broadcasts messages from each participant
// to all others.
export default class CallsServer implements Party.Server {
	sessions: Session[] = []
	lastTimestamp: number = 0
	stateSyncInterval: ReturnType<typeof setInterval> | null = null

	constructor(public party: Party.Room) {
		party.blockConcurrencyWhile(async () => {
			this.sessions = (await party.storage.get<Session[]>('sessions')) ?? []
			this.sessions.forEach((s) => this.setupHeartbeatInterval(s))
		})
	}

	setupHeartbeatInterval = (session: Session) => {
		const resetHeartBeatTimeout = () => {
			if (session.heartbeatTimeout) clearTimeout(session.heartbeatTimeout)
			session.heartbeatTimeout = setTimeout(() => {
				this.handleUserLeft(session)
			}, 30000)
		}
		resetHeartBeatTimeout()
		return resetHeartBeatTimeout
	}

	handleUserLeft = (session: Session) => {
		session.quit = true
		this.sessions = this.sessions.filter((member) => member !== session)
		this.broadcastState()
	}

	broadcastState = () => {
		if (this.sessions.length > 0 && this.stateSyncInterval === null) {
			this.stateSyncInterval = setInterval(this.broadcastState, 5000)
		} else if (this.sessions.length === 0 && this.stateSyncInterval !== null) {
			clearInterval(this.stateSyncInterval)
			this.stateSyncInterval = null
			this.storeSessions()
		}

		this.broadcast({
			type: 'roomState',
			state: {
				users: this.sessions.map((s) => s.user),
			},
		})
	}

	storeSessions = async () =>
		this.party.storage.put(
			'sessions',
			this.sessions.map(
				({
					connection: _connection,
					heartbeatTimeout: _heartbeatTimeout,
					...s
				}) => s
			)
		)

	// broadcast() broadcasts a message to all clients.
	broadcast(message: ServerMessage, skipList?: string[]) {
		// Apply JSON if we weren't given a string to start with.

		// Iterate over all the sessions sending them messages.
		let quitters: Session[] = []
		this.sessions = this.sessions.filter((session) => {
			if (session.id) {
				if (skipList && skipList.includes(session.id)) {
					return true
				}
				try {
					this.sendMessage(session, message)
					return true
				} catch (err) {
					// Whoops, this connection is dead. Remove it from the list and arrange to notify
					// everyone below.
					session.quit = true
					quitters.push(session)
					return false
				}
			} else {
				// This session hasn't sent the initial user info message yet, so we're not sending them
				// messages yet (no secret lurking!). Queue the message to be sent later.
				session.blockedMessages.push(message)
				return true
			}
		})

		if (quitters.length > 0) this.broadcastState()
	}

	async sendMessage<M extends ServerMessage>(session: Session, message: M) {
		// 1 is OPEN readyState
		// https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState
		if (session.connection.readyState === 1) {
			session.connection.send(
				JSON.stringify({
					from: 'server',
					timestamp: this.lastTimestamp,
					message,
				})
			)
			session.messageQueue = session.messageQueue.filter((m) => m !== message)
		} else {
			session.messageQueue.push(message)
		}
		await this.storeSessions()
	}

	// handleSession() implements our WebSocket-based chat protocol.
	async handleSession(
		connection: Party.Connection,
		username: string,
		sessionId: string | null
	) {
		let foundSession = this.sessions.find(
			(s) => s.id === sessionId && s.name === username
		)
		const id = foundSession ? foundSession.id : crypto.randomUUID()

		if (foundSession) {
			foundSession.connection = connection
			for (const message of foundSession.messageQueue) {
				await this.sendMessage(foundSession, message)
			}
		}

		const session: Session = foundSession ?? {
			connection,
			heartbeatTimeout: null,
			blockedMessages: [],
			messageQueue: [],
			name: username,
			id,
			quit: false,
			screen: false,
			user: {
				id,
				name: username,
				joined: false,
				raisedHand: false,
				speaking: false,
				tracks: {
					audioEnabled: false,
					videoEnabled: false,
					screenShareEnabled: false,
				},
			},
		}
		if (!foundSession) {
			// add it to the sessions list.
			this.sessions.push(session)
			await this.sendMessage(session, {
				type: 'identity',
				id: session.id,
			})
		}

		this.broadcastState()

		const resetHeartBeatTimeout = this.setupHeartbeatInterval(session)

		connection.addEventListener('message', async (msg) => {
			if (typeof msg.data !== 'string') {
				console.warn('message data is not a string')
				return
			}
			try {
				if (session.quit) {
					// Whoops, when trying to send to this WebSocket in the past, it threw an exception and
					// we marked it broken. But somehow we got another message? I guess try sending a
					// close(), which might throw, in which case we'll try to send an error, which will also
					// throw, and whatever, at least we won't accept the message. (This probably can't
					// actually happen. This is defensive coding.)
					connection.close(1011, 'WebSocket broken.')
					return
				}

				let data: ClientMessage = JSON.parse(msg.data)

				switch (data.type) {
					case 'userLeft':
						this.handleUserLeft(session)
						break
					case 'heartBeat':
						resetHeartBeatTimeout()
						break
					case 'userUpdate':
						const updateSession = this.sessions.find((s) => s.id === session.id)
						if (updateSession) {
							updateSession.user = data.user
							this.broadcastState()
						}
						break
					case 'directMessage':
						const { to, message } = data
						const recipient = this.sessions.find((s) => s.id === to)
						if (recipient) {
							await this.sendMessage(recipient, {
								type: 'directMessage',
								from: session.user.name,
								message,
							})
						}
						break

					case 'muteUser':
						const muteUserId = data.id
						const userToMute = this.sessions.find((u) => u.id === muteUserId)
						if (userToMute) {
							userToMute.user.tracks.audioEnabled = false
							await this.sendMessage(userToMute, {
								type: 'muteMic',
							})
							this.broadcastState()
						}
						break
					default:
						assertNever(data)
						break
				}
			} catch (err) {
				assertError(err)
				// Report any exceptions directly back to the client. As with our handleErrors() this
				// probably isn't what you'd want to do in production, but it's convenient when testing.
				await this.sendMessage(session, {
					type: 'error',
					error: err.stack,
				})
			}
		})
	}

	async onConnect(
		connection: Party.Connection<unknown>,
		ctx: Party.ConnectionContext
	): Promise<void> {
		const request = ctx.request as unknown as Request
		const username = await getUsername(request)
		assertNonNullable(username)
		const sessionId = new URL(ctx.request.url).searchParams.get('session_id')
		await this.handleSession(connection, username, sessionId)
	}

	/*
	// The system will call fetch() whenever an HTTP request is sent to this Object. Such requests
	// can only be sent from other Worker code, such as the code above; these requests don't come
	// directly from the internet. In the future, we will support other formats than HTTP for these
	// communications, but we started with HTTP for its familiarity.
	async fetch(request: Request) {
		return await handleErrors(request, async () => {
			let url = new URL(request.url)

			switch (url.pathname) {
				case '/websocket': {
					// The request is to `/api/room/<name>/websocket`. A client is trying to establish a new
					// WebSocket session.
					if (request.headers.get('Upgrade') != 'websocket') {
						return new Response('expected websocket', { status: 400 })
					}

					const username = await getUsername(request)
					assertNonNullable(username)
					// To accept the WebSocket request, we create a WebSocketPair (which is like a socketpair,
					// i.e. two WebSockets that talk to each other), we return one end of the pair in the
					// response, and we operate on the other end. Note that this API is not part of the
					// Fetch API standard; unfortunately, the Fetch API / Service Workers specs do not define
					// any way to act as a WebSocket server today.
					let pair = new WebSocketPair()

					const sessionId = url.searchParams.get('session_id')

					// We're going to take pair[1] as our end, and return pair[0] to the client.
					await this.handleSession(pair[1], username, sessionId)

					// Now we return the other end of the pair to the client.
					return new Response(null, { status: 101, webSocket: pair[0] })
				}

				default:
					return new Response('Not found', { status: 404 })
			}
		})
	}
	*/
}
