import Cursors from '~/presence/Cursors'
import PresenceProvider from '~/presence/presence-context'
import Room from './Room'
import VideoCall from './VideoCall'

const PARTYKIT_HOST = '127.0.0.1:1999'
const pageId = 'waterhole'

export default function Waterhole() {
	return (
		<PresenceProvider
			host={PARTYKIT_HOST}
			room={pageId}
			presence={{
				name: 'Anonymous User',
				color: '#0000f0',
			}}
		>
			<Room>
				<VideoCall roomName={pageId} />
			</Room>

			<div
				className="z-10 fixed top-0 left-0 w-full pointer-events-none"
				style={{ minHeight: '100dvh' }}
			>
				<Cursors />
			</div>
		</PresenceProvider>
	)
}
