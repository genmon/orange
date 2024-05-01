import Toast from '~/components/Toast'
import { useRoomContext } from '~/hooks/useRoomContext'
import Cursors from '~/presence/Cursors'
import PresenceProvider from '~/presence/presence-context'
import { XLobby } from '../_room.$roomName._index'
import { JoinedRoom } from '../_room.$roomName.room'

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
			<div className="w-1/2 h-1/2">
				{!joined && <XLobby roomName={pageId} />}
				{joined && (
					<Toast.Provider>
						<JoinedRoom bugReportsEnabled={false} />
					</Toast.Provider>
				)}
			</div>
			<div
				className="z-10 fixed top-0 left-0 w-full pointer-events-none"
				style={{ minHeight: '100dvh' }}
			>
				<Cursors />
			</div>
		</PresenceProvider>
	)
}
