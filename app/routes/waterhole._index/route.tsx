import { useRoomContext } from '~/hooks/useRoomContext'
import Cursors from '~/presence/Cursors'
import PresenceProvider from '~/presence/presence-context'
import VideoCall from './VideoCall'

const PARTYKIT_HOST = '127.0.0.1:1999'
const pageId = 'waterhole'

export default function Waterhole() {
	const { joined } = useRoomContext()

	return (
		<PresenceProvider
			host={PARTYKIT_HOST}
			room={pageId}
			presence={{
				name: 'Anonymous User',
				color: '#0000f0',
			}}
		>
			<VideoCall roomName={pageId} />
			<div
				className="z-10 fixed top-0 left-0 w-full pointer-events-none"
				style={{ minHeight: '100dvh' }}
			>
				<Cursors />
			</div>
		</PresenceProvider>
	)
}
