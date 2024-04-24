import type { FetchLobby } from 'partykit/server'
import type { ActionFunctionArgs } from 'partymix'
import { json } from 'partymix'
import invariant from 'tiny-invariant'
import type { ChatCard } from '~/types/GoogleChatApi'
import type { RoomState, User } from '~/types/Messages'
import type { PeerDebugInfo } from '~/utils/Peer.client'
import { RELEASE } from '~/utils/constants'
import populateTraceLink from '~/utils/populateTraceLink'

export type BugReportInfo = {
	roomState: RoomState
	roomName?: string
	identity?: User
	peerDebugInfo?: PeerDebugInfo
	url?: string
}

export const action = async ({ request, context }: ActionFunctionArgs) => {
	if (!context.FEEDBACK_URL || !context.FEEDBACK_QUEUE) {
		throw new Response('not found', { status: 404 })
	}
	const formData = await request.formData()
	const info: BugReportInfo = JSON.parse(String(formData.get('info')))
	const { roomState, identity, roomName, peerDebugInfo, url } = info
	const description = formData.get('description')
	invariant(typeof description === 'string')
	const userAgent = request.headers.get('User-Agent')
	invariant(typeof userAgent === 'string')
	invariant(roomName)
	invariant(url)

	const { hostname } = new URL(url)

	const chatCard: ChatCard = {
		cardsV2: [
			{
				cardId: 'orange-meets-feedback-card',
				card: {
					header: {
						title: `Feedback from ${identity?.name ?? ''}`,
						subtitle: `Environment: ${hostname} commit: ${RELEASE}`,
						imageUrl:
							'https://developers.google.com/chat/images/quickstart-app-avatar.png',
						imageType: 'CIRCLE',
						imageAltText: `Feedback from ${identity?.name}`,
					},
					sections: [
						{
							header: 'Description',
							widgets: [
								{
									textParagraph: {
										text: description,
									},
								},
							],
							collapsible: false,
						},
						{
							header: 'User Agent',
							widgets: [
								{
									textParagraph: {
										text: userAgent,
									},
								},
							],
							collapsible: false,
						},
						{
							header: 'Room',
							widgets: [
								{
									buttonList: {
										buttons: [
											{
												text: roomName,
												onClick: {
													openLink: {
														url,
													},
												},
											},
										],
									},
								},
							],
							collapsible: false,
						},
						{
							header: 'Users',
							collapsible: true,
							widgets: [
								{
									buttonList: {
										buttons: roomState.users.map((u) => ({
											text: u.name,
											onClick: {
												openLink: {
													url:
														populateTraceLink(
															u.transceiverSessionId ?? '',
															(context.lobby as FetchLobby).env.TRACE_LINK as
																| string
																| undefined
														) ?? '',
												},
											},
										})),
									},
								},
							],
						},
						{
							header: 'Room state',
							collapsible: true,
							uncollapsibleWidgetsCount: 0,
							widgets: [
								{
									decoratedText: {
										text: JSON.stringify(roomState),
									},
								},
							],
						},
						{
							header: 'Peer Debug Info',
							collapsible: true,
							uncollapsibleWidgetsCount: 0,
							widgets: [
								{
									decoratedText: {
										text: JSON.stringify(peerDebugInfo),
									},
								},
							],
						},
					],
				},
			},
		],
	}

	// uh we don't have queues... so I'm going to just comment this out for now
	// await context.FEEDBACK_QUEUE.send(chatCard)

	return json({
		status: 'ok',
	})
}
